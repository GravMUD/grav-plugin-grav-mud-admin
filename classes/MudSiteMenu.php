<?php

namespace Grav\Plugin\GravMudAdmin;

use Grav\Common\Grav;
use Grav\Common\Page\Interfaces\PageInterface;

/**
 * Managed site navigation — JSON tree edited in EvvyTink, rendered as multilevel dropdowns.
 */
class MudSiteMenu
{
    private Grav $grav;
    private string $file;

    public function __construct(Grav $grav)
    {
        $this->grav = $grav;
        $root = defined('GRAV_WEBROOT') ? GRAV_WEBROOT : GRAV_ROOT;
        $dir = rtrim($root, '/\\') . '/user/data/mud-admin';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $this->file = $dir . '/site-menu.json';
    }

    /** @return array<string, mixed> */
    public function readRaw(): array
    {
        if (!is_file($this->file)) {
            return $this->defaultMenu();
        }
        $data = json_decode((string) file_get_contents($this->file), true);
        if (!is_array($data)) {
            return $this->defaultMenu();
        }
        if (!isset($data['items']) || !is_array($data['items'])) {
            $data['items'] = [];
        }
        return $data;
    }

    /** @param array<string, mixed> $menu */
    public function writeRaw(array $menu): void
    {
        $menu['updated'] = date('c');
        if (!isset($menu['items']) || !is_array($menu['items'])) {
            $menu['items'] = [];
        }
        file_put_contents(
            $this->file,
            json_encode($menu, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        );
    }

    /** @return array<string, mixed> */
    public function defaultMenu(): array
    {
        return [
            'id' => 'primary',
            'label' => 'Primary navigation',
            'items' => [],
            'source' => 'default',
        ];
    }

    /** @return array<string, mixed> */
    public function syncFromPages(): array
    {
        $items = $this->syncItemsFromGravPages();
        if ($items === null) {
            $items = $this->syncItemsFromMudFilesystem();
        } elseif ($items === []) {
            $fsItems = $this->syncItemsFromMudFilesystem();
            if ($fsItems !== []) {
                $items = $fsItems;
            }
        }

        return $this->persistSyncedMenu($items);
    }

    /** @return list<array<string, mixed>>|null */
    private function syncItemsFromGravPages(): ?array
    {
        try {
            $this->ensurePagesInitialized();
            $pages = $this->grav['pages'];
            $root = $pages->root();
            if (!$root) {
                return null;
            }

            $items = [];
            foreach ($root->children()->visible() as $page) {
                $items[] = $this->pageToMenuItem($page);
            }

            return $items;
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return list<array<string, mixed>> */
    private function syncItemsFromMudFilesystem(): array
    {
        $root = $this->resolvePagesFilesystemRoot();
        if ($root === null) {
            return [];
        }

        $items = [];
        foreach ($this->listPageSubdirs($root) as $subdir) {
            $item = $this->scanPageFolder($subdir);
            if ($item !== null) {
                $items[] = $item;
            }
        }

        return $items;
    }

    private function resolvePagesFilesystemRoot(): ?string
    {
        $locator = $this->grav['locator'];
        $root = $locator->findResource('page://', false);
        if (is_string($root) && is_dir($root)) {
            return $root;
        }

        $candidates = [];
        if (defined('GRAV_WEBROOT')) {
            $candidates[] = rtrim((string) GRAV_WEBROOT, '/\\') . '/user/pages';
        }
        if (defined('GRAV_ROOT')) {
            $candidates[] = rtrim((string) GRAV_ROOT, '/\\') . '/user/pages';
        }

        foreach ($candidates as $path) {
            if (is_dir($path)) {
                return $path;
            }
        }

        return null;
    }

    private function ensurePagesInitialized(): void
    {
        $pages = $this->grav['pages'];
        try {
            $pages->root();
            return;
        } catch (\Throwable) {
            // Grav page tree not built yet (common on Admin2 API requests).
        }

        if (method_exists($pages, 'init')) {
            $pages->init();
        }
        $this->grav->fireEvent('onPagesInitialized');
    }

    /** @param list<array<string, mixed>> $items */
    private function persistSyncedMenu(array $items): array
    {
        $menu = [
            'id' => 'primary',
            'label' => 'Primary navigation',
            'items' => $items,
            'source' => 'pages-sync',
            'synced' => date('c'),
        ];
        $this->writeRaw($menu);

        return $menu;
    }

    /** @return list<string> */
    private function listPageSubdirs(string $dir): array
    {
        $out = [];
        $entries = scandir($dir);
        if ($entries === false) {
            return $out;
        }
        sort($entries, SORT_NATURAL);
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..' || str_starts_with($entry, '.')) {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $out[] = $path;
            }
        }

        return $out;
    }

    /** @return array<string, mixed>|null */
    private function scanPageFolder(string $dir, string $routePrefix = ''): ?array
    {
        if (!is_dir($dir)) {
            return null;
        }

        $slug = $this->folderSlug(basename($dir));
        $route = $routePrefix === '' ? $slug : ($routePrefix . '/' . $slug);

        $children = [];
        foreach ($this->listPageSubdirs($dir) as $subdir) {
            $child = $this->scanPageFolder($subdir, $route);
            if ($child !== null) {
                $children[] = $child;
            }
        }

        $mudFile = $dir . DIRECTORY_SEPARATOR . 'default.mud';
        if (!is_file($mudFile)) {
            return $children !== [] ? [
                'id' => $slug,
                'label' => ucwords(str_replace(['-', '_'], ' ', $slug)),
                'page' => $route,
                'url' => $this->menuUrlForRoute($route),
                'visible' => true,
                'children' => $children,
            ] : null;
        }

        $meta = $this->parseMudFrontmatter($mudFile);
        if (!$meta['visible'] && $children === []) {
            return null;
        }

        $label = trim((string) ($meta['menu'] ?: $meta['title'] ?: $slug));
        if ($label === '') {
            $label = $slug;
        }

        return [
            'id' => $slug,
            'label' => $label,
            'page' => $route,
            'url' => $this->menuUrlForRoute($route),
            'visible' => true,
            'children' => $children,
        ];
    }

    private function folderSlug(string $folderName): string
    {
        if (preg_match('/^\d+\.(.+)$/', $folderName, $m)) {
            return $m[1];
        }

        return $folderName;
    }

    /** @return array{title: string, menu: string, visible: bool} */
    private function parseMudFrontmatter(string $file): array
    {
        $title = '';
        $menu = '';
        $visible = true;
        $raw = (string) file_get_contents($file);
        if (!preg_match('/^---\s*\r?\n(.*?)\r?\n---/s', $raw, $m)) {
            return ['title' => $title, 'menu' => $menu, 'visible' => $visible];
        }

        foreach (preg_split('/\r?\n/', $m[1]) as $line) {
            if (preg_match('/^title:\s*(.+)$/', $line, $match)) {
                $title = trim($match[1], " \t\"'");
            } elseif (preg_match('/^menu:\s*(.+)$/', $line, $match)) {
                $menu = trim($match[1], " \t\"'");
            } elseif (preg_match('/^visible:\s*(.+)$/', $line, $match)) {
                $v = strtolower(trim($match[1]));
                $visible = !in_array($v, ['false', '0', 'no'], true);
            }
        }

        return ['title' => $title, 'menu' => $menu, 'visible' => $visible];
    }

    private function menuUrlForRoute(string $route): string
    {
        $base = rtrim((string) $this->grav['base_url'], '/');
        $route = trim($route, '/');
        if ($route === '' || $route === 'home') {
            return $base . '/';
        }

        return $base . '/' . $route;
    }

    /** @return array<string, mixed> */
    private function pageToMenuItem(PageInterface $page): array
    {
        $item = [
            'id' => (string) $page->slug(),
            'label' => (string) ($page->menu() ?: $page->title()),
            'page' => trim((string) $page->route(), '/'),
            'url' => (string) $page->url(),
            'visible' => true,
            'children' => [],
        ];

        foreach ($page->children()->visible() as $child) {
            $item['children'][] = $this->pageToMenuItem($child);
        }

        return $item;
    }

    /** @return array<string, mixed>|null */
    public function forTwig(): ?array
    {
        $raw = $this->readRaw();
        if (empty($raw['items'])) {
            return null;
        }

        $current = $this->grav['page'] ?? null;
        $items = $this->resolveItems($raw['items'], $current instanceof PageInterface ? $current : null);

        return [
            'id' => (string) ($raw['id'] ?? 'primary'),
            'label' => (string) ($raw['label'] ?? 'Primary navigation'),
            'items' => $items,
        ];
    }

    /**
     * @param list<array<string, mixed>> $items
     * @return list<array<string, mixed>>
     */
    private function resolveItems(array $items, ?PageInterface $current): array
    {
        $out = [];
        foreach ($items as $item) {
            if (!is_array($item) || empty($item['visible'])) {
                continue;
            }
            $resolved = $this->resolveItem($item, $current);
            if ($resolved !== null) {
                $out[] = $resolved;
            }
        }
        return $out;
    }

    /** @param array<string, mixed> $item */
    private function resolveItem(array $item, ?PageInterface $current): ?array
    {
        $label = trim((string) ($item['label'] ?? ''));
        if ($label === '') {
            return null;
        }

        $url = trim((string) ($item['url'] ?? ''));
        $pageRoute = trim((string) ($item['page'] ?? ''));
        if ($url === '' && $pageRoute !== '') {
            try {
                $page = $this->grav['pages']->find($pageRoute);
                if ($page) {
                    $url = (string) $page->url();
                }
            } catch (\Throwable) {
                // Admin API requests often skip full page bootstrap.
            }
            if ($url === '') {
                $url = $this->menuUrlForRoute($pageRoute);
            }
        }
        if ($url === '') {
            $url = '#';
        }

        $children = [];
        if (!empty($item['children']) && is_array($item['children'])) {
            $children = $this->resolveItems($item['children'], $current);
        }

        $active = false;
        $activeChild = false;
        if ($current) {
            if ($pageRoute !== '' && ($current->route() === $pageRoute || str_starts_with(trim($current->route(), '/'), trim($pageRoute, '/') . '/'))) {
                $active = $current->route() === $pageRoute;
                $activeChild = !$active;
            }
            foreach ($children as $child) {
                if (!empty($child['active']) || !empty($child['activeChild'])) {
                    $activeChild = true;
                    break;
                }
            }
        }

        return [
            'id' => (string) ($item['id'] ?? uniqid('menu-', true)),
            'label' => $label,
            'url' => $url,
            'page' => $pageRoute,
            'active' => $active,
            'activeChild' => $activeChild,
            'children' => $children,
        ];
    }

    /** @param array<string, mixed> $payload */
    public function validateAndNormalize(array $payload): array
    {
        $items = $payload['items'] ?? null;
        if (!is_array($items)) {
            throw new \InvalidArgumentException('items array required');
        }

        return [
            'id' => (string) ($payload['id'] ?? 'primary'),
            'label' => (string) ($payload['label'] ?? 'Primary navigation'),
            'items' => $this->normalizeItems($items),
            'source' => (string) ($payload['source'] ?? 'evvytink'),
        ];
    }

    /**
     * @param list<mixed> $items
     * @return list<array<string, mixed>>
     */
    private function normalizeItems(array $items): array
    {
        $out = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $label = trim((string) ($item['label'] ?? ''));
            if ($label === '') {
                continue;
            }
            $children = [];
            if (!empty($item['children']) && is_array($item['children'])) {
                $children = $this->normalizeItems($item['children']);
            }
            $out[] = [
                'id' => trim((string) ($item['id'] ?? '')) ?: ('item-' . substr(uniqid(), -8)),
                'label' => $label,
                'url' => trim((string) ($item['url'] ?? '')),
                'page' => trim((string) ($item['page'] ?? '')),
                'visible' => !isset($item['visible']) || (bool) $item['visible'],
                'children' => $children,
            ];
        }
        return $out;
    }
}

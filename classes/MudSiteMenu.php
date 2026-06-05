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
        $pages = $this->grav['pages'];
        $root = $pages->root();
        if (!$root) {
            return $this->defaultMenu();
        }

        $items = [];
        foreach ($root->children()->visible() as $page) {
            $items[] = $this->pageToMenuItem($page);
        }

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

    /** @return array<string, mixed> */
    private function pageToMenuItem(PageInterface $page): array
    {
        $item = [
            'id' => (string) $page->slug(),
            'label' => (string) $page->menu(),
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
            $page = $this->grav['pages']->find($pageRoute);
            if ($page) {
                $url = (string) $page->url();
            } elseif ($pageRoute !== '') {
                $url = $this->grav['base_url'] . '/' . ltrim($pageRoute, '/');
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

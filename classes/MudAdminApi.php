<?php

namespace Grav\Plugin\GravMudAdmin;

use Grav\Common\Grav;

/**
 * GravMUD Admin JSON API - foundation for EvvyTink and internal Multisite Panel proxy.
 */
class MudAdminApi
{
    private Grav $grav;
    /** @var array<string, mixed> */
    private array $config;
    private string $pagesRoot;
    /** @var array<string, mixed>|null */
    private ?array $jsonBodyOverride = null;
    private bool $bridgeMode = false;

    /** @param array<string, mixed> $config */
    public function __construct(Grav $grav, array $config)
    {
        $this->grav = $grav;
        $this->config = $config;
        $this->pagesRoot = $this->realUserPath('pages');
    }

    /** @param array<string, mixed> $body */
    public function setJsonBodyOverride(array $body): void
    {
        $this->jsonBodyOverride = $body;
    }

    public function setBridgeMode(bool $enabled): void
    {
        $this->bridgeMode = $enabled;
    }

    public function handle(string $path, string $apiPrefix): void
    {
        if (!$this->bridgeMode) {
            header('Content-Type: application/json; charset=UTF-8');
            header('X-Content-Type-Options: nosniff');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            if (!$this->bridgeMode) {
                http_response_code(204);
            }
            return;
        }

        if (!empty($this->config['require_alpha']) && !$this->alphaInstalled()) {
            $this->fail('grav-mud-alpha required.', 503);
            return;
        }

        $sub = trim(substr($path, strlen($apiPrefix)), '/');
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        require_once __DIR__ . '/MudTeamDcBridge.php';
        $teamDc = MudTeamDcBridge::resolve($this->grav, $sub, $method);
        if ($teamDc !== null) {
            $this->requireAuth($method);
            if (isset($teamDc['body'])) {
                if (!$this->bridgeMode) {
                    header('Content-Type: ' . ($teamDc['content_type'] ?? 'text/plain'));
                }
                echo $teamDc['body'];
                return;
            }
            $this->respond($teamDc);
            return;
        }

        try {
            if ($sub === 'status' && $method === 'GET') {
                $this->respond($this->status());
                return;
            }
            if ($sub === 'pages' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond(['ok' => true, 'pages' => $this->listMudPages()]);
                return;
            }
            if ($sub === 'page' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->readPage($this->queryPagePath()));
                return;
            }
            if ($sub === 'page' && $method === 'PUT') {
                $this->requireAuth($method);
                $this->respond($this->writePage($this->readJsonBody(), false));
                return;
            }
            if ($sub === 'page' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->createPage($this->readJsonBody()));
                return;
            }
            if ($sub === 'page/rename' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->renamePage($this->readJsonBody()));
                return;
            }
            if ($sub === 'preview' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->preview($this->readJsonBody()));
                return;
            }
            if ($sub === 'publish' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->publish($this->readJsonBody()));
                return;
            }
            if ($sub === 'cache/clear' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->clearCache());
                return;
            }
            if ($sub === 'media' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond(['ok' => true, 'media' => $this->listMedia()]);
                return;
            }
            if ($sub === 'media/upload' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->uploadMedia());
                return;
            }
            if ($sub === 'theme/presets' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond(['ok' => true, 'presets' => $this->themePresets()]);
                return;
            }
            if ($sub === 'theme' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->readTheme($this->queryPagePath()));
                return;
            }
            if ($sub === 'theme' && $method === 'PUT') {
                $this->requireAuth($method);
                $this->respond($this->applyTheme($this->readJsonBody()));
                return;
            }
            if ($sub === 'theme/preview' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->previewTheme($this->readJsonBody()));
                return;
            }
            if ($sub === 'capabilities' && $method === 'GET') {
                $this->requireAuth($method);
                require_once __DIR__ . '/MudPluginCapabilities.php';
                $this->respond(MudPluginCapabilities::payload($this->grav));
                return;
            }
            if ($sub === 'stats' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->dashboardStats());
                return;
            }
            if ($sub === 'rss/feeds' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond(['ok' => true, 'feeds' => $this->readRssFeeds()]);
                return;
            }
            if ($sub === 'rss/feeds' && $method === 'PUT') {
                $this->requireAuth($method);
                $this->respond($this->writeRssFeeds($this->readJsonBody()));
                return;
            }
            if ($sub === 'rss/preview' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->previewRss($this->readJsonBody()));
                return;
            }
            if ($sub === 'dashboard/templates' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond(['ok' => true, 'templates' => $this->widgetTemplates()]);
                return;
            }
            if ($sub === 'dashboard/render' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->renderWidgetMud($this->readJsonBody()));
                return;
            }
            if ($sub === 'dashboard' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->readDashboard());
                return;
            }
            if ($sub === 'dashboard' && $method === 'PUT') {
                $this->requireAuth($method);
                $this->respond($this->writeDashboard($this->readJsonBody()));
                return;
            }
            if ($sub === 'forumz/queue' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->forumzQueue());
                return;
            }
            if ($sub === 'forumz/moderate' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->forumzModerate($this->readJsonBody()));
                return;
            }
            if ($sub === 'forumz/profiles' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->forumzProfiles());
                return;
            }
            if ($sub === 'menu' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->readMenu());
                return;
            }
            if ($sub === 'menu' && $method === 'PUT') {
                $this->requireAuth($method);
                $this->respond($this->writeMenu($this->readJsonBody()));
                return;
            }
            if ($sub === 'menu/sync-from-pages' && $method === 'POST') {
                $this->requireAuth($method);
                $this->respond($this->syncMenuFromPages());
                return;
            }
            if ($sub === 'spec/reference' && $method === 'GET') {
                $this->requireAuth($method);
                $this->respond($this->specReference($this->queryFenceName()));
                return;
            }
            $this->fail('Not found', 404);
        } catch (\InvalidArgumentException $e) {
            $this->fail($e->getMessage(), 400);
        } catch (\Throwable $e) {
            $this->fail('Admin tribble malfunction.', 500);
        }
    }

    /** @return array<string, mixed> */
    private function status(): array
    {
        return [
            'ok' => true,
            'plugin' => 'grav-mud-admin',
            'version' => '1.5.0-alpha',
            'mcp' => [
                'tools' => [
                    'mud_list_pages',
                    'mud_read_page',
                    'mud_preview',
                    'mud_write_page',
                    'mud_publish',
                    'mud_spec_reference',
                ],
                'package' => 'grav-mcp-mud',
            ],
            'editor' => 'EvvyTink',
            'editorVersion' => '1.1',
            'alpha' => $this->alphaInstalled(),
            'authRequired' => trim((string) ($this->config['access_token'] ?? '')) !== '',
            'pagesRoot' => $this->pagesRoot,
            'layouts' => ['promo', 'expose', 'docs', 'services', 'blog'],
        ];
    }

    /** @return list<array<string, mixed>> */
    private function listMudPages(): array
    {
        $out = [];
        if (!is_dir($this->pagesRoot)) {
            return $out;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->pagesRoot, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }
            $name = $file->getFilename();
            if (!str_ends_with(strtolower($name), '.mud')) {
                continue;
            }
            $full = $file->getPathname();
            $rel = $this->relativePagesPath($full);
            $out[] = [
                'path' => $rel,
                'name' => $name,
                'folder' => basename(dirname($full)),
                'modified' => date('c', (int) $file->getMTime()),
                'bytes' => $file->getSize(),
            ];
        }

        usort($out, static fn(array $a, array $b): int => strcmp($a['path'], $b['path']));
        return $out;
    }

    /** @return array<string, mixed> */
    private function readPage(string $relPath): array
    {
        $file = $this->resolvePageFile($relPath, true);
        $source = (string) file_get_contents($file);
        return [
            'ok' => true,
            'path' => $this->relativePagesPath($file),
            'source' => $source,
            'modified' => date('c', (int) filemtime($file)),
            'design' => $this->parseDesignBlock($source),
        ];
    }

    /** @param array<string, mixed> $payload */
    private function writePage(array $payload, bool $allowCreate): array
    {
        $relPath = (string) ($payload['path'] ?? '');
        $source = (string) ($payload['source'] ?? '');
        if ($relPath === '') {
            throw new \InvalidArgumentException('path required');
        }

        $file = $this->resolvePageFile($relPath, !$allowCreate);
        if (!$allowCreate && !is_file($file)) {
            throw new \InvalidArgumentException('Page not found.');
        }

        $dir = dirname($file);
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('Cannot create page directory.');
        }

        if (file_put_contents($file, $source) === false) {
            throw new \RuntimeException('Write failed.');
        }

        return [
            'ok' => true,
            'path' => $this->relativePagesPath($file),
            'modified' => date('c', (int) filemtime($file)),
            'bytes' => strlen($source),
            'design' => $this->parseDesignBlock($source),
        ];
    }

    /** @param array<string, mixed> $payload */
    private function createPage(array $payload): array
    {
        $relPath = (string) ($payload['path'] ?? '');
        if ($relPath === '') {
            throw new \InvalidArgumentException('path required');
        }

        $file = $this->resolvePageFile($relPath, false);
        if (is_file($file)) {
            throw new \InvalidArgumentException('Page already exists.');
        }

        $title = trim((string) ($payload['title'] ?? 'New Page'));
        $source = (string) ($payload['source'] ?? '');
        if ($source === '') {
            $source = $this->defaultPageSource($title);
        }

        return $this->writePage(['path' => $relPath, 'source' => $source], true);
    }

    /** @param array<string, mixed> $payload */
    private function renamePage(array $payload): array
    {
        $from = (string) ($payload['from'] ?? '');
        $to = (string) ($payload['to'] ?? '');
        if ($from === '' || $to === '') {
            throw new \InvalidArgumentException('from and to required');
        }

        $srcFile = $this->resolvePageFile($from, true);
        $destFile = $this->resolvePageFile($to, false);
        if (is_file($destFile)) {
            throw new \InvalidArgumentException('Destination already exists.');
        }

        $destDir = dirname($destFile);
        if (!is_dir($destDir) && !mkdir($destDir, 0755, true) && !is_dir($destDir)) {
            throw new \RuntimeException('Cannot create destination directory.');
        }

        if (!rename($srcFile, $destFile)) {
            throw new \RuntimeException('Rename failed.');
        }

        $emptyDir = dirname($srcFile);
        if (is_dir($emptyDir) && count(scandir($emptyDir)) === 2) {
            @rmdir($emptyDir);
        }

        return [
            'ok' => true,
            'from' => $from,
            'path' => $this->relativePagesPath($destFile),
        ];
    }

    /** @param array<string, mixed> $payload */
    private function publish(array $payload): array
    {
        $written = $this->writePage($payload, false);
        $cleared = $this->clearCache();
        $this->appendPublishLog((string) ($payload['path'] ?? $written['path'] ?? ''));
        $written['published'] = true;
        $written['cache'] = $cleared['message'] ?? 'Cache cleared.';
        return $written;
    }

    /** @param array<string, mixed> $payload */
    private function preview(array $payload): array
    {
        $source = (string) ($payload['source'] ?? '');
        if ($source === '') {
            throw new \InvalidArgumentException('source required');
        }

        require_once GRAV_ROOT . '/user/plugins/grav-mud-alpha/classes/MudAlphaCompiler.php';
        $compiler = new \Grav\Plugin\GravMudAlpha\MudAlphaCompiler();
        $theme = (string) $this->grav['config']->get('system.pages.theme', 'grav-mud-site');
        $themeUrl = $this->grav['base_url'] . '/user/themes/' . $theme . '/images';
        $compiler->setAssetBase($themeUrl);

        return [
            'ok' => true,
            'html' => $compiler->compile($source),
        ];
    }

    /** @return array<string, mixed> */
    private function clearCache(): array
    {
        if (isset($this->grav['cache'])) {
            $this->grav['cache']->clearCache('all');
        }

        return ['ok' => true, 'message' => 'Cache cleared.'];
    }

    private function defaultPageSource(string $title): string
    {
        $safeTitle = str_replace(["\r", "\n"], '', $title);
        return <<<MUD
---
title: {$safeTitle}
menu: {$safeTitle}
format: mud-spec
process:
  markdown: false
  twig: true
---

@@@
name: grav-official
layout: promo
@@@

::: hero
title: {$safeTitle}
lead: Edit this page in **EvvyTink** and hit Publish.
:::

::: manifesto
title: New MUD page
body: |
  Built with GravMUD Admin · Team DC
signoff: FutureVision Labs
:::

MUD;
    }

    /** @return array<string, mixed> */
    private function parseDesignBlock(string $source): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $source) ?: [];
        $start = -1;
        $end = -1;

        for ($i = 0, $n = count($lines); $i < $n; $i++) {
            $trim = trim($lines[$i]);
            if ($trim !== '@@@' && !preg_match('/^@@@\s/', $trim)) {
                continue;
            }
            if ($start === -1) {
                $start = $i;
                continue;
            }
            $end = $i;
            break;
        }

        if ($start === -1 || $end === -1 || $end <= $start) {
            return ['found' => false, 'fields' => []];
        }

        $fields = [];
        $tokenLines = [];
        $inTokens = false;

        for ($i = $start + 1; $i < $end; $i++) {
            $raw = $lines[$i];
            $line = trim($raw);

            if ($inTokens) {
                if ($line === '' || preg_match('/^\S+\s*:\s*/', $line)) {
                    $inTokens = false;
                    if ($line !== '' && str_contains($line, ':')) {
                        [$key, $value] = array_map('trim', explode(':', $line, 2));
                        if ($key !== '') {
                            $fields[$key] = $value;
                        }
                    }
                    continue;
                }
                if (preg_match('/^(\S+)\s+(.+)$/', $line, $m)) {
                    $tokenLines[] = $m[1] . ' ' . trim($m[2], "\"'");
                }
                continue;
            }

            if ($line === '') {
                continue;
            }

            if (preg_match('/^tokens:\s*(.*)$/', $line, $m)) {
                $inline = trim($m[1]);
                if ($inline !== '' && $inline !== '|' && $inline !== '>') {
                    if (preg_match('/^(\S+)\s+(.+)$/', $inline, $tm)) {
                        $tokenLines[] = $tm[1] . ' ' . trim($tm[2], "\"'");
                    }
                } else {
                    $inTokens = true;
                }
                continue;
            }

            if (!str_contains($line, ':')) {
                continue;
            }

            [$key, $value] = array_map('trim', explode(':', $line, 2));
            if ($key !== '') {
                $fields[$key] = $value;
            }
        }

        if ($tokenLines) {
            $fields['tokens'] = implode("\n", $tokenLines);
        }

        return ['found' => true, 'fields' => $fields];
    }

    private function alphaInstalled(): bool
    {
        return is_file(GRAV_ROOT . '/user/plugins/grav-mud-alpha/grav-mud-alpha.php');
    }

    private function queryPagePath(): string
    {
        $path = (string) ($_GET['path'] ?? '');
        if ($path === '') {
            throw new \InvalidArgumentException('path query required');
        }
        return $path;
    }

    /** @return array<string, mixed> */
    private function readJsonBody(): array
    {
        if ($this->jsonBodyOverride !== null) {
            return $this->jsonBodyOverride;
        }
        $raw = (string) file_get_contents('php://input');
        if ($raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new \InvalidArgumentException('Invalid JSON body');
        }
        return $data;
    }

    private function requireAuth(string $method): void
    {
        if ($this->bridgeMode) {
            return;
        }

        $token = trim((string) ($this->config['access_token'] ?? ''));
        if ($token === '') {
            if ($method === 'GET') {
                return;
            }
            throw new \InvalidArgumentException('Configure access_token before writes.');
        }

        $sent = $this->requestToken();
        if (!hash_equals($token, $sent)) {
            throw new \InvalidArgumentException('Unauthorized.');
        }
    }

    private function requestToken(): string
    {
        $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (str_starts_with($header, 'Bearer ')) {
            return trim(substr($header, 7));
        }
        return trim((string) ($_SERVER['HTTP_X_MUD_ADMIN_TOKEN'] ?? ''));
    }

    private function resolvePageFile(string $relPath, bool $mustExist): string
    {
        $relPath = str_replace('\\', '/', $relPath);
        $relPath = ltrim($relPath, '/');
        if ($relPath === '' || str_contains($relPath, '..')) {
            throw new \InvalidArgumentException('Invalid page path.');
        }
        if (!str_ends_with(strtolower($relPath), '.mud')) {
            $relPath .= '.mud';
        }

        $full = $this->pagesRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relPath);
        $realPages = realpath($this->pagesRoot);
        if ($realPages === false) {
            throw new \InvalidArgumentException('Pages root missing.');
        }

        $parent = dirname($full);
        $realParent = realpath($parent);
        if ($realParent !== false && !str_starts_with($realParent, $realPages)) {
            throw new \InvalidArgumentException('Path escapes pages root.');
        }
        if ($realParent === false && !str_starts_with(str_replace('\\', '/', $parent), str_replace('\\', '/', $this->pagesRoot))) {
            throw new \InvalidArgumentException('Path escapes pages root.');
        }

        if ($mustExist && !is_file($full)) {
            throw new \InvalidArgumentException('Page not found.');
        }

        return $full;
    }

    private function relativePagesPath(string $absolute): string
    {
        $absolute = str_replace('\\', '/', $absolute);
        $root = str_replace('\\', '/', $this->pagesRoot);
        if (str_starts_with($absolute, $root)) {
            return ltrim(substr($absolute, strlen($root)), '/');
        }
        return $absolute;
    }

    private function realUserPath(string $segment): string
    {
        $root = defined('GRAV_WEBROOT') ? GRAV_WEBROOT : GRAV_ROOT;
        return rtrim($root, '/\\') . '/user/' . trim($segment, '/');
    }

    private function adminDataPath(string $file): string
    {
        $dir = $this->realUserPath('data/mud-admin');
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir . '/' . ltrim($file, '/');
    }

    /** @return list<array<string, mixed>> */
    private function listMedia(): array
    {
        $ext = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'mp4', 'webm', 'ogg', 'mov', 'm4v'];
        $roots = [
            ['root' => $this->realUserPath('pages'), 'urlBase' => '/user/pages'],
            ['root' => $this->realUserPath('media'), 'urlBase' => '/user/media'],
            ['root' => $this->themeImagesPath(), 'urlBase' => '/user/themes/' . $this->activeTheme() . '/images'],
        ];
        $out = [];
        $seen = [];

        foreach ($roots as $entry) {
            if (!is_dir($entry['root'])) {
                continue;
            }
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($entry['root'], \FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $file) {
                if (!$file->isFile()) {
                    continue;
                }
                $name = strtolower($file->getFilename());
                $ok = false;
                foreach ($ext as $e) {
                    if (str_ends_with($name, '.' . $e)) {
                        $ok = true;
                        break;
                    }
                }
                if (!$ok) {
                    continue;
                }
                $full = str_replace('\\', '/', $file->getPathname());
                $root = str_replace('\\', '/', $entry['root']);
                $rel = ltrim(substr($full, strlen($root)), '/');
                $url = rtrim($entry['urlBase'], '/') . '/' . str_replace(' ', '%20', $rel);
                if (isset($seen[$url])) {
                    continue;
                }
                $seen[$url] = true;
                $out[] = [
                    'url' => $url,
                    'name' => $file->getFilename(),
                    'path' => $rel,
                    'folder' => basename(dirname($full)),
                    'bytes' => $file->getSize(),
                    'modified' => date('c', (int) $file->getMTime()),
                ];
            }
        }

        usort($out, static fn(array $a, array $b): int => strcmp($b['modified'], $a['modified']));
        return $out;
    }

    /** @return array<string, mixed> */
    private function uploadMedia(): array
    {
        if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'] ?? '')) {
            throw new \InvalidArgumentException('file upload required');
        }

        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException('Upload failed.');
        }

        $original = (string) ($file['name'] ?? 'upload.bin');
        $safe = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $original) ?: 'upload.bin';
        $safe = strtolower($safe);
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'mp4', 'webm', 'ogg', 'mov', 'm4v'];
        $ext = strtolower(pathinfo($safe, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed, true)) {
            throw new \InvalidArgumentException('Unsupported media type.');
        }

        $subdir = trim((string) ($_POST['folder'] ?? ''), '/');
        $subdir = preg_replace('/[^a-zA-Z0-9._\\/-]+/', '-', $subdir) ?? '';
        $subdir = str_replace('..', '', $subdir);

        $destDir = $this->realUserPath('media');
        if ($subdir !== '') {
            $destDir .= '/' . $subdir;
        }
        if (!is_dir($destDir) && !mkdir($destDir, 0755, true) && !is_dir($destDir)) {
            throw new \RuntimeException('Cannot create media directory.');
        }

        $dest = $destDir . '/' . $safe;
        if (is_file($dest)) {
            $safe = pathinfo($safe, PATHINFO_FILENAME) . '-' . substr(uniqid(), -5) . '.' . $ext;
            $dest = $destDir . '/' . $safe;
        }

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new \RuntimeException('Could not save upload.');
        }

        $urlPath = '/user/media';
        if ($subdir !== '') {
            $urlPath .= '/' . $subdir;
        }
        $urlPath .= '/' . $safe;

        return [
            'ok' => true,
            'url' => $urlPath,
            'name' => $safe,
            'bytes' => filesize($dest),
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function themePresets(): array
    {
        $presets = [
            'grav-official' => [
                'id' => 'grav-official',
                'label' => 'Grav Official',
                'description' => 'Default grav-mud-site — light, Andy-blue, flagship gravmud.site look.',
                'fields' => [
                    'name' => 'grav-official',
                    'layout' => 'promo',
                ],
                'tokens' => [],
                'swatch' => ['accent' => '#0082c0', 'bg' => '#f7f9fc'],
            ],
            'pizza-resistance' => [
                'id' => 'pizza-resistance',
                'label' => 'Pizza Resistance',
                'description' => 'EliteToolz.live energy — dark stone, orange accent, teal secondary.',
                'fields' => [
                    'name' => 'pizza-resistance',
                    'layout' => 'promo',
                ],
                'tokens' => [
                    'bg' => '#0c0a09',
                    'bg-card' => '#1c1917',
                    'text' => '#fafaf9',
                    'muted' => '#a8a29e',
                    'accent' => '#f97316',
                    'accent-glow' => '#fb923c',
                    'gold' => '#fbbf24',
                    'teal' => '#2dd4bf',
                    'border' => '#292524',
                ],
                'swatch' => ['accent' => '#f97316', 'bg' => '#0c0a09'],
            ],
            'midnight-ops' => [
                'id' => 'midnight-ops',
                'label' => 'Midnight Ops',
                'description' => 'Dev docs / CLI sim — slate background, sky accent.',
                'fields' => [
                    'name' => 'midnight-ops',
                    'layout' => 'promo',
                ],
                'tokens' => [
                    'bg' => '#0f172a',
                    'bg-card' => '#1e293b',
                    'text' => '#e2e8f0',
                    'muted' => '#94a3b8',
                    'accent' => '#38bdf8',
                    'accent-glow' => '#7dd3fc',
                    'gold' => '#fbbf24',
                    'teal' => '#2dd4bf',
                    'border' => '#334155',
                ],
                'swatch' => ['accent' => '#38bdf8', 'bg' => '#0f172a'],
            ],
            'agency-cli' => [
                'id' => 'agency-cli',
                'label' => 'Agency CLI',
                'description' => 'Elite CLI Toolz + Agency tier — cyan on dark, gold highlights.',
                'fields' => [
                    'name' => 'agency-cli',
                    'layout' => 'promo',
                ],
                'tokens' => [
                    'bg' => '#0c0a09',
                    'bg-card' => '#1c1917',
                    'text' => '#fafaf9',
                    'muted' => '#a8a29e',
                    'accent' => '#2dd4bf',
                    'accent-glow' => '#5eead4',
                    'gold' => '#fbbf24',
                    'teal' => '#38bdf8',
                    'border' => 'rgb(45 212 191 / 0.35)',
                ],
                'swatch' => ['accent' => '#2dd4bf', 'bg' => '#0c0a09'],
            ],
            'custom' => [
                'id' => 'custom',
                'label' => 'Custom (inline tokens)',
                'description' => 'Client one-off — tokens only, no preset class needed in your theme CSS.',
                'fields' => [
                    'name' => 'custom',
                    'layout' => 'promo',
                ],
                'tokens' => [
                    'bg' => '#1a0f2e',
                    'bg-card' => '#2d1b4e',
                    'text' => '#faf5ff',
                    'muted' => '#c4b5fd',
                    'accent' => '#e879f9',
                    'gold' => '#fde047',
                    'border' => '#6b21a8',
                ],
                'swatch' => ['accent' => '#e879f9', 'bg' => '#1a0f2e'],
            ],
        ];

        foreach ($presets as &$preset) {
            $preset['expoSource'] = $this->themeExpoSource(
                (string) $preset['id'],
                (string) ($preset['label'] ?? 'Theme'),
                (string) ($preset['description'] ?? ''),
                $preset['tokens'] ?? []
            );
        }
        unset($preset);

        return $presets;
    }

    /** @param array<string, string> $tokens */
    private function themeExpoSource(string $presetId, string $title, string $desc, array $tokens): string
    {
        $lines = [
            '::: theme',
            'title: ' . $title,
            'preset: ' . $presetId,
        ];
        if ($desc !== '') {
            $lines[] = 'desc: ' . $desc;
        }
        if ($tokens) {
            $lines[] = 'tokens: |';
            foreach ($tokens as $key => $value) {
                $lines[] = '  ' . $key . ' ' . $value;
            }
        }
        $lines[] = ':::';
        return implode("\n", $lines);
    }

    /** @return array<string, mixed> */
    private function readTheme(string $relPath): array
    {
        $page = $this->readPage($relPath);
        return [
            'ok' => true,
            'path' => $page['path'],
            'design' => $page['design'],
            'presets' => array_values($this->themePresets()),
        ];
    }

    /** @param array<string, mixed> $payload */
    private function applyTheme(array $payload): array
    {
        $relPath = (string) ($payload['path'] ?? '');
        if ($relPath === '') {
            throw new \InvalidArgumentException('path required');
        }

        $fields = $payload['fields'] ?? null;
        $tokens = $payload['tokens'] ?? null;
        if (!is_array($fields) || $fields === []) {
            $presetId = (string) ($payload['preset'] ?? '');
            $presets = $this->themePresets();
            if ($presetId === '' || !isset($presets[$presetId])) {
                throw new \InvalidArgumentException('preset or fields required');
            }
            $fields = $presets[$presetId]['fields'];
            if (!is_array($tokens)) {
                $tokens = $presets[$presetId]['tokens'] ?? [];
            }
        } elseif (!is_array($tokens)) {
            $tokens = $this->parseTokenString((string) ($fields['tokens'] ?? ''));
            unset($fields['tokens']);
        }

        $page = $this->readPage($relPath);
        $source = (string) $page['source'];
        $updated = $this->replaceDesignBlock($source, $fields, is_array($tokens) ? $tokens : []);

        return $this->writePage(['path' => $relPath, 'source' => $updated], false);
    }

    /** @param array<string, string> $fields */
    /** @param array<string, string> $tokens */
    private function replaceDesignBlock(string $source, array $fields, array $tokens = []): string
    {
        $lines = preg_split('/\r\n|\r|\n/', $source) ?: [];
        $parsed = $this->parseDesignBlock($source);
        $block = $this->formatDesignBlockLines($fields, $tokens);

        if (!empty($parsed['found'])) {
            $start = -1;
            $end = -1;
            for ($i = 0, $n = count($lines); $i < $n; $i++) {
                $trim = trim($lines[$i]);
                if ($trim !== '@@@' && !preg_match('/^@@@\s/', $trim)) {
                    continue;
                }
                if ($start === -1) {
                    $start = $i;
                    continue;
                }
                $end = $i;
                break;
            }
            if ($start >= 0 && $end > $start) {
                return implode("\n", array_merge(
                    array_slice($lines, 0, $start),
                    $block,
                    array_slice($lines, $end + 1)
                ));
            }
        }

        $insertAt = 0;
        for ($i = 0, $n = count($lines); $i < $n; $i++) {
            if (trim($lines[$i]) === '---') {
                $insertAt = $i + 1;
                break;
            }
        }
        while ($insertAt < count($lines) && trim($lines[$insertAt]) !== '---' && trim($lines[$insertAt]) !== '') {
            $insertAt++;
        }
        if ($insertAt < count($lines) && trim($lines[$insertAt]) === '---') {
            $insertAt++;
        }

        return implode("\n", array_merge(
            array_slice($lines, 0, $insertAt),
            [''],
            $block,
            [''],
            array_slice($lines, $insertAt)
        ));
    }

    /** @param array<string, string> $fields */
    /** @param array<string, string> $tokens */
    /** @return list<string> */
    private function formatDesignBlockLines(array $fields, array $tokens = []): array
    {
        $block = ['@@@'];
        foreach ($fields as $key => $value) {
            if ($key === '' || $key === 'tokens' || $value === '') {
                continue;
            }
            $block[] = $key . ': ' . $value;
        }
        if ($tokens) {
            $block[] = 'tokens:';
            foreach ($tokens as $key => $value) {
                if ($key === '' || $value === '') {
                    continue;
                }
                $block[] = '  ' . $key . ' ' . $value;
            }
        }
        $block[] = '@@@';
        return $block;
    }

    /** @return array<string, string> */
    private function parseTokenString(string $block): array
    {
        $tokens = [];
        foreach (preg_split('/\r?\n/', $block) as $line) {
            if (preg_match('/^(\S+)\s+(.+)$/', trim($line), $m)) {
                $tokens[$m[1]] = trim($m[2], "\"'");
            }
        }
        return $tokens;
    }

    /** @param array<string, mixed> $payload */
    private function previewTheme(array $payload): array
    {
        $presetId = (string) ($payload['preset'] ?? '');
        $presets = $this->themePresets();
        if ($presetId === '' || !isset($presets[$presetId])) {
            throw new \InvalidArgumentException('preset required');
        }

        $preset = $presets[$presetId];
        $source = (string) ($preset['expoSource'] ?? '');
        if ($source === '') {
            throw new \RuntimeException('Theme preview source missing.');
        }

        require_once GRAV_ROOT . '/user/plugins/grav-mud-alpha/classes/MudAlphaCompiler.php';
        $compiler = new \Grav\Plugin\GravMudAlpha\MudAlphaCompiler();
        $theme = $this->activeTheme();
        $compiler->setAssetBase($this->grav['base_url'] . '/user/themes/' . $theme . '/images');
        $html = $compiler->compile($source);
        $cssUrl = $this->grav['base_url'] . '/user/themes/' . $theme . '/css/grav-mud.css';

        return [
            'ok' => true,
            'preset' => $presetId,
            'html' => '<!DOCTYPE html><html><head><meta charset="utf-8">'
                . '<link rel="stylesheet" href="' . htmlspecialchars($cssUrl, ENT_QUOTES, 'UTF-8') . '">'
                . '<style>body{margin:0;padding:1rem;background:#111}.theme-expo-grid{display:block}</style>'
                . '</head><body><div class="theme-expo-grid">' . $html . '</div></body></html>',
        ];
    }

    /** @return array<string, mixed> */
    private function dashboardStats(): array
    {
        $pages = $this->listMudPages();
        $publishLog = $this->readPublishLog();
        $spark = $this->publishSparkline($publishLog, 7);
        $commentz = $this->commentzStats();
        $forumz = $this->forumzStats();

        return [
            'ok' => true,
            'pages' => count($pages),
            'media' => count($this->listMedia()),
            'disk' => [
                'userBytes' => $this->directorySize($this->realUserPath('')),
                'cacheBytes' => $this->directorySize($this->realUserPath('cache')),
            ],
            'commentz' => $commentz,
            'forumz' => $forumz,
            'publish' => [
                'total' => count($publishLog),
                'recent' => array_slice($publishLog, 0, 8),
                'sparkline' => $spark,
            ],
            'cache' => [
                'cleared' => $publishLog[0]['ts'] ?? null,
                'hint' => isset($this->grav['cache']) ? 'Grav cache active' : 'Cache unavailable',
            ],
            'rss' => [
                'feedCount' => count(array_filter($this->readRssFeeds(), static fn(array $f): bool => !empty($f['enabled']))),
            ],
        ];
    }

    private function appendPublishLog(string $path): void
    {
        if ($path === '') {
            return;
        }
        $log = $this->readPublishLog();
        array_unshift($log, [
            'path' => $path,
            'ts' => date('c'),
        ]);
        $log = array_slice($log, 0, 200);
        file_put_contents(
            $this->adminDataPath('publish-log.json'),
            json_encode($log, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    /** @return list<array<string, string>> */
    private function readPublishLog(): array
    {
        $file = $this->adminDataPath('publish-log.json');
        if (!is_file($file)) {
            return [];
        }
        $data = json_decode((string) file_get_contents($file), true);
        return is_array($data) ? $data : [];
    }

    /** @param list<array<string, string>> $log */
    /** @return list<int> */
    private function publishSparkline(array $log, int $days): array
    {
        $counts = array_fill(0, $days, 0);
        $now = time();
        foreach ($log as $entry) {
            $ts = strtotime($entry['ts'] ?? '');
            if ($ts === false) {
                continue;
            }
            $dayIndex = (int) floor(($now - $ts) / 86400);
            if ($dayIndex >= 0 && $dayIndex < $days) {
                $counts[$days - 1 - $dayIndex]++;
            }
        }
        return $counts;
    }

    /** @return array<string, int> */
    private function commentzStats(): array
    {
        $dir = $this->realUserPath('data/mud-commentz');
        $total = 0;
        $pending = 0;
        if (!is_dir($dir)) {
            return ['total' => 0, 'pending' => 0, 'threads' => 0];
        }
        $threads = 0;
        foreach (glob($dir . '/*.json') ?: [] as $file) {
            $threads++;
            $data = json_decode((string) file_get_contents($file), true);
            if (!is_array($data) || !isset($data['comments']) || !is_array($data['comments'])) {
                continue;
            }
            foreach ($data['comments'] as $comment) {
                $total++;
                if (empty($comment['approved'])) {
                    $pending++;
                }
            }
        }
        return ['total' => $total, 'pending' => $pending, 'threads' => $threads];
    }

    /** @return array<string, int> */
    private function forumzStats(): array
    {
        if (!$this->forumzInstalled()) {
            return ['boards' => 0, 'threads' => 0, 'posts' => 0, 'pending' => 0, 'profiles' => 0];
        }
        return $this->forumzStorage()->stats();
    }

    /** @return array<string, mixed> */
    private function forumzQueue(): array
    {
        if (!$this->forumzInstalled()) {
            return ['ok' => true, 'count' => 0, 'queue' => [], 'enabled' => false];
        }
        $data = $this->forumzStorage()->moderationQueue();
        $data['enabled'] = true;
        return $data;
    }

    /** @param array<string, mixed> $payload */
    /** @return array<string, mixed> */
    private function forumzModerate(array $payload): array
    {
        if (!$this->forumzInstalled()) {
            throw new \InvalidArgumentException('grav-mud-forumz not installed.');
        }
        return $this->forumzStorage()->moderate($payload);
    }

    /** @return array<string, mixed> */
    private function forumzProfiles(): array
    {
        if (!$this->forumzInstalled()) {
            return ['ok' => true, 'profiles' => [], 'enabled' => false];
        }
        $data = $this->forumzStorage()->adminListProfiles();
        $data['enabled'] = true;
        return $data;
    }

    private function forumzInstalled(): bool
    {
        return is_file(GRAV_ROOT . '/user/plugins/grav-mud-forumz/classes/MudForumzStorage.php');
    }

    private function forumzStorage(): \Grav\Plugin\GravMudForumz\MudForumzStorage
    {
        require_once GRAV_ROOT . '/user/plugins/grav-mud-forumz/classes/MudForumzStorage.php';
        return new \Grav\Plugin\GravMudForumz\MudForumzStorage($this->grav);
    }

    /** @return array<string, mixed> */
    private function readMenu(): array
    {
        require_once GRAV_ROOT . '/user/plugins/grav-mud-admin/classes/MudSiteMenu.php';
        $menu = new MudSiteMenu($this->grav);
        return [
            'ok' => true,
            'menu' => $menu->readRaw(),
            'preview' => $menu->forTwig(),
        ];
    }

    /** @param array<string, mixed> $payload */
    /** @return array<string, mixed> */
    private function writeMenu(array $payload): array
    {
        require_once GRAV_ROOT . '/user/plugins/grav-mud-admin/classes/MudSiteMenu.php';
        $menu = new MudSiteMenu($this->grav);
        $normalized = $menu->validateAndNormalize($payload);
        $menu->writeRaw($normalized);
        $this->clearCache();
        return [
            'ok' => true,
            'menu' => $menu->readRaw(),
            'preview' => $menu->forTwig(),
            'cache' => 'Cache cleared.',
        ];
    }

    /** @return array<string, mixed> */
    private function syncMenuFromPages(): array
    {
        require_once GRAV_ROOT . '/user/plugins/grav-mud-admin/classes/MudSiteMenu.php';
        $menu = new MudSiteMenu($this->grav);
        $synced = $menu->syncFromPages();
        $this->clearCache();
        return [
            'ok' => true,
            'menu' => $synced,
            'preview' => $menu->forTwig(),
            'cache' => 'Cache cleared.',
        ];
    }

    private function directorySize(string $path): int
    {
        if (!is_dir($path)) {
            return 0;
        }
        $size = 0;
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }
        return $size;
    }

    /** @return list<array<string, mixed>> */
    private function readRssFeeds(): array
    {
        $file = $this->adminDataPath('rss-feeds.json');
        if (!is_file($file)) {
            return [
                [
                    'id' => 'grav-blog',
                    'title' => 'Grav Blog',
                    'url' => 'https://getgrav.org/blog.rss',
                    'enabled' => true,
                ],
            ];
        }
        $data = json_decode((string) file_get_contents($file), true);
        if (!is_array($data)) {
            return [];
        }
        return isset($data['feeds']) && is_array($data['feeds']) ? $data['feeds'] : $data;
    }

    /** @param array<string, mixed> $payload */
    /** @return array<string, mixed> */
    private function writeRssFeeds(array $payload): array
    {
        $feeds = $payload['feeds'] ?? null;
        if (!is_array($feeds)) {
            throw new \InvalidArgumentException('feeds array required');
        }
        file_put_contents(
            $this->adminDataPath('rss-feeds.json'),
            json_encode(['feeds' => $feeds], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
        return ['ok' => true, 'feeds' => $feeds];
    }

    /** @param array<string, mixed> $payload */
    /** @return array<string, mixed> */
    private function previewRss(array $payload): array
    {
        $url = trim((string) ($payload['url'] ?? ''));
        if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
            throw new \InvalidArgumentException('Valid url required');
        }

        $ctx = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'GravMUD-Admin/1.0 EvvyTink',
            ],
        ]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false || $raw === '') {
            throw new \InvalidArgumentException('Could not fetch feed.');
        }

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($raw);
        if ($xml === false) {
            throw new \InvalidArgumentException('Invalid RSS/Atom XML.');
        }

        $items = [];
        if (isset($xml->channel->item)) {
            foreach ($xml->channel->item as $item) {
                $items[] = [
                    'title' => trim((string) ($item->title ?? '')),
                    'link' => trim((string) ($item->link ?? '')),
                    'date' => trim((string) ($item->pubDate ?? '')),
                ];
                if (count($items) >= 8) {
                    break;
                }
            }
        } elseif (isset($xml->entry)) {
            foreach ($xml->entry as $entry) {
                $link = '';
                if (isset($entry->link['href'])) {
                    $link = (string) $entry->link['href'];
                }
                $items[] = [
                    'title' => trim((string) ($entry->title ?? '')),
                    'link' => $link,
                    'date' => trim((string) ($entry->updated ?? $entry->published ?? '')),
                ];
                if (count($items) >= 8) {
                    break;
                }
            }
        }

        return [
            'ok' => true,
            'url' => $url,
            'title' => trim((string) ($xml->channel->title ?? $xml->title ?? 'Feed')),
            'items' => $items,
        ];
    }

    private function activeTheme(): string
    {
        return (string) $this->grav['config']->get('system.pages.theme', 'grav-mud-site');
    }

    private function themeImagesPath(): string
    {
        return $this->realUserPath('themes/' . $this->activeTheme() . '/images');
    }

    /** @return list<array<string, mixed>> */
    private function defaultDashboardWidgets(): array
    {
        return [
            [
                'id' => 'sys-pages',
                'title' => 'MUD Pages',
                'type' => 'system',
                'kind' => 'stat-spark',
                'stat' => 'pages',
                'width' => 1,
                'enabled' => true,
            ],
            [
                'id' => 'sys-media',
                'title' => 'Media library',
                'type' => 'system',
                'kind' => 'stat',
                'stat' => 'media',
                'width' => 1,
                'enabled' => true,
            ],
            [
                'id' => 'sys-commentz',
                'title' => 'Commentz',
                'type' => 'system',
                'kind' => 'stat',
                'stat' => 'commentz',
                'width' => 1,
                'enabled' => true,
            ],
            [
                'id' => 'sys-forumz',
                'title' => 'Forumz',
                'type' => 'system',
                'kind' => 'stat',
                'stat' => 'forumz',
                'width' => 1,
                'enabled' => true,
            ],
            [
                'id' => 'sys-disk',
                'title' => 'Disk · user/',
                'type' => 'system',
                'kind' => 'disk',
                'width' => 1,
                'enabled' => true,
            ],
            [
                'id' => 'sys-publish',
                'title' => 'Recent publishes',
                'type' => 'system',
                'kind' => 'list-publish',
                'width' => 1,
                'enabled' => true,
            ],
            [
                'id' => 'sys-rss',
                'title' => 'RSS headlines',
                'type' => 'system',
                'kind' => 'list-rss',
                'width' => 1,
                'enabled' => true,
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    private function readDashboardWidgets(): array
    {
        $file = $this->adminDataPath('dashboard-widgets.json');
        if (!is_file($file)) {
            return $this->defaultDashboardWidgets();
        }
        $data = json_decode((string) file_get_contents($file), true);
        if (!is_array($data) || !isset($data['widgets']) || !is_array($data['widgets'])) {
            return $this->defaultDashboardWidgets();
        }
        return $data['widgets'];
    }

    /** @return array<string, mixed> */
    private function readDashboard(): array
    {
        $widgets = $this->readDashboardWidgets();
        $stats = $this->dashboardStats();
        unset($stats['ok']);

        $rendered = [];
        foreach ($widgets as $widget) {
            if (empty($widget['enabled'])) {
                continue;
            }
            if (($widget['type'] ?? '') === 'mud' && !empty($widget['mud'])) {
                try {
                    $rendered[(string) $widget['id']] = $this->compileWidgetMud((string) $widget['mud']);
                } catch (\Throwable $e) {
                    $rendered[(string) $widget['id']] = '<p class="mud-widget-error">Compile error</p>';
                }
            }
        }

        return [
            'ok' => true,
            'widgets' => $widgets,
            'stats' => $stats,
            'rendered' => $rendered,
        ];
    }

    /** @param array<string, mixed> $payload */
    /** @return array<string, mixed> */
    private function writeDashboard(array $payload): array
    {
        $widgets = $payload['widgets'] ?? null;
        if (!is_array($widgets)) {
            throw new \InvalidArgumentException('widgets array required');
        }

        foreach ($widgets as $i => $widget) {
            if (!is_array($widget) || empty($widget['id'])) {
                throw new \InvalidArgumentException('Each widget needs an id');
            }
            $widgets[$i]['enabled'] = !isset($widget['enabled']) || $widget['enabled'];
            $widgets[$i]['width'] = (int) ($widget['width'] ?? 1) === 2 ? 2 : 1;
        }

        file_put_contents(
            $this->adminDataPath('dashboard-widgets.json'),
            json_encode(['widgets' => $widgets, 'updated' => date('c')], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );

        return $this->readDashboard();
    }

    /** @param array<string, mixed> $payload */
    /** @return array<string, mixed> */
    private function renderWidgetMud(array $payload): array
    {
        $mud = (string) ($payload['mud'] ?? '');
        if ($mud === '') {
            throw new \InvalidArgumentException('mud source required');
        }

        return [
            'ok' => true,
            'html' => $this->compileWidgetMud($mud),
        ];
    }

    private function compileWidgetMud(string $mud): string
    {
        $stats = $this->dashboardStats();
        unset($stats['ok']);
        $mud = $this->interpolateWidgetMud($mud, $stats);

        $wrapper = "@@@\nname: grav-official\nlayout: promo\naccent: #5eead4\nbg: #1a2332\n@@@\n\n"
            . "<div class=\"mud-admin-widget-body\">\n"
            . $mud . "\n"
            . "</div>";

        require_once GRAV_ROOT . '/user/plugins/grav-mud-alpha/classes/MudAlphaCompiler.php';
        $compiler = new \Grav\Plugin\GravMudAlpha\MudAlphaCompiler();
        $theme = $this->activeTheme();
        $compiler->setAssetBase($this->grav['base_url'] . '/user/themes/' . $theme . '/images');

        $html = $compiler->compile($wrapper);
        if (preg_match('/<div class="mud-admin-widget-body">(.*)<\/div>\s*<\/div>\s*$/s', $html, $m)) {
            return $m[1];
        }

        return $html;
    }

    /** @param array<string, mixed> $stats */
    private function interpolateWidgetMud(string $mud, array $stats): string
    {
        $flat = [
            'stats.pages' => (string) ($stats['pages'] ?? 0),
            'stats.media' => (string) ($stats['media'] ?? 0),
            'stats.commentz.total' => (string) ($stats['commentz']['total'] ?? 0),
            'stats.commentz.pending' => (string) ($stats['commentz']['pending'] ?? 0),
            'stats.forumz.threads' => (string) ($stats['forumz']['threads'] ?? 0),
            'stats.forumz.pending' => (string) ($stats['forumz']['pending'] ?? 0),
            'stats.forumz.profiles' => (string) ($stats['forumz']['profiles'] ?? 0),
            'stats.disk.user' => $this->formatBytesShort((int) ($stats['disk']['userBytes'] ?? 0)),
            'stats.publish.total' => (string) ($stats['publish']['total'] ?? 0),
            'site.name' => (string) $this->grav['config']->get('site.title', 'GravMUD Site'),
        ];

        return preg_replace_callback('/\{\{\s*([a-z0-9._-]+)\s*\}\}/i', static function (array $m) use ($flat): string {
            return $flat[$m[1]] ?? $m[0];
        }, $mud) ?? $mud;
    }

    private function formatBytesShort(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes . ' B';
        }
        if ($bytes < 1048576) {
            return round($bytes / 1024, 1) . ' KB';
        }
        return round($bytes / 1048576, 1) . ' MB';
    }

    private function queryFenceName(): ?string
    {
        $fence = trim((string) ($_GET['fence'] ?? ''));
        return $fence !== '' ? strtolower($fence) : null;
    }

    /** @return array<string, mixed> */
    private function specReference(?string $fence): array
    {
        $catalog = $this->fenceSpecCatalog();
        if ($fence === null) {
            return [
                'ok' => true,
                'fences' => array_map(static fn(array $entry): array => [
                    'fence' => $entry['fence'],
                    'label' => $entry['label'],
                    'description' => $entry['description'],
                ], $catalog),
                'tokens' => $this->designTokenReference(),
            ];
        }

        foreach ($catalog as $entry) {
            if ($entry['fence'] === $fence) {
                return [
                    'ok' => true,
                    'fence' => $entry['fence'],
                    'label' => $entry['label'],
                    'description' => $entry['description'],
                    'snippet' => $entry['snippet'],
                    'tokens' => $this->designTokenReference(),
                ];
            }
        }

        throw new \InvalidArgumentException('Unknown fence: ' . $fence);
    }

    /** @return array<string, string> */
    private function designTokenReference(): array
    {
        return [
            'block' => '@@@ opens/closes a design token block (name, layout, theme tokens)',
            'example' => <<<MUD
@@@
name: grav-official
layout: promo
accent: #7c3aed
@@@
MUD,
        ];
    }

    /** @return list<array<string, string>> */
    private function fenceSpecCatalog(): array
    {
        return [
            [
                'fence' => 'hero',
                'label' => 'Hero',
                'description' => 'Eyebrow, title, accent, lead, optional CTA',
                'snippet' => <<<MUD
::: hero
eyebrow: FutureVision Labs
title: Grav
accent: MUD
lead: One file. Full section. Compile-safe for agents.
cta: Get started
cta-href: /get-started
:::
MUD,
            ],
            [
                'fence' => 'manifesto',
                'label' => 'Manifesto',
                'description' => 'Title, body (markdown), signoff',
                'snippet' => <<<MUD
::: manifesto
title: Widgets are spec
body: |
  If it fits in a `::: fence`, it fits on your dashboard.
signoff: FutureVision Labs · Team DC
:::
MUD,
            ],
            [
                'fence' => 'quote',
                'label' => 'Quote',
                'description' => 'Pull quote with author',
                'snippet' => <<<MUD
::: quote
author: Kersey D. Wry
text: Dashboard widgets in `.mud`? *Chef's kiss.*
:::
MUD,
            ],
            [
                'fence' => 'cards',
                'label' => 'Cards',
                'description' => 'YAML list of title/body cards',
                'snippet' => <<<MUD
::: cards
- title: Pages
  body: `.mud` files under user/pages
- title: Media
  body: Images from user/pages/**/media
- title: Publish
  body: Save + cache clear via EvvyTink
:::
MUD,
            ],
            [
                'fence' => 'badges',
                'label' => 'Badges',
                'description' => 'Inline badge row (YAML list or plain lines)',
                'snippet' => <<<MUD
::: badges
- EvvyTink v1.5
- Admin2 native
- MCP Copilot ready
:::
MUD,
            ],
            [
                'fence' => 'gallery',
                'label' => 'Gallery',
                'description' => 'Image grid; optional lightbox and columns attribute',
                'snippet' => <<<MUD
::: gallery columns="3" lightbox="true"
title: Ship gallery
- src: /user/pages/home/media/hero.jpg
  caption: Hero still
  alt: Hero image
- src: /user/pages/home/media/deck.jpg
  caption: Command deck
:::
MUD,
            ],
            [
                'fence' => 'carousel',
                'label' => 'Carousel',
                'description' => 'Slideshow; variant=3d for coverflow; autoplay in seconds',
                'snippet' => <<<MUD
::: carousel autoplay="5" aspect="16/9"
title: Featured shots
- src: /user/pages/home/media/slide-1.jpg
  caption: Slide one
- src: /user/pages/home/media/slide-2.jpg
  caption: Slide two
:::
MUD,
            ],
            [
                'fence' => 'pricing',
                'label' => 'Pricing',
                'description' => 'Tier table for product pages',
                'snippet' => <<<MUD
::: pricing
title: GravMUD Admin
- name: Site license
  price: $49
  period: one-time
  features:
    - EvvyTink editor
    - Admin2 shell
    - MCP Copilot tools
:::
MUD,
            ],
            [
                'fence' => 'timeline',
                'label' => 'Timeline',
                'description' => 'Chronological events list',
                'snippet' => <<<MUD
::: timeline
- date: 2026-05
  title: Admin2 shell shipped
  body: EvvyTink web component + API bridge
- date: 2026-06
  title: MUD Copilot via MCP
  body: grav-mcp-mud tools registered
:::
MUD,
            ],
            [
                'fence' => 'video',
                'label' => 'Video',
                'description' => 'Embedded video block (src or YouTube URL)',
                'snippet' => <<<MUD
::: video
title: EvvyTink walkthrough
src: https://www.youtube.com/watch?v=dQw4w9WgXcQ
poster: /user/pages/home/media/poster.jpg
:::
MUD,
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    private function widgetTemplates(): array
    {
        return [
            [
                'id' => 'hero-ship',
                'label' => 'Hero · Ship status',
                'fence' => 'hero',
                'description' => 'Big headline + lead — great for command center vibes',
                'mud' => <<<MUD
::: hero
title: {{site.name}}
lead: **{{stats.pages}}** MUD pages live · EvvyTink standing by.
cta: Open Pages
cta-href: #/pages
:::
MUD,
            ],
            [
                'id' => 'manifesto-dc',
                'label' => 'Manifesto',
                'fence' => 'manifesto',
                'description' => 'Team DC sign-off block',
                'mud' => <<<MUD
::: manifesto
title: Widgets are spec
body: |
  If it fits in a `::: fence`, it fits on your dashboard.
  **{{stats.media}}** assets · **{{stats.commentz.total}}** tribbles in Commentz.
signoff: FutureVision Labs · Team DC
:::
MUD,
            ],
            [
                'id' => 'quote-cursy',
                'label' => 'Quote',
                'fence' => 'quote',
                'description' => 'Pull quote callout',
                'mud' => <<<MUD
::: quote
author: Kersey D. Wry
text: Dashboard widgets in `.mud`? *Chef's kiss.* Ship it.
:::
MUD,
            ],
            [
                'id' => 'cards-stats',
                'label' => 'Cards · Quick stats',
                'fence' => 'cards',
                'description' => 'Three-up stat cards',
                'mud' => <<<MUD
::: cards
- title: Pages
  body: {{stats.pages}} `.mud` files
- title: Media
  body: {{stats.media}} images indexed
- title: Commentz
  body: {{stats.commentz.pending}} pending review
:::
MUD,
            ],
            [
                'id' => 'badges-ship',
                'label' => 'Badges',
                'fence' => 'badges',
                'description' => 'Badge row for milestones',
                'mud' => <<<MUD
::: badges
- EvvyTink v1.1
- {{stats.pages}} pages
- {{stats.disk.user}} disk
:::
MUD,
            ],
            [
                'id' => 'stat-inline',
                'label' => 'Stat · Custom MUD',
                'fence' => 'hero',
                'description' => 'Minimal stat hero — edit numbers via {{tokens}}',
                'mud' => <<<MUD
::: hero
title: {{stats.publish.total}}
lead: Total publishes logged · disk **{{stats.disk.user}}**
:::
MUD,
            ],
            [
                'id' => 'system-stat',
                'label' => 'System · Stat card',
                'fence' => 'system',
                'description' => 'Native sparkline / number widget',
                'type' => 'system',
                'kind' => 'stat-spark',
                'stat' => 'pages',
            ],
            [
                'id' => 'system-list',
                'label' => 'System · Publish list',
                'fence' => 'system',
                'description' => 'Recent publish activity panel',
                'type' => 'system',
                'kind' => 'list-publish',
            ],
        ];
    }

    /** @param array<string, mixed> $data */
    private function respond(array $data): void
    {
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function fail(string $message, int $code): void
    {
        if (!$this->bridgeMode) {
            http_response_code($code);
        }
        echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    }
}

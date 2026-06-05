<?php

namespace Grav\Plugin\GravMudAdmin;

use Grav\Common\Grav;

/**
 * Routes /mud-admin SPA and /api/mud-admin/* JSON API.
 */
class MudAdminRouter
{
    private Grav $grav;
    /** @var array<string, mixed> */
    private array $config;

    /** @param array<string, mixed> $config */
    public function __construct(Grav $grav, array $config)
    {
        $this->grav = $grav;
        $this->config = $config;
    }

    public function handle(): void
    {
        $path = trim((string) $this->grav['uri']->path(), '/');
        $apiPrefix = trim((string) ($this->config['api_prefix'] ?? 'api/mud-admin'), '/');
        $uiPrefix = trim((string) ($this->config['route_prefix'] ?? 'mud-admin'), '/');

        if ($path === $apiPrefix || str_starts_with($path, $apiPrefix . '/')) {
            if (class_exists(\Grav\Plugin\Api\ApiRouteCollector::class)) {
                return;
            }
            require_once __DIR__ . '/MudAdminApi.php';
            (new MudAdminApi($this->grav, $this->config))->handle($path, $apiPrefix);
            exit;
        }

        if ($path === $uiPrefix || str_starts_with($path, $uiPrefix . '/')) {
            $this->serveAdminShell();
            exit;
        }
    }

    private function serveAdminShell(): void
    {
        $index = __DIR__ . '/../admin/index.html';
        if (!is_file($index)) {
            http_response_code(503);
            header('Content-Type: text/plain; charset=UTF-8');
            echo "GravMUD Admin shell missing.\n";
            return;
        }

        $html = (string) file_get_contents($index);
        $apiBase = '/' . trim((string) ($this->config['api_prefix'] ?? 'api/mud-admin'), '/');
        $inject = '<script>window.GRAVMUD_API_BASE=' . json_encode($apiBase, JSON_UNESCAPED_SLASHES) . ';</script>';
        if (str_contains($html, '</head>')) {
            $html = str_replace('</head>', $inject . "\n</head>", $html);
        }

        header('Content-Type: text/html; charset=UTF-8');
        header('X-Frame-Options: SAMEORIGIN');
        echo $html;
    }
}

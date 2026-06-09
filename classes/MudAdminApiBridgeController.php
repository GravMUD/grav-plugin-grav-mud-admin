<?php

declare(strict_types=1);

namespace Grav\Plugin\GravMudAdmin;

use Grav\Framework\Psr7\Response;
use Grav\Plugin\Api\Controllers\AbstractApiController;
use Grav\Plugin\Api\Response\ApiResponse;
use Grav\Plugin\Api\Response\ErrorResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use RocketTheme\Toolbox\File\YamlFile;

/**
 * Grav 2.0 bridge: MudAdminApi under /api/v1/mud-admin via onApiRegisterRoutes.
 */
class MudAdminApiBridgeController extends AbstractApiController
{
    public function config(ServerRequestInterface $request): ResponseInterface
    {
        if ($request->getMethod() === 'OPTIONS') {
            return new Response(204);
        }

        if ($request->getMethod() === 'GET') {
            $this->requirePermission($request, 'api.config.read');
            return ApiResponse::create($this->readConfig());
        }

        if ($request->getMethod() === 'PATCH') {
            $this->requirePermission($request, 'api.config.write');
            $body = $this->getRequestBody($request);
            $this->writeConfig($body);
            return ApiResponse::create($this->readConfig());
        }

        return ErrorResponse::create(405, 'Method Not Allowed', 'Use GET or PATCH');
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $method = strtoupper($request->getMethod());
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $this->requirePermission($request, 'api.system.write');
        } else {
            $this->requirePermission($request, 'api.access');
        }

        $params = $request->getAttribute('route_params', []);
        $sub = $this->resolveMudAdminSubpath($request, $params);

        parse_str($request->getUri()->getQuery(), $query);
        foreach ($query as $key => $value) {
            if (is_string($key)) {
                $_GET[$key] = $value;
            }
        }

        $auth = $request->getHeaderLine('Authorization');
        if ($auth !== '') {
            $_SERVER['HTTP_AUTHORIZATION'] = $auth;
        }
        $mudToken = $request->getHeaderLine('X-Mud-Admin-Token');
        if ($mudToken !== '') {
            $_SERVER['HTTP_X_MUD_ADMIN_TOKEN'] = $mudToken;
        }

        $cfg = (array) $this->config->get('plugins.grav-mud-admin', []);
        $path = 'mud-admin' . ($sub !== '' ? '/' . $sub : '');

        require_once __DIR__ . '/MudAdminApi.php';
        $api = new MudAdminApi($this->grav, $cfg);
        $api->setBridgeMode(true);

        $parsed = $request->getParsedBody();
        if (is_array($parsed)) {
            $api->setJsonBodyOverride($parsed);
        } else {
            $raw = (string) $request->getBody();
            if ($raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    $api->setJsonBodyOverride($decoded);
                }
            }
        }

        if ($method === 'OPTIONS') {
            return new Response(204);
        }

        $_SERVER['REQUEST_METHOD'] = $method;

        $level = ob_get_level();
        ob_start();
        try {
            $api->handle($path, 'mud-admin');
        } finally {
            $output = (string) ob_get_clean();
            while (ob_get_level() > $level) {
                ob_end_clean();
            }
        }

        $code = 200;
        $decoded = json_decode($output, true);
        if (!is_array($decoded)) {
            return ApiResponse::create(['ok' => false, 'error' => 'Invalid MUD admin response'], 500);
        }

        if (($decoded['ok'] ?? null) === false) {
            $error = strtolower((string) ($decoded['error'] ?? ''));
            $code = match (true) {
                str_contains($error, 'unauthorized') => 401,
                str_contains($error, 'not found') => 404,
                str_contains($error, 'required') || str_contains($error, 'invalid') => 400,
                str_contains($error, 'tribble') => 500,
                default => 400,
            };

            return ApiResponse::create($decoded, $code);
        }

        if ($output === '') {
            return ApiResponse::create(null, 204);
        }

        return ApiResponse::create($decoded, $code);
    }

    /**
     * Explicit FastRoute entries (e.g. /mud-admin/pages) do not populate {subpath}.
     *
     * @param array<string, mixed> $params
     */
    private function resolveMudAdminSubpath(ServerRequestInterface $request, array $params): string
    {
        if (isset($params['subpath'])) {
            return trim((string) $params['subpath'], '/');
        }

        $route = $request->getAttribute('route');
        $path = $route ? (string) $route->getRoute() : $request->getUri()->getPath();
        $base = $this->config->get('plugins.api.route', '/api');
        $prefix = $this->config->get('plugins.api.version_prefix', 'v1');
        $apiMud = '/' . trim($base, '/') . '/' . $prefix . '/mud-admin';
        if (str_starts_with($path, $apiMud)) {
            return trim(substr($path, strlen($apiMud)), '/');
        }
        if (preg_match('#/mud-admin(?:/(.+))?$#', $path, $m)) {
            return trim((string) ($m[1] ?? ''), '/');
        }

        return '';
    }

    /** @return array<string, mixed> */
    private function readConfig(): array
    {
        $cfg = (array) $this->config->get('plugins.grav-mud-admin', []);

        return [
            'enabled' => (bool) ($cfg['enabled'] ?? false),
            'route_prefix' => (string) ($cfg['route_prefix'] ?? 'mud-admin'),
            'api_prefix' => (string) ($cfg['api_prefix'] ?? 'api/mud-admin'),
            'access_token' => (string) ($cfg['access_token'] ?? ''),
            'require_alpha' => (bool) ($cfg['require_alpha'] ?? true),
        ];
    }

    /** @param array<string, mixed> $patch */
    private function writeConfig(array $patch): void
    {
        $allowed = ['enabled', 'route_prefix', 'api_prefix', 'access_token', 'require_alpha'];
        $current = $this->readConfig();

        foreach ($allowed as $key) {
            if (!array_key_exists($key, $patch)) {
                continue;
            }
            $current[$key] = $patch[$key];
        }

        $path = $this->grav['locator']->findResource('user://config/plugins', true, true);
        if (!$path) {
            throw new \RuntimeException('Unable to resolve plugin config path.');
        }

        $file = YamlFile::instance($path . '/grav-mud-admin.yaml');
        $data = $file->exists() ? (array) $file->content() : [];
        $data['enabled'] = filter_var($current['enabled'], FILTER_VALIDATE_BOOLEAN);
        $data['route_prefix'] = trim((string) $current['route_prefix'], '/');
        $data['api_prefix'] = trim((string) $current['api_prefix'], '/');
        $data['access_token'] = (string) $current['access_token'];
        $data['require_alpha'] = filter_var($current['require_alpha'], FILTER_VALIDATE_BOOLEAN);
        $file->save($data);
        $file->free();

        $this->config->reload();
    }
}

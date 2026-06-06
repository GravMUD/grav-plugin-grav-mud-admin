<?php

namespace Grav\Plugin;

use Grav\Common\Plugin;
use Grav\Plugin\GravMudAdmin\MudAdminApiBridgeController;
use Grav\Plugin\GravMudAdmin\MudAdminRouter;
use Grav\Plugin\GravMudAdmin\MudPluginCapabilities;
use RocketTheme\Toolbox\Event\Event;

class GravMudAdminPlugin extends Plugin
{
    public static function getSubscribedEvents(): array
    {
        $events = [
            'onPluginsInitialized' => [['onPluginsInitializedEarly', 100000]],
            'onPagesInitialized' => ['onPagesInitialized', 0],
            'onPageNotFound' => ['onPagesInitialized', 0],
            'onTwigSiteVariables' => ['onTwigSiteVariables', 0],
            'onTwigTemplatePaths' => ['onTwigTemplatePaths', 0],
        ];

        if (self::supportsGravApiBridge()) {
            $events['onApiRegisterRoutes'] = ['onApiRegisterRoutes', 0];
            $events['onApiSidebarItems'] = ['onApiSidebarItems', 0];
            $events['onApiPluginPageInfo'] = ['onApiPluginPageInfo', 0];
            $events['onApiAdminSettingsPanels'] = ['onApiAdminSettingsPanels', 0];
        }

        return $events;
    }

    /**
     * Grav 2.0: serve EvvyTink before admin2 bootstrap hijacks non-/admin routes.
     */
    public function onPluginsInitializedEarly(): void
    {
        if (!$this->isEnabled() || !self::supportsGravApiBridge()) {
            return;
        }

        require_once __DIR__ . '/classes/MudAdminApiBridgeController.php';
        require_once __DIR__ . '/classes/MudAdminApi.php';
        require_once __DIR__ . '/classes/MudAdminRouter.php';
        $cfg = (array) $this->grav['config']->get('plugins.grav-mud-admin', []);
        $uiPrefix = trim((string) ($cfg['route_prefix'] ?? 'mud-admin'), '/');
        $path = trim((string) $this->grav['uri']->path(), '/');

        if ($path === $uiPrefix || str_starts_with($path, $uiPrefix . '/')) {
            (new MudAdminRouter($this->grav, $cfg))->handle();
        }
    }

    public function onPagesInitialized(): void
    {
        if (!$this->isEnabled()) {
            return;
        }

        require_once __DIR__ . '/classes/MudAdminRouter.php';
        $cfg = (array) $this->grav['config']->get('plugins.grav-mud-admin', []);
        (new MudAdminRouter($this->grav, $cfg))->handle();
    }

    public function onApiRegisterRoutes(Event $event): void
    {
        if (!$this->isEnabled()) {
            return;
        }

        require_once __DIR__ . '/classes/MudAdminApiBridgeController.php';

        $routes = $event['routes'];
        $controller = [MudAdminApiBridgeController::class, 'handle'];

        $routes->addRoute(['GET', 'PATCH', 'OPTIONS'], '/mud-admin/config', [MudAdminApiBridgeController::class, 'config']);
        $routes->addRoute(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '/mud-admin', $controller);
        $routes->addRoute(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '/mud-admin/{subpath:.+}', $controller);
    }

    public function onApiSidebarItems(Event $event): void
    {
        if (!$this->isEnabled() || !$this->canUseAdmin2($event['user'] ?? null)) {
            return;
        }

        require_once __DIR__ . '/classes/MudPluginCapabilities.php';

        $items = $event['items'] ?? [];
        $items[] = [
            'id' => 'grav-mud-admin-dashboard',
            'plugin' => 'grav-mud-admin',
            'label' => 'Dashboard',
            'icon' => 'fa-gauge-high',
            'route' => '/plugin/grav-mud-admin#dashboard',
            'priority' => 89,
        ];
        $items[] = [
            'id' => 'grav-mud-admin',
            'plugin' => 'grav-mud-admin',
            'label' => 'EvvyTink',
            'icon' => 'fa-wand-magic-sparkles',
            'route' => '/plugin/grav-mud-admin#editor',
            'priority' => 88,
        ];
        $items[] = [
            'id' => 'grav-mud-admin-feeds',
            'plugin' => 'grav-mud-admin',
            'label' => 'RSS Feeds',
            'icon' => 'fa-rss',
            'route' => '/plugin/grav-mud-admin#feeds',
            'priority' => 85,
        ];
        $items[] = [
            'id' => 'grav-mud-admin-menus',
            'plugin' => 'grav-mud-admin',
            'label' => 'MUD Menus',
            'icon' => 'fa-bars',
            'route' => '/plugin/grav-mud-admin#menus',
            'priority' => 87,
        ];
        if (MudPluginCapabilities::installed('grav-mud-forumz')) {
            $items[] = [
                'id' => 'grav-mud-admin-forumz',
                'plugin' => 'grav-mud-admin',
                'label' => 'Forumz Mod',
                'icon' => 'fa-comments',
                'route' => '/plugin/grav-mud-admin#forumz',
                'priority' => 86,
            ];
        }
        $event['items'] = $items;
    }

    public function onApiPluginPageInfo(Event $event): void
    {
        if (!$this->isEnabled() || ($event['plugin'] ?? '') !== 'grav-mud-admin') {
            return;
        }

        if (!$this->canUseAdmin2($event['user'] ?? null)) {
            return;
        }

        $event['definition'] = [
            'id' => 'grav-mud-admin',
            'plugin' => 'grav-mud-admin',
            'title' => 'EvvyTink',
            'icon' => 'fa-wand-magic-sparkles',
            'page_type' => 'component',
        ];
    }

    public function onApiAdminSettingsPanels(Event $event): void
    {
        if (!$this->isEnabled() || !$this->canUseAdmin2($event['user'] ?? null, true)) {
            return;
        }

        $panels = $event['panels'] ?? [];
        $panels[] = [
            'id' => 'grav-mud-admin',
            'plugin' => 'grav-mud-admin',
            'label' => 'GravMUD Admin',
            'description' => 'EvvyTink route prefix, API token, alpha requirement',
            'icon' => 'fa-edit',
            'blueprint' => 'grav-mud-admin-settings',
            'data_endpoint' => '/mud-admin/config',
            'save_endpoint' => '/mud-admin/config',
            'priority' => 14,
        ];
        $event['panels'] = $panels;
    }

    public function onTwigSiteVariables(): void
    {
        if (!$this->isEnabled()) {
            return;
        }

        require_once __DIR__ . '/classes/MudSiteMenu.php';
        $menu = (new MudSiteMenu($this->grav))->forTwig();
        $this->grav['twig']->twig_vars['mud_menu'] = $menu;
    }

    public function onTwigTemplatePaths(): void
    {
        if (!$this->isEnabled()) {
            return;
        }

        $this->grav['twig']->twig_paths[] = __DIR__ . '/templates';
    }

    private function isEnabled(): bool
    {
        return (bool) $this->grav['config']->get('plugins.grav-mud-admin.enabled', false);
    }

    /** @param mixed $user */
    private function canUseAdmin2($user, bool $settings = false): bool
    {
        if (!$user || !is_object($user) || !method_exists($user, 'get')) {
            return false;
        }

        if ($user->get('access.api.super')) {
            return true;
        }

        if ($settings) {
            return (bool) ($user->get('access.api.config.read') || $user->get('access.api.config.write'));
        }

        return (bool) ($user->get('access.api.access') || $user->get('access.api.system.read'));
    }

    private static function supportsGravApiBridge(): bool
    {
        return class_exists(\Grav\Plugin\Api\ApiRouteCollector::class);
    }
}

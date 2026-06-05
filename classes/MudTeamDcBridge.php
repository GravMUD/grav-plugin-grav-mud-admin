<?php

declare(strict_types=1);

namespace Grav\Plugin\GravMudAdmin;

use Grav\Common\Grav;

/**
 * Team DC plugin API shims via mud-admin/{subpath} (works without route-cache refresh).
 *
 * @return array<string, mixed>|null JSON payload, or raw body keys body + content_type
 */
final class MudTeamDcBridge
{
    public static function resolve(Grav $grav, string $sub, string $method): ?array
    {
        if ($sub === 'javabean/theme.css' && $method === 'GET') {
            return [
                'body' => self::javabeanThemeCss($grav),
                'content_type' => 'text/css; charset=UTF-8',
            ];
        }

        if ($sub === 'javabean/presets' && $method === 'GET') {
            return self::javabeanPresets($grav);
        }

        if ($sub === 'operator-dock/launchpad' && $method === 'GET') {
            return self::operatorLaunchpad($grav);
        }

        return null;
    }

    private static function javabeanRoot(): string
    {
        return GRAV_ROOT . '/user/plugins/javabean-admin2';
    }

    private static function javabeanEnabled(Grav $grav): bool
    {
        return is_dir(self::javabeanRoot())
            && (bool) $grav['config']->get('plugins.javabean-admin2.enabled', false);
    }

    /** @return array<string, mixed> */
    private static function javabeanPresets(Grav $grav): array
    {
        if (!self::javabeanEnabled($grav)) {
            return ['ok' => false, 'error' => 'javabean-admin2 not available'];
        }

        require_once self::javabeanRoot() . '/classes/JavaBeanFontCatalog.php';
        require_once self::javabeanRoot() . '/classes/JavaBeanPresetRegistry.php';
        require_once self::javabeanRoot() . '/classes/JavaBeanThemeEngine.php';

        $engine = new \Grav\Plugin\JavaBeanAdmin2\JavaBeanThemeEngine();

        return [
            'ok' => true,
            'presets' => $engine->presetsForClient(),
            'fonts' => \Grav\Plugin\JavaBeanAdmin2\JavaBeanFontCatalog::forClient(),
        ];
    }

    private static function javabeanThemeCss(Grav $grav): string
    {
        if (!self::javabeanEnabled($grav)) {
            return '/* javabean-admin2 not enabled */';
        }

        require_once self::javabeanRoot() . '/classes/JavaBeanLegacy.php';
        require_once self::javabeanRoot() . '/classes/JavaBeanPresetRegistry.php';
        require_once self::javabeanRoot() . '/classes/JavaBeanThemeEngine.php';

        $cfg = \Grav\Plugin\JavaBeanAdmin2\JavaBeanLegacy::config($grav);
        if (!empty($_GET['preset'])) {
            $cfg['active_preset'] = (string) $_GET['preset'];
        }

        return (new \Grav\Plugin\JavaBeanAdmin2\JavaBeanThemeEngine())->buildCss($cfg);
    }

    /** @return array<string, mixed> */
    private static function operatorLaunchpad(Grav $grav): array
    {
        $root = GRAV_ROOT . '/user/plugins/operator-dock-admin2';
        if (!is_dir($root) || !(bool) $grav['config']->get('plugins.operator-dock-admin2.enabled', false)) {
            return ['ok' => false, 'error' => 'operator-dock-admin2 not available'];
        }

        require_once $root . '/classes/OperatorDockLinkRegistry.php';

        return [
            'ok' => true,
            'links' => (new \Grav\Plugin\OperatorDockAdmin2\OperatorDockLinkRegistry($grav))->launchpadPayload(),
        ];
    }
}

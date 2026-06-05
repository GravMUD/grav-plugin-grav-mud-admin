<?php

declare(strict_types=1);

namespace Grav\Plugin\GravMudAdmin;

use Grav\Common\Grav;

/**
 * Installed + enabled checks for Admin2 menus and EvvyTink tabs.
 */
final class MudPluginCapabilities
{
    public static function installed(string $slug): bool
    {
        $slug = trim($slug, '/');
        if ($slug === '') {
            return false;
        }

        return is_dir(GRAV_ROOT . '/user/plugins/' . $slug);
    }

    public static function enabled(Grav $grav, string $slug): bool
    {
        return (bool) $grav['config']->get('plugins.' . $slug . '.enabled', false);
    }

    public static function active(Grav $grav, string $slug): bool
    {
        return self::installed($slug) && self::enabled($grav, $slug);
    }

    /** @return array<string, bool> */
    public static function plugins(Grav $grav): array
    {
        $slugs = [
            'grav-mud-alpha',
            'grav-mud-forumz',
            'grav-mud-commentz',
            'grav-mud-messenger',
            'javabean-admin2',
            'operator-dock-admin2',
            'mambo-desktop-admin2',
        ];

        $out = [];
        foreach ($slugs as $slug) {
            $out[$slug] = self::installed($slug);
            $out[$slug . '_enabled'] = self::active($grav, $slug);
        }

        $commentzDir = $grav['locator']->findResource('user://data/mud-commentz', true, false);
        $out['commentz_data'] = is_string($commentzDir) && is_dir($commentzDir);

        return $out;
    }

    /** @return array<string, bool> */
    public static function evvyTabs(Grav $grav): array
    {
        return [
            'dashboard' => true,
            'widgets' => true,
            'editor' => self::installed('grav-mud-alpha'),
            'menus' => true,
            'forumz' => self::installed('grav-mud-forumz'),
            'theme' => self::installed('grav-mud-alpha'),
            'media' => true,
            'feeds' => true,
        ];
    }

    /** @return array<string, mixed> */
    public static function payload(Grav $grav): array
    {
        return [
            'ok' => true,
            'plugins' => self::plugins($grav),
            'tabs' => self::evvyTabs($grav),
        ];
    }
}

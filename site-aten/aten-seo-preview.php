<?php
/**
 * Keep the ATEN landing page social preview stable when SEO/cache plugins
 * inject the site-wide default image after page metadata is prepared.
 */
add_action('template_redirect', static function (): void {
    if (!is_page('aten')) {
        return;
    }

    ob_start(static function (string $html): string {
        $old_image = 'https://vadzim.by/wp-content/uploads/2025/07/vadzim_og_viber.jpg';
        $new_image = 'https://vadzim.by/wp-content/uploads/aten/aten-og.png';

        $html = str_replace($old_image, $new_image, $html);

        $html = preg_replace(
            '/(<meta\s+(?:property|name)=["\'](?:og:image:type|twitter:image:type)["\']\s+content=)["\']image\/jpeg["\']/i',
            '$1"image/png"',
            $html
        ) ?? $html;

        return $html;
    });
}, 0);

<?php
/**
 * Keep the ATEN landing page social preview stable when SEO/cache plugins
 * inject the site-wide default image after page metadata is prepared.
 */
add_action('template_redirect', static function (): void {
    if (!is_page('aten') && !is_single('aton-gotovitsya-k-ios-pervaya-versiya-uzhe-testiruetsya-na-iphone')) {
        return;
    }

    ob_start(static function (string $html): string {
        $old_images = [
            'https://vadzim.by/wp-content/uploads/2025/07/vadzim_og_viber.jpg',
            'https://vadzim.by/wp-content/uploads/2025/07/vadzim_og_blog_viber.jpg',
        ];
        $new_image = is_single('aton-gotovitsya-k-ios-pervaya-versiya-uzhe-testiruetsya-na-iphone')
            ? 'https://vadzim.by/wp-content/uploads/2026/07/Aten-ios-1.webp'
            : 'https://vadzim.by/wp-content/uploads/aten/aten-og.png';

        $html = str_replace($old_images, $new_image, $html);

        $html = preg_replace(
            '/(<meta\s+(?:property|name)=["\'](?:og:image:type|twitter:image:type)["\']\s+content=)["\']image\/jpeg["\']/i',
            is_single('aton-gotovitsya-k-ios-pervaya-versiya-uzhe-testiruetsya-na-iphone') ? '$1"image/webp"' : '$1"image/png"',
            $html
        ) ?? $html;

        if (is_single('aton-gotovitsya-k-ios-pervaya-versiya-uzhe-testiruetsya-na-iphone')) {
            $html = preg_replace(
                '/(<meta\s+property=["\']og:image:width["\']\s+content=)["\']\d+["\']/i',
                '$1"1254"',
                $html
            ) ?? $html;
            $html = preg_replace(
                '/(<meta\s+property=["\']og:image:height["\']\s+content=)["\']\d+["\']/i',
                '$1"1254"',
                $html
            ) ?? $html;
        }

        return $html;
    });
}, 0);

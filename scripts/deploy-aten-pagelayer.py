import os
import shlex
import time
from pathlib import Path

import paramiko


ROOT = Path(__file__).resolve().parents[1]
SITE_DIR = ROOT / "site-aten"
ASSETS_DIR = SITE_DIR / "assets"
MANIFEST = SITE_DIR / "latest.json"
PAGE_HTML = SITE_DIR / "pagelayer-content.html"
PAGE_CSS = SITE_DIR / "aten-pagelayer.css"
SEO_MU_PLUGIN = SITE_DIR / "aten-seo-preview.php"
VERSION = (ROOT / "desktop-qt" / "VERSION").read_text(encoding="utf-8").strip()
INSTALLER = ROOT / "desktop-qt" / "dist" / f"ATEN-Setup-{VERSION}.exe"
PUBLIC_INSTALLER = ROOT / "desktop-qt" / "dist" / f"ATEN-{VERSION}-Windows-x64.exe"
INSTALLER_ZIP = ROOT / "desktop-qt" / "dist" / f"ATEN-Setup-{VERSION}.zip"
PORTABLE_ZIP = ROOT / "desktop-qt" / "dist" / f"ATEN-Windows-{VERSION}-x64.zip"

REMOTE_ROOT = "www/vadzim.by"
REMOTE_UPLOADS = f"{REMOTE_ROOT}/wp-content/uploads/aten"
REMOTE_MU_PLUGINS = f"{REMOTE_ROOT}/wp-content/mu-plugins"


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def ensure_dir(sftp: paramiko.SFTPClient, path: str) -> None:
    current = ""
    for part in path.split("/"):
        current = part if not current else f"{current}/{part}"
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def exists(sftp: paramiko.SFTPClient, path: str) -> bool:
    try:
        sftp.stat(path)
        return True
    except FileNotFoundError:
        return False


def upload(sftp: paramiko.SFTPClient, local: Path, remote_name: str) -> None:
    if not local.exists():
        raise RuntimeError(f"Missing local file: {local}")
    sftp.put(str(local), f"{REMOTE_UPLOADS}/{remote_name}")
    print(f"uploaded {remote_name}")


def upload_to(sftp: paramiko.SFTPClient, local: Path, remote_path: str) -> None:
    if not local.exists():
        raise RuntimeError(f"Missing local file: {local}")
    sftp.put(str(local), remote_path)
    print(f"uploaded {remote_path}")


def page_content() -> str:
    html = PAGE_HTML.read_text(encoding="utf-8")
    return (
        '<!-- wp:pagelayer/pl-post-props {"post_title":"ATEN","post_status":"publish","post_name":"aten","pagelayer-id":"aten001"} /-->\n'
        '<!-- wp:pagelayer/pl-row {"stretch":"full","col_gap":"0","pagelayer-id":"aten002"} -->\n'
        '<!-- wp:pagelayer/pl-col {"col":12,"pagelayer-id":"aten003"} -->\n'
        '<!-- wp:pagelayer/pl-html {"pagelayer-id":"aten004"} -->\n'
        f"{html}\n"
        '<!-- /wp:pagelayer/pl-html -->\n'
        '<!-- /wp:pagelayer/pl-col -->\n'
        '<!-- /wp:pagelayer/pl-row -->'
    )


def deploy_php(content: str) -> str:
    return f"""<?php
require __DIR__ . '/wp-load.php';
global $wpdb;
$content = <<<'ATEN_PAGE'
{content}
ATEN_PAGE;
$existing = get_page_by_path('aten', OBJECT, 'page');
$postarr = [
  'post_type' => 'page',
  'post_title' => 'ATEN',
  'post_name' => 'aten',
  'post_status' => 'publish',
  'post_author' => 1,
  'post_content' => $content,
  'post_excerpt' => 'ATEN — мессенджер для своих от vadzim.by',
  'comment_status' => 'closed',
  'ping_status' => 'closed',
];
if ($existing) {{
  $postarr['ID'] = $existing->ID;
  $post_id = wp_update_post($postarr, true);
}} else {{
  $post_id = wp_insert_post($postarr, true);
}}
if (is_wp_error($post_id)) {{
  fwrite(STDERR, $post_id->get_error_message());
  exit(1);
}}
update_post_meta($post_id, 'pagelayer-data', time());
update_post_meta($post_id, 'pagelayer_imported_content', 'ATEN');
delete_post_meta($post_id, '_pagelayer_content');
$seo_title = json_decode('"ATEN \u2014 \u043c\u0435\u0441\u0441\u0435\u043d\u0434\u0436\u0435\u0440 \u0434\u043b\u044f \u0441\u0432\u043e\u0438\u0445: \u0447\u0430\u0442\u044b, \u0433\u0440\u0443\u043f\u043f\u044b \u0438 \u0432\u0435\u0431-\u0432\u0435\u0440\u0441\u0438\u044f"');
$seo_desc = json_decode('"ATEN \u2014 \u0441\u043f\u043e\u043a\u043e\u0439\u043d\u044b\u0439 \u043c\u0435\u0441\u0441\u0435\u043d\u0434\u0436\u0435\u0440 \u043e\u0442 vadzim.by \u0434\u043b\u044f \u043f\u0435\u0440\u0435\u043f\u0438\u0441\u043a\u0438, \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u044b\u0445 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439, \u0433\u0440\u0443\u043f\u043f, \u043a\u0430\u043d\u0430\u043b\u043e\u0432 \u0438 \u043e\u0431\u0449\u0435\u043d\u0438\u044f \u0447\u0435\u0440\u0435\u0437 Windows-\u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0438\u043b\u0438 \u0432\u0435\u0431-\u0432\u0435\u0440\u0441\u0438\u044e."');
$canonical = 'https://vadzim.by/aten/';
$og_image = 'https://vadzim.by/wp-content/uploads/aten/aten-og.png';
$header_code = '<link rel="stylesheet" href="https://vadzim.by/wp-content/uploads/aten/aten-pagelayer.css?v=' . time() . '">' . "\n";
$header_code .= '<link rel="canonical" href="' . esc_url($canonical) . '">' . "\n";
$header_code .= '<meta name="description" content="' . esc_attr($seo_desc) . '">' . "\n";
$header_code .= '<meta property="og:locale" content="ru_RU">' . "\n";
$header_code .= '<meta property="og:type" content="website">' . "\n";
$header_code .= '<meta property="og:site_name" content="Vadzim.by">' . "\n";
$header_code .= '<meta property="og:title" content="' . esc_attr($seo_title) . '">' . "\n";
$header_code .= '<meta property="og:description" content="' . esc_attr($seo_desc) . '">' . "\n";
$header_code .= '<meta property="og:url" content="' . esc_url($canonical) . '">' . "\n";
$header_code .= '<meta property="og:image" content="' . esc_url($og_image) . '">' . "\n";
$header_code .= '<meta property="og:image:secure_url" content="' . esc_url($og_image) . '">' . "\n";
$header_code .= '<meta property="og:image:width" content="1200">' . "\n";
$header_code .= '<meta property="og:image:height" content="630">' . "\n";
$header_code .= '<meta property="og:image:type" content="image/png">' . "\n";
$header_code .= '<meta name="twitter:card" content="summary_large_image">' . "\n";
$header_code .= '<meta name="twitter:title" content="' . esc_attr($seo_title) . '">' . "\n";
$header_code .= '<meta name="twitter:description" content="' . esc_attr($seo_desc) . '">' . "\n";
$header_code .= '<meta name="twitter:image" content="' . esc_url($og_image) . '">' . "\n";
$header_code .= '<script type="application/ld+json">' . wp_json_encode([
  '@context' => 'https://schema.org',
  '@type' => 'SoftwareApplication',
  'name' => 'ATEN',
  'applicationCategory' => 'CommunicationApplication',
  'operatingSystem' => 'Windows, Web',
  'description' => $seo_desc,
  'url' => $canonical,
  'image' => $og_image,
  'publisher' => [
    '@type' => 'Organization',
    'name' => 'Vadzim.by',
    'url' => 'https://vadzim.by/'
  ],
  'offers' => [
    '@type' => 'Offer',
    'price' => '0',
    'priceCurrency' => 'USD',
    'url' => 'https://vadzim.by/wp-content/uploads/aten/ATEN-{VERSION}-Windows-x64.exe'
  ]
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
$wpdb->delete($wpdb->postmeta, ['post_id' => $post_id, 'meta_key' => 'pagelayer_header_code'], ['%d', '%s']);
$wpdb->insert($wpdb->postmeta, ['post_id' => $post_id, 'meta_key' => 'pagelayer_header_code', 'meta_value' => $header_code], ['%d', '%s', '%s']);
update_post_meta($post_id, '_yoast_wpseo_title', $seo_title);
update_post_meta($post_id, '_yoast_wpseo_metadesc', $seo_desc);
update_post_meta($post_id, '_yoast_wpseo_canonical', $canonical);
update_post_meta($post_id, '_yoast_wpseo_opengraph-title', $seo_title);
update_post_meta($post_id, '_yoast_wpseo_opengraph-description', $seo_desc);
update_post_meta($post_id, '_yoast_wpseo_opengraph-image', $og_image);
update_post_meta($post_id, '_yoast_wpseo_twitter-title', $seo_title);
update_post_meta($post_id, '_yoast_wpseo_twitter-description', $seo_desc);
update_post_meta($post_id, '_yoast_wpseo_twitter-image', $og_image);
update_post_meta($post_id, '_siteseo_titles_title', $seo_title);
update_post_meta($post_id, '_siteseo_titles_desc', $seo_desc);
update_post_meta($post_id, '_siteseo_robots_canonical', $canonical);
update_post_meta($post_id, '_siteseo_social_fb_title', $seo_title);
update_post_meta($post_id, '_siteseo_social_fb_desc', $seo_desc);
update_post_meta($post_id, '_siteseo_social_fb_img', $og_image);
update_post_meta($post_id, '_siteseo_social_fb_img_width', '1200');
update_post_meta($post_id, '_siteseo_social_fb_img_height', '630');
update_post_meta($post_id, '_siteseo_social_twitter_title', $seo_title);
update_post_meta($post_id, '_siteseo_social_twitter_desc', $seo_desc);
update_post_meta($post_id, '_siteseo_social_twitter_img', $og_image);
update_post_meta($post_id, '_siteseo_social_twitter_img_width', '1200');
update_post_meta($post_id, '_siteseo_social_twitter_img_height', '630');
if (function_exists('clean_post_cache')) clean_post_cache($post_id);
if (function_exists('wp_cache_flush')) wp_cache_flush();
echo get_permalink($post_id) . PHP_EOL;
"""


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=env("SFTP_HOST"),
        port=int(os.environ.get("SFTP_PORT", "22")),
        username=env("SFTP_USER"),
        password=env("SFTP_PASS"),
        timeout=30,
    )
    sftp = client.open_sftp()
    ensure_dir(sftp, REMOTE_UPLOADS)
    ensure_dir(sftp, REMOTE_MU_PLUGINS)

    physical_aten = f"{REMOTE_ROOT}/aten"
    if exists(sftp, physical_aten):
        backup = f"{REMOTE_ROOT}/aten-static-backup-{time.strftime('%Y%m%d-%H%M%S')}"
        sftp.rename(physical_aten, backup)
        print(f"renamed physical /aten to {backup}")

    upload(sftp, ASSETS_DIR / "aten-hero.png", "aten-hero.png")
    upload(sftp, ASSETS_DIR / "aten-hero-akhenaten.png", "aten-hero-akhenaten.png")
    upload(sftp, ASSETS_DIR / "aten-logo.png", "aten-logo.png")
    upload(sftp, ASSETS_DIR / "aten-og.png", "aten-og.png")
    upload(sftp, INSTALLER, f"ATEN-Setup-{VERSION}.exe")
    upload(sftp, INSTALLER, "ATEN-Setup-latest.exe")
    upload(sftp, PUBLIC_INSTALLER, f"ATEN-{VERSION}-Windows-x64.exe")
    upload(sftp, PUBLIC_INSTALLER, "ATEN-Windows-latest-x64.exe")
    upload(sftp, INSTALLER_ZIP, f"ATEN-Setup-{VERSION}.zip")
    upload(sftp, INSTALLER_ZIP, "ATEN-Setup-latest.zip")
    upload(sftp, PORTABLE_ZIP, f"ATEN-Windows-{VERSION}-x64.zip")
    upload(sftp, PORTABLE_ZIP, "ATEN-Windows-latest-x64.zip")
    upload(sftp, MANIFEST, "latest.json")
    upload(sftp, PAGE_CSS, "aten-pagelayer.css")
    upload_to(sftp, SEO_MU_PLUGIN, f"{REMOTE_MU_PLUGINS}/aten-seo-preview.php")

    remote_php = f"{REMOTE_ROOT}/.aten-pagelayer-deploy.php"
    with sftp.open(remote_php, "w") as handle:
        handle.write(deploy_php(page_content()))

    cmd = f"cd {shlex.quote(REMOTE_ROOT)} && php .aten-pagelayer-deploy.php"
    _, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", "replace").strip()
    err = stderr.read().decode("utf-8", "replace").strip()
    try:
        sftp.remove(remote_php)
    except FileNotFoundError:
        pass
    sftp.close()
    client.close()

    if err:
        print(err)
    if not out:
        raise RuntimeError("WordPress page deployment did not return a permalink")
    print(f"page: {out}")


if __name__ == "__main__":
    main()

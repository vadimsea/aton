/**
 * Список отчётов: index.html в папке out
 */
import { readdir, writeFile } from "fs/promises";
import path from "path";

export async function writeIndexHtml(outDir) {
  const files = (await readdir(outDir))
    .filter((f) => f !== "index.html" && (f.endsWith(".html") || f.endsWith(".md")))
    .sort()
    .reverse();

  const links = files
    .map((f) => `<li><a href="./${encodeURIComponent(f)}">${escapeHtml(f)}</a></li>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Атон — отчёты QA-ботов</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 56rem; margin: 2rem auto; padding: 0 1rem; background: #0f172a; color: #e2e8f0; }
    h1 { font-size: 1.25rem; font-weight: 600; }
    p { color: #94a3b8; font-size: 0.9rem; }
    ul { list-style: none; padding: 0; }
    li { margin: 0.5rem 0; padding: 0.6rem 0.8rem; background: rgba(30,41,59,0.6); border-radius: 8px; border: 1px solid rgba(148,163,184,0.2); }
    a { color: #7dd3fc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Отчёты QA-ботов (фронт / бэк)</h1>
  <p>Файлы обновляются по расписанию CI. Скачайте или откройте .html / .md и пришлите в чат с ИИ.</p>
  <ul>
${links || "<li>Пока нет файлов</li>"}
  </ul>
</body>
</html>`;

  await writeFile(path.join(outDir, "index.html"), html, "utf8");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

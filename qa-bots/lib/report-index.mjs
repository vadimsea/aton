/**
 * Список отчётов: index.html в папке out (включая вложенные .html, .md, .png)
 */
import { readdir, stat, writeFile } from "fs/promises";
import path from "path";

async function listReportFilesRec(currentDir, baseDir) {
  const out = [];
  for (const name of await readdir(currentDir)) {
    const p = path.join(currentDir, name);
    const st = await stat(p);
    if (st.isDirectory()) {
      out.push(...(await listReportFilesRec(p, baseDir)));
    } else {
      if (name === "index.html" && currentDir === baseDir) continue;
      if (/\.(html|md|png|webp|jpg|jpeg)$/i.test(name)) {
        out.push(path.relative(baseDir, p).split(path.sep).join("/"));
      }
    }
  }
  return out;
}

/**
 * @param {string} outDir
 * @param {{ additionalRels?: string[] }} [options] — пути (posix) к отчётам, уже лежащим на FTP с прошлых заливок, чтобы index не «обрезал» архив
 */
export async function writeIndexHtml(outDir, options = {}) {
  const abs = path.resolve(outDir);
  const localRels = (await listReportFilesRec(abs, abs)).map((rel) =>
    rel.split(path.sep).join("/")
  );
  const extra = (options.additionalRels || [])
    .map((r) => String(r).trim().replace(/\\/g, "/"))
    .filter((r) => {
      if (!r || r === "index.html") return false;
      if (r.endsWith("/index.html")) return false;
      return /\.(html|md|png|webp|jpe?g)$/i.test(r);
    });
  const relpaths = [...new Set([...localRels, ...extra])]
    .filter(Boolean)
    .sort()
    .reverse();

  const links = relpaths
    .map(
      (rel) =>
        `<li data-kind="${extKind(rel)}"><a href="./${encodeURI(rel)}">${escapeHtml(rel)}</a></li>`
    )
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
    li[data-kind="image"] { border-color: rgba(34, 197, 94, 0.3); }
    a { color: #7dd3fc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Отчёты QA-ботов (фронт / бэк / соц)</h1>
  <p>Формат: <strong>Markdown</strong> и <strong>HTML</strong> (текст), для фронта — скриншоты <strong>PNG</strong> в <code>shots/дата/</code>; сценарий «два бота» — <code>social-*.md</code> (UTF-8 BOM) и <code>social-*.html</code> (если .md в браузере с кракозябрами — откройте .html). Обновляется по CI.</p>
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

function extKind(rel) {
  if (/\.(png|webp|jpe?g)$/i.test(rel)) return "image";
  return "doc";
}

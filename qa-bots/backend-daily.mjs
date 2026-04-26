/**
 * Ежедневный бот бэкенда: смоук, замеры, проверка типовых ответов → Groq text →
 * отчёт с предложениями (API, безопасность, перф, надёжность). Загрузка на FTP.
 *
 * Env: GROQ_API_KEY, QA_BASE, FTP_*, optional GROQ_TEXT_MODEL
 */

import { loadQaBotsEnv } from "./lib/load-env.mjs";
import { spawnSync } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { groqText } from "./lib/groq.mjs";
import { uploadOutDir } from "./lib/ftp-client.mjs";
import { writeMergedQaIndex } from "./lib/write-merged-qa-index.mjs";

loadQaBotsEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "out");
const SMOKE = path.join(ROOT, "scripts", "qa-prod-smoke.js");

const base = (process.env.QA_BASE || process.env.QA_API_BASE || "https://aton-api.onrender.com").replace(
  /\/$/,
  ""
);

async function req(p, opt = {}) {
  const t0 = Date.now();
  const r = await fetch(base + p, {
    ...opt,
    headers: { "Content-Type": "application/json", ...opt.headers },
  });
  const ms = Date.now() - t0;
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 500);
  }
  return { status: r.status, data, ms, path: p };
}

async function collectMetrics() {
  const lines = [];
  lines.push(`Base URL: ${base}`);

  const h = await req("/api/health");
  lines.push(`GET /api/health → ${h.status} за ${h.ms}ms, body: ${JSON.stringify(h.data).slice(0, 200)}`);
  if (h.data && typeof h.data.golosMaxPerWindow === "number") {
    lines.push(
      `Голос Атона: golosMaxPerWindow=${h.data.golosMaxPerWindow} (0 = без лимита), golosRateUnlimited=${h.data.golosRateUnlimited === true}`
    );
  }
  const hWarm = await req("/api/health");
  lines.push(`повтор GET /api/health (тот же процесс) → ${hWarm.status} за ${hWarm.ms}ms — сравни с первым: большой разброс часто cold start / прогрев`);

  const bad = await req("/api/no-such-endpoint-aton-qa");
  lines.push(`GET несуществующий путь → ${bad.status} за ${bad.ms}ms (ожидаем 4xx)`);

  const r = await req("/", { method: "GET" });
  lines.push(`GET / (корень Express) → ${r.status} за ${r.ms}ms`);

  return lines.join("\n");
}

function runSmoke() {
  const e = { ...process.env, QA_BASE: base };
  const out = spawnSync(process.execPath, [SMOKE], {
    env: e,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    cwd: ROOT,
  });
  return {
    code: out.status,
    out: (out.stdout || "") + (out.stderr || ""),
  };
}

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error("Нужен GROQ_API_KEY");
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  const metrics = await collectMetrics();
  const smoke = runSmoke();
  const smokeBlock = `=== Смоук-скрипт (exit ${smoke.code}) ===\n${smoke.out}\n`;
  const bundle = `## Метрики и ручные проверки\n\n${metrics}\n\n## Смоук\n\n${smokeBlock}`;

  const stamp = new Date();
  const dateStr = stamp.toISOString().slice(0, 10);
  const timeStr = stamp.toISOString();

  const system = `Ты senior backend-инженер (Node.js, Express, Prisma, PostgreSQL, WebSocket, продакшен-деплой).
Отвечай на русском, структурированно, без лишних дисклеймеров.
**Только по данным блока ниже** — не выдумывай метрики, которых нет в логе.

**Обязательно** отдельно обсуди **сессию и задержки** (разлогин при F5, долгий вход): /api/me, /api/login, тяжёлые маршруты (**/api/messages/all**), **401**, cold start, DB. Конкретные гипотезы и **что мерить**.

**Запрещено:** общие пункты вроде «улучшить архитектуру» без привязки к смоуку/health.

В **конце** ответа **обязательно** раздел **## Промпт для Cursor**: нумерованные задачи для правок (файлы \`server.js\`, \`lib/*\`, Prisma, роуты \`/api/...\`, env), по фактам отчёта; 5–12 строк. Если всё зелёное — 3–5 строк «что мониторить / как воспроизвести регрессию».`;

  const user = `Ниже — результат проверок **публичного** API (прод). Секретов в данных нет.

Сделай отчёт с такими разделами (Markdown):
1. **Краткое резюме** — health, **golosMaxPerWindow** / **golosRateUnlimited** (0 и true = ок для Голоса).
2. **Факты из смоука и метрик** — цитаты цифр из данных, не общие слова.
3. **Сессия, F5, время до готовности** — только если в данных есть тайминги/ошибки.
4. **Риски и узкие места** — привязка к строкам лога.
5. **P1/P2/P3** — коротко, конкретно.
6. **## Промпт для Cursor** — отдельный финальный раздел, как в system.

--- Данные ---

${bundle}`;

  let analysis;
  try {
    analysis = await groqText({ system, user, maxTokens: 4500, temperature: 0.2 });
  } catch (e) {
    analysis = `Ошибка Groq: ${e.message || e}`;
  }

  const md = `# Бэкенд QA — ${dateStr}

**Время (UTC):** ${timeStr}  
**API:** ${base}

---

## Сырые данные

\`\`\`
${bundle.slice(0, 12_000)}
\`\`\`

## Анализ (Groq)

${analysis}

---

*Сгенерировано ботом qa-bots/backend-daily.mjs*
`;

  const safeName = `backend-${dateStr}`;
  await writeFile(path.join(OUT, `${safeName}.md`), md, "utf8");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const htmlOut = `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Атон — бэкенд QA ${dateStr}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:50rem;margin:0 auto;padding:1.2rem;background:#0f172a;color:#e2e8f0;line-height:1.5;}
h1{font-size:1.1rem;color:#a5b4fc}
.meta{color:#94a3b8;font-size:0.85rem}
pre{white-space:pre-wrap;word-break:break-word;font-size:0.8rem;background:rgba(30,41,59,0.5);padding:0.8rem;border-radius:8px}
</style></head><body>
<h1>Отчёт бэкенд-бота</h1>
<p class="meta">${timeStr} · ${esc(base)}</p>
<h2>Анализ</h2>
<div>${esc(analysis).split("\n").map((l) => `<p>${l || " "}</p>`).join("")}</div>
</body></html>`;
  await writeFile(path.join(OUT, `${safeName}.html`), htmlOut, "utf8");

  await writeMergedQaIndex(OUT);
  console.log("OK:", path.join(OUT, `${safeName}.md`));

  if (process.env.FTP_HOST && process.env.FTP_USER && process.env.FTP_PASS) {
    try {
      await uploadOutDir(OUT);
      console.log("FTP: залито в", process.env.FTP_QA_DIR || "/public_html/qa-bots");
    } catch (e) {
      console.error("FTP ошибка:", e.message || e);
      process.exit(1);
    }
  } else {
    console.log("FTP не настроен — только локальная папка qa-bots/out");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Ежедневный бот бэкенда: смоук, замеры, проверка типовых ответов → Groq text →
 * отчёт с предложениями (API, безопасность, перф, надёжность). Загрузка на FTP.
 *
 * Env: GROQ_API_KEY, QA_BASE, FTP_*, optional GROQ_TEXT_MODEL
 */

import { spawnSync } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { groqText } from "./lib/groq.mjs";
import { uploadOutDir } from "./lib/ftp-client.mjs";
import { writeIndexHtml } from "./lib/report-index.mjs";

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
  if (!process.env.GROG_API_KEY) {
    console.error("Нужен GROG_API_KEY");
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
Отвечай на русском, структурированно, без лишних дисклеймеров.`;

  const user = `Ниже — результат автоматических проверок **публичного** API веб-мессенджера (прод). Никакого секретного кода в данных нет.

Сделай **полный отчёт**:
1. **Краткое резюме** (здоровье API).
2. **По логу смоука** — что хорошо, что риск.
3. **Производительность** — что видно по задержкам, что бы замерял в проде.
4. **HTTP/API дизайн** — консистентность ошибок, 404, версионирование, rate limit (по смыслу, без догадок о внутр. коде).
5. **Безопасность** — токены, CORS, заголовки, утечки в сообщениях об ошибках (обобщённо).
6. **Надёжность** — idempotency, идемпотентность, ретраи, cold start (Render) если релевантно.
7. **Наблюдаемость** — логи, метрики, health.
8. **Список конкретных улучшений** (нумерация, приоритет P1/P2/P3).
9. **Три следующих шага** для владельца продукта.

--- Данные ---

${bundle}`;

  let analysis;
  try {
    analysis = await groqText({ system, user, maxTokens: 4500 });
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

  await writeIndexHtml(OUT);
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

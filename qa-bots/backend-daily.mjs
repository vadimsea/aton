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
**Обязательно** отдельно обсуди **сессию и задержки на клиенте** (пользователи жалуются на «разлогин при F5» и «логин ~30 с»): твоя зона — **медленный** /api/me, /api/login, тяжёлые маршруты при старте (**/api/messages/all** и т.д.), **401** и invalid токен, **cold start** хостинга, DB. Не своди к одной фразе — дай **конкретные** гипотезы и что мерить.`;

  const user = `Ниже — результат проверок **публичного** API веб-мессенджера (прод). Секретов в данных нет.

Сделай **полный отчёт**:
1. **Краткое резюме** (здоровье API, в т.ч. **golosMaxPerWindow** / **golosRateUnlimited** в /api/health: **0** и **true** = нет почасового лимита к Голосу Атона; иначе — регрессия/риск жёсткого лимита).
2. **Связь API → UX/клиент** — как ответы/ошибки/задержки бьют по опыту (в т.ч. **чат, лента сообщений, вложения** в духе **Telegram/WhatsApp**); кратко по данным. Явно: **сессия, F5, долгий вход** — чем **бэкенд** может бить по клиенту (тайминги health, cold start, тяжёлые агрегаты).
3. **По логу смоука** — риски.
4. **Производительность** — задержки **первого и второго** /api/health, что мерить в проде; влияние на **ощущаемый** срок «до чата».
5. **HTTP/API** — ошибки, 404, rate limit (обобщённо).
6. **Безопасность** — токены, **срок жизни/валидация** (и почему клиент мог «разлогинить»), CORS, заголовки, тексты ошибок.
7. **Надёжность** — ретраи, cold start (Render) если уместно.
8. **Наблюдаемость** — health, логи.
9. **Улучшения** (P1/P2/P3), **обязательно** пункты по **сессии и задержкам** входа/refresh, если health или смоук намекают.
10. **Три шага** владельцу.

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

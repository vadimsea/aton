/**
 * Ежедневный бот: эмулирует пользователя (логин по токену), 3 вьюпорта (ПК / планшет / мобилка),
 * скрины → Groq vision → отчёты design/UX. Загрузка на FTP (FTP_QA_DIR).
 *
 * Env: GROQ_API_KEY, QA_BOT_TOKEN, QA_FRONTEND_URL,
 *      FTP_HOST, FTP_USER, FTP_PASS, FTP_QA_DIR
 */

import { loadQaBotsEnv } from "./lib/load-env.mjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { groqVision } from "./lib/groq.mjs";
import { uploadOutDir } from "./lib/ftp-client.mjs";
import { writeIndexHtml } from "./lib/report-index.mjs";

loadQaBotsEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "out");

const FRONT = (process.env.QA_FRONTEND_URL || "https://aten.vadzim.by").replace(/\/$/, "");
const TOKEN = process.env.QA_BOT_TOKEN;
const ATON_KEY = "aton_token";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, label: "Настольный (≈1440×900)" },
  { name: "tablet", width: 834, height: 1112, label: "Планшет (≈834×1112)" },
  { name: "mobile", width: 390, height: 844, label: "Мобилка (≈390×844)" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runUserFlowAndShot(page, tag, shotDir) {
  await page.goto(FRONT, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.evaluate(
    ([k, v]) => {
      localStorage.setItem(k, v);
    },
    [ATON_KEY, TOKEN]
  );
  await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
  await sleep(2000);
  try {
    await page.waitForSelector("#aton-chat-list", { timeout: 60_000 });
  } catch {
    // гость / ошибка — всё равно скрин
  }
  const items = page.locator(".aton-chat-item");
  const n = await items.count();
  if (n > 0) {
    try {
      await items.nth(0).click();
      await page.waitForSelector(".aton-messages", { state: "visible", timeout: 15_000 });
      await sleep(600);
      const msg = page.locator(".aton-messages");
      if (await msg.count()) {
        await msg.first().evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await sleep(400);
      }
    } catch {
      /* */
    }
  }
  const outP = path.join(shotDir, `fe-${tag}.png`);
  await page.screenshot({ path: outP, fullPage: false, type: "png" });
  return outP;
}

async function main() {
  if (!TOKEN) {
    console.error("Нужен QA_BOT_TOKEN (верифицированный бот).");
    process.exit(1);
  }
  if (!process.env.GROQ_API_KEY) {
    console.error("Нужен GROQ_API_KEY");
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  const stamp = new Date();
  const dateStr = stamp.toISOString().slice(0, 10);
  const timeStr = stamp.toISOString();
  const shotDir = path.join(OUT, "shots", dateStr);
  await mkdir(shotDir, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const shots = [];
  const labels = [];

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.name === "mobile" ? 2 : 1,
      });
      try {
        const p = await runUserFlowAndShot(page, vp.name, shotDir);
        shots.push(p);
        labels.push(vp.label);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  // Скриншоты оставляем в out/shots/ДАТА/ — Groq читает их ДО очистки (раньше PNG удаляли до vision — анализ шёл без картинок).

  const system = `Ты ведущий продуктовый дизайнер и UX-аудитор веб-мессенджера «Атон».
Пиши структурированно на русском. Без воды.`;

  const userPrompt = `Проанализируй ${shots.length} скриншота одного веб-мессенджера (три варианта ширины: десктоп, планшет, мобилка) после эмуляции: вход по токену, открыт первый чат при наличии.

Сделай **полный отчёт** по разделам:

1. **Первое впечатление** — иерархия, плотность, визуальный шум.
2. **Адаптив** — что ломается или проседает между desktop / tablet / mobile.
3. **Типографика и читаемость.**
4. **Цвет, контраст, состояния (active/hover) если видны.**
5. **Сетка и отступы, safe area на мобиле.**
6. **Сообщения и пузыри, поле ввода.**
7. **A11y** — кликабельные зоны, контраст текста, подписи.
8. **Конкретные предложения по улучшению** (нумерованный список, приоритет: P1/P2/P3).
9. **Краткое резюме в 3 пункта.**

Имена: ${labels.join(" | ")}.`;

  let analysis;
  try {
    analysis = await groqVision({
      system,
      userText: userPrompt,
      imagePaths: shots,
      maxTokens: 4500,
    });
  } catch (e) {
    analysis = `Ошибка Groq: ${e.message || e}`;
  }

  const md = `# Фронтенд QA — ${dateStr}

**Время (UTC):** ${timeStr}  
**URL:** ${FRONT}  
**Вьюпорты:** ${labels.join(", ")}  
**Скриншоты (PNG):** \`qa-bots/out/shots/${dateStr}/\` — \`fe-desktop.png\`, \`fe-tablet.png\`, \`fe-mobile.png\` (после заливки: \`/qa-bots/shots/${dateStr}/\` на хосте)

---

## Анализ (Groq)

${analysis}

---

*Сгенерировано ботом qa-bots/frontend-daily.mjs*
`;

  const safeName = `frontend-${dateStr}`;
  await writeFile(path.join(OUT, `${safeName}.md`), md, "utf8");
  const preBody = String(analysis)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const htmlOut = `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Атон — фронт QA ${dateStr}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:50rem;margin:0 auto;padding:1.2rem;background:#0f172a;color:#e2e8f0;line-height:1.5;}
h1{font-size:1.1rem;color:#7dd3fc}
.meta{color:#94a3b8;font-size:0.85rem}
pre.content{white-space:pre-wrap;word-break:break-word;font-size:0.9rem;margin-top:0.8rem}
</style></head><body>
<h1>Отчёт фронтенд-бота</h1>
<p class="meta">${timeStr} · ${FRONT}</p>
<pre class="content">${preBody}</pre>
</body></html>`;
  await writeFile(path.join(OUT, `${safeName}.html`), htmlOut, "utf8");

  await writeIndexHtml(OUT);

  console.log("OK:", path.join(OUT, `${safeName}.md`));

  if (process.env.FTP_HOST && process.env.FTP_USER && process.env.FTP_PASS) {
    try {
      await uploadOutDir(OUT);
      console.log("FTP: залито в", process.env.FTP_QA_DIR || "qa-bots", "(+ подпапки, напр. shots/… )");
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

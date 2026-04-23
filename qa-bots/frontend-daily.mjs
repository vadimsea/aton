/**
 * Фронт QA: логин по токену, 3 вьюпорта (ПК / планшет / мобилка), длинная сессия (по умолч. ≥20 мин),
 * несколько волн скриншотов, разные микро-сценарии (друзья, фильтры) → Groq vision → UI/UX-отчёт. FTP: FTP_QA_DIR.
 *
 * Env: GROQ_API_KEY, QA_BOT_TOKEN, QA_FRONTEND_URL,
 *      FTP_HOST, FTP_USER, FTP_PASS, FTP_QA_DIR
 *      QA_MIN_TEST_MS — целевая длительность (мс), по умолчанию 1_200_000 (20 мин)
 *      QA_BETWEEN_WAVES_MS — пауза между волнами (три вьюпорта), по умолчанию 5 мин
 */

import { loadQaBotsEnv } from "./lib/load-env.mjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { groqVision } from "./lib/groq.mjs";
import { uploadOutDir } from "./lib/ftp-client.mjs";
import { writeMergedQaIndex } from "./lib/write-merged-qa-index.mjs";

loadQaBotsEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

const MIN_TEST_MS = Number(process.env.QA_MIN_TEST_MS) > 0 ? Number(process.env.QA_MIN_TEST_MS) : 20 * 60 * 1000;
const BETWEEN_WAVES_MS =
  Number(process.env.QA_BETWEEN_WAVES_MS) > 0 ? Number(process.env.QA_BETWEEN_WAVES_MS) : 5 * 60 * 1000;

/**
 * @param {import('playwright').Page} page
 * @param {string} tag
 * @param {string} dateStr
 * @param {number} wave 1-based — разные микро-действия для разнообразия UI в кадре
 */
async function runUserFlowAndShot(page, tag, dateStr, wave = 1) {
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

  // Волны: друзья, фильтр «личные», смена темы — больше поверхностей UI для UX-отчёта
  const phase = (wave - 1) % 3;
  try {
    if (phase === 1) {
      const fr = page.locator("#aton-friends-btn, #aton-sidebar-friends-btn").first();
      try {
        await fr.waitFor({ state: "visible", timeout: 2000 });
        await fr.click();
        await sleep(900);
        await page.keyboard.press("Escape").catch(() => {});
        await sleep(300);
      } catch {
        /* кнопка невидна на этом вьюпорте */
      }
    } else if (phase === 2) {
      const fp = page.locator("#aton-filter-private");
      try {
        await fp.waitFor({ state: "visible", timeout: 2000 });
        await fp.click();
        await sleep(500);
      } catch {
        /* */
      }
    } else {
      const th = page.locator("#aton-theme-toggle, #aton-sidebar-theme-btn").first();
      try {
        await th.waitFor({ state: "visible", timeout: 2000 });
        await th.click();
        await sleep(400);
        await th.click();
        await sleep(300);
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }

  const list = page.locator("#aton-chat-list");
  if (await list.isVisible().catch(() => false)) {
    try {
      await list.evaluate((el) => {
        el.scrollTop = Math.min(el.scrollHeight, 180);
      });
      await sleep(300);
    } catch {
      /* */
    }
  }

  const items = page.locator(".aton-chat-item");
  const n = await items.count();
  if (n > 0) {
    try {
      const idx = wave % n;
      await items.nth(idx).click();
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
  // Плоские имена в out/ (без shots/дата/) — тот же уровень, что у бэкенд-отчётов, чтобы FTP (Pure-FTPd) заливал без 553
  const outP = path.join(OUT, `fe-${dateStr}-${tag}.png`);
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
  const tSession = Date.now();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const shots = [];
  const labels = [];
  let wave = 0;

  try {
    // Не меньше MIN_TEST_MS: несколько волн (десктоп / планшет / мобилка) + паузы
    do {
      wave += 1;
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.name === "mobile" ? 2 : 1,
        });
        try {
          const tag = `w${wave}-${vp.name}`;
          const p = await runUserFlowAndShot(page, tag, dateStr, wave);
          shots.push(p);
          labels.push(`${vp.label} · волна ${wave}`);
        } finally {
          await page.close();
        }
      }
      const elapsed = Date.now() - tSession;
      if (elapsed >= MIN_TEST_MS) break;
      const remain = MIN_TEST_MS - elapsed;
      const wait = Math.min(BETWEEN_WAVES_MS, remain);
      if (wait > 0) await sleep(wait);
    } while (Date.now() - tSession < MIN_TEST_MS);
    // Гарантия: не короче MIN_TEST_MS на таймлайне
    const spent = Date.now() - tSession;
    if (spent < MIN_TEST_MS) {
      await sleep(MIN_TEST_MS - spent);
    }
  } finally {
    await browser.close();
  }

  // Скриншоты оставляем в out/shots/ДАТА/ — Groq читает их ДО очистки (раньше PNG удаляли до vision — анализ шёл без картинок).

  const system = `Ты senior product-дизайнер и UI-ревьюер. Продукт — веб-мессенджер «Атон». **Критерий качества** — довести визуал и UX **в духе сильных референсов**: **Telegram** и **WhatsApp** (чистая лента, читаемые пузыри, аккуратные аватары, предсказуемая панель ввода, нормальные эмодзи/стикер-панель в перспективе). Пиши по-русски, **конкретно по кадру**, без общих фраз.`;

  const userPrompt = `Серия из ${shots.length} скриншотов (волны, вьюпорты **десктоп / планшет / мобилка**). Подписи кадров: ${labels.join(" | ")}.

**Главный фокус — зона чата и переписки** (и список чатов тоже, но **приоритет** — **интерфейс диалога**):

**А. Окно переписки (тред)** — фон, разделители дат, группировка сообщений, **пузыри** (входящие/исходящие, скругления, тень, ширина, переносы, выравнивание), **аватары** (размер, круг, сетка, выравнивание с текстом, дубли, «хвосты» если есть), **медиа/превью** в ленте, **ответы/цитаты/reply** если видны.

**Б. Содержимое сообщений** — типографика в пузыре, межстрочный интервал, **эмодзи и смайлики** (размер, соседство с текстом, обрезка), вложения, длина строки, контраст текста на фоне пузыря.

**В. Панель ввода (compose)** — поле, кнопки (отправка, вложения, **микрофон**), высота, прилипание к низу, safe area на мобиле, **бар эмодзи/стикеров** (если виден) или его отсутствие vs ожидания как у **Telegram/WhatsApp**.

**Г. Список чатов (сайдбар/экран списка)** — превью, жирнота непрочитанного, бейджи, аватарки, подписи времени, согласованность с топовыми мессенджерами.

**Д. Сравнение с референсом** — в каждом разделе кратко: «чем отличается от привычного **Telegram / WhatsApp** и что **подтянуть** (цвет, плотность, ритм, иконки)».

**Е. Адаптив** — **десктоп vs мобилка**: где ломается **чат** (пузыри, ширина, tap targets).

Структура отчёта (сохрани нумерацию):
1. **Переписка и пузыри** (детально).
2. **Аватары, метаданные, время.**
3. **Эмодзи, текст, вложения.**
4. **Поле ввода и панель действий.**
5. **Список чатов.**
6. **Планшет** — мост между ПК и мобилкой.
7. **Волны** (тема/фильтр/друзья) — влияние на чат.
8. **A11y** (контраст, кликабельность) по видимому.
9. **Дорожная карта: не меньше 15** пунктов P1/P2/P3 (тег: чат / список / ввод / везде) — что сделать, чтобы **визуально приблизиться** к **Telegram/WhatsApp**.
10. **Три приоритета** (самое важное для «ощущения топового мессенджера»).`;

  let analysis;
  try {
    analysis = await groqVision({
      system,
      userText: userPrompt,
      imagePaths: shots,
      maxTokens: 6000,
    });
  } catch (e) {
    analysis = `Ошибка Groq: ${e.message || e}`;
  }

  const md = `# Фронтенд QA — ${dateStr}

**Время (UTC):** ${timeStr}  
**URL:** ${FRONT}  
**Вьюпорты:** ${labels.join(", ")}  
**Сессия (цель):** ≥ ${(MIN_TEST_MS / 60_000).toFixed(0)} мин, волны: ${BETWEEN_WAVES_MS / 60_000} мин между полными тройками вьюпортов.  
**Скриншоты (PNG):** \`out/fe-${dateStr}-w*\` — на FTP в \`qa-bots/\`

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

  await writeMergedQaIndex(OUT);

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

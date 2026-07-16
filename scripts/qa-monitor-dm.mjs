/**
 * QA-бот: смоук API → скриншоты фронта (Playwright: список чатов + открытые диалоги) → Groq Vision (опционально)
 * → личное сообщение админу через API (токен верифицированного бота).
 *
 * GitHub Actions Secrets:
 *   QA_BOT_TOKEN       — session token бота (аккаунт с подтверждённой почтой)
 *   QA_ADMIN_USERNAME  — username получателя отчёта
 *   GROQ_API_KEY       — опционально, для разбора скринов
 *
 * Env:
 *   QA_API_BASE / QA_BASE     — API (по умолчанию https://aton-api.onrender.com)
 *   QA_FRONTEND_URL           — фронт (по умолчанию https://aten.vadzim.by)
 *   GROQ_VISION_MODEL         — модель Groq (по умолчанию qwen/qwen3.6-27b)
 */

import { spawnSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { groqVision } from "../qa-bots/lib/groq.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API = (process.env.QA_API_BASE || process.env.QA_BASE || "https://aton-api.onrender.com").replace(
  /\/$/,
  ""
);
const FRONT = (process.env.QA_FRONTEND_URL || "https://aten.vadzim.by").replace(/\/$/, "");
const TOKEN = process.env.QA_BOT_TOKEN;
const ADMIN = process.env.QA_ADMIN_USERNAME;
const GROQ = process.env.GROQ_API_KEY;
const GROQ_MODEL =
  process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";

function dmChatId(a, b) {
  return [a, b].sort().join("|");
}

function splitChunks(text, maxLen) {
  const t = String(text || "");
  if (t.length <= maxLen) return [t];
  const out = [];
  for (let i = 0; i < t.length; i += maxLen) {
    out.push(t.slice(i, i + maxLen));
  }
  return out;
}

/** В чате нет рендера markdown — убираем ** … ** чтобы текст не выглядел кашей. */
function stripChatMarkdown(s) {
  return String(s || "").replace(/\*\*/g, "");
}

/**
 * @param {{ ok: boolean, out: string }} smoke
 * @param {string} shotBlock — блок про скрины (короткий)
 * @param {string} uxNote
 * @returns {string[]}
 */
function buildQaReportBubbles({ smoke, shotBlock, uxNote }) {
  const t = new Date().toISOString();
  const p1 = [
    "━━━  QA · мини-отчёт  ━━━",
    "",
    `▸ Время (UTC): ${t}`,
    `▸ API:         ${API}`,
    `▸ Фронт:       ${FRONT}`,
    "",
    smoke.ok ? "▸ Смоук API:  ✅ готово" : "▸ Смоук API:  ❌ ошибка (см. ниже)",
    ...(smoke.ok
      ? []
      : [
          "",
          "— фрагмент лога —",
          (smoke.out || "").trim().slice(-2500) || "(пусто)",
        ]),
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");

  const p2 = shotBlock && shotBlock.trim() ? `━━━  Скриншоты  ━━━\n\n${shotBlock.trim()}` : "";
  const rawUx = stripChatMarkdown(uxNote || "—");
  const p3 = `━━━  UI/UX: проблемы и приближение к Telegram  ━━━\n\n${rawUx.trim()}`;
  return [p1, p2, p3].filter((s) => s && String(s).trim());
}

function runSmoke() {
  const script = path.join(__dirname, "qa-prod-smoke.js");
  const r = spawnSync(process.execPath, [script], {
    env: { ...process.env, QA_BASE: API },
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    out: (r.stdout || "") + (r.stderr || ""),
  };
}

const ATON_TOKEN_KEY = "aton_token";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Вход по токену бота, скрин списка чатов и (если есть) 1–2 открытых диалога.
 * @returns {{ paths: string[], labels: string[] }}
 */
async function takeFrontendScreenshots() {
  const { chromium } = await import("playwright");
  if (!TOKEN || !String(TOKEN).trim()) {
    throw new Error("Нужен QA_BOT_TOKEN для скринов с авторизацией");
  }
  const stamp = Date.now();
  const tmp = os.tmpdir();
  const out = { paths: [], labels: [] };

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    await page.goto(FRONT, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate(
      ({ key, val }) => {
        localStorage.setItem(key, val);
      },
      { key: ATON_TOKEN_KEY, val: TOKEN }
    );
    await page.reload({ waitUntil: "networkidle", timeout: 120000 });
    await sleep(2500);

    await page.waitForSelector("#aton-chat-list", { timeout: 90000 });

    const listPath = path.join(tmp, `aton-qa-list-${stamp}.png`);
    await page.screenshot({ path: listPath, fullPage: false, type: "png" });
    out.paths.push(listPath);
    out.labels.push("список чатов после входа");

    const itemLoc = page.locator(".aton-chat-item");
    const n = await itemLoc.count();
    if (n === 0) {
      out.labels.push("нет элементов .aton-chat-item — второй скрин не делался");
      return out;
    }

    await itemLoc.nth(0).click();
    await page.waitForSelector(".aton-messages", { state: "visible", timeout: 20000 });
    await sleep(900);
    const chat1 = path.join(tmp, `aton-qa-chat-a-${stamp}.png`);
    await page.screenshot({ path: chat1, fullPage: false, type: "png" });
    out.paths.push(chat1);
    out.labels.push("открыт первый чат в списке");

    if (n > 1) {
      const back = page.locator("#aton-back-btn");
      if (await back.count()) {
        await back.click();
        await sleep(700);
        await page.waitForSelector(".aton-chat-item", { timeout: 15000 });
        await page.locator(".aton-chat-item").nth(1).click();
        await page.waitForSelector(".aton-messages", { state: "visible", timeout: 20000 });
        await sleep(900);
        const chat2 = path.join(tmp, `aton-qa-chat-b-${stamp}.png`);
        await page.screenshot({ path: chat2, fullPage: false, type: "png" });
        out.paths.push(chat2);
        out.labels.push("открыт второй чат в списке");
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

async function analyzeUxWithGroq(pngPaths, labels) {
  if (!GROQ) {
    return [
      "GROQ_API_KEY не задан — автоматический разбор UI пропущен.",
      "Добавь секрет GROQ_API_KEY в GitHub (или локально в .env) для анализа скринов.",
    ].join("\n");
  }
  const raw = Array.isArray(pngPaths) ? pngPaths : [pngPaths];
  const rawLabs = Array.isArray(labels) ? labels : [];
  const paths = [];
  const alignedLabs = [];
  let total = 0;
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (!p || !existsSync(p)) continue;
    const buf = readFileSync(p);
    if (buf.length > 3.5 * 1024 * 1024) {
      return `Скрин слишком большой для Groq (>3.5MB).`;
    }
    total += buf.length;
    paths.push(p);
    alignedLabs.push(rawLabs[i] || `кадр ${paths.length}`);
  }
  if (paths.length === 0) {
    return "Нет файлов скринов для Groq.";
  }
  if (total > 10 * 1024 * 1024) {
    return "Суммарный размер скринов слишком большой — сократи число кадров.";
  }

  const system =
    "Ты строгий UI/UX-критик. Продукт — веб-мессенджер «Атон» (скриншоты: список чатов, затем открытый диалог; это приоритет анализа). " +
    "Эталон качества — Telegram: чёткая иерархия, ритм и отступы, спокойные пузыри, аккуратный compose, предсказуемые иконки, нет визуального шума. " +
    "Категорически нельзя тратить текст на нейтральные факты вроде «на экране есть поле ввода» или «сообщения в виде пузырей» — так пользователь ничего не выигрывает. " +
    "Пиши только: дефекты, слабые места, визуальный долг, несоответствие эталону, риск для удобства, что выглядит незавершённо или дешевле, чем у Telegram. " +
    "Для каждого смысла: что не так, чем бьёт по UX, что именно подтянуть. Зоны: тред и пузыри, шапка, список чатов, compose, аватары, типографика, кнопки, safe area.";
  const userText = [
    "Ответь по-русски. Не используй разметку markdown (никаких звёздочек).",
    "Соблюдай пустую строку между смысловыми блоками.",
    "Блок 1, одна строка: краткий вердикт — насколько близок интерфейс на скринах к ощущению Telegram (одно честное предложение).",
    "Блок 2, заголовок строкой: «Проблемы и отставание от Telegram» — 8–12 нумерованных пунктов 1. 2. 3. … : только слабые стороны, риски, несоответствие хорошему вкусу и эталону; нейтрального пересказа того, что «видно на картинке», избегай.",
    "Блок 3, заголовок строкой: «Что улучшить, чтобы приблизиться к Telegram» — 4–6 нумерованных пунктов: конкретные действия (вёрстка, отступы, цвет, иконки, иерархия, плотность), в каждом пункте укажи приоритет P0 / P1 / P2 по твоему смыслу.",
    "Блок 4, заголовок строкой: «Промпт для Cursor» — 5–12 нумерованных строк для вставки в чат Cursor: файлы (main.js, style.css), селекторы или области UI; только по твоим пунктам выше; запрещены общие фразы «улучшить продукт» без привязки к скрину.",
    "Если по кадру не видно явного бага, всё равно назови 2–3 зоны, где Aton обычно слабее эталона, и что проверить в следующем тесте — без общих фраз. Учитывай подписи к кадрам, если паков несколько.",
  ].join(" ");

  try {
    return await groqVision({
      system,
      userText,
      imagePaths: paths,
      imageLabels: alignedLabs,
      model: GROQ_MODEL,
      maxTokens: 2800,
    });
  } catch (e) {
    return `Groq: ${e?.message || e}`;
  }
}

async function fetchBotUsername() {
  const r = await fetch(`${API}/api/me`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`Бот GET /api/me: ${r.status} ${JSON.stringify(data)}`);
  }
  if (!data.username) throw new Error("В ответе /api/me нет username");
  return data.username;
}

/** Одно или несколько фрагментов с лимитом 3400 симв./сообщение. */
async function postDmChunks(text) {
  const botUsername = await fetchBotUsername();
  const chatId = dmChatId(botUsername, ADMIN);
  const chunks = splitChunks(text, 3400);
  for (let i = 0; i < chunks.length; i++) {
    const part = chunks.length > 1 ? `[часть ${i + 1}/${chunks.length}]\n${chunks[i]}` : chunks[i];
    const r = await fetch(`${API}/api/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId,
        type: "text",
        text: part,
        to: ADMIN,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(`POST /api/messages: ${r.status} ${JSON.stringify(data)}`);
    }
  }
}

async function sendDmText(text) {
  await postDmChunks(text);
}

/** Несколько пузырей подряд: секции отчёта не сливаются в один абзац. */
async function sendQaBubbles(sections) {
  const list = Array.isArray(sections) ? sections : [];
  for (let k = 0; k < list.length; k++) {
    const s = list[k];
    if (!s || !String(s).trim()) continue;
    await postDmChunks(String(s).trim());
    if (k < list.length - 1) {
      await sleep(750);
    }
  }
}

async function main() {
  if (!TOKEN || !String(TOKEN).trim()) {
    console.error("Задай QA_BOT_TOKEN (токен сессии верифицированного бота).");
    process.exit(1);
  }
  if (!ADMIN || !String(ADMIN).trim()) {
    console.error("Задай QA_ADMIN_USERNAME (кому слать отчёт в ЛС).");
    process.exit(1);
  }

  const smoke = runSmoke();
  let shotBlock = "▸ Скриншоты не сделаны (см. условия бота).";
  let uxNote = "";
  try {
    const shots = await takeFrontendScreenshots();
    shotBlock = shots.paths
      .map((p, i) => {
        const base = path.basename(p);
        return `  ${i + 1}. ${shots.labels[i] || "кадр"}\n      файл: ${base}`;
      })
      .join("\n");
    try {
      uxNote = await analyzeUxWithGroq(shots.paths, shots.labels);
    } catch (e) {
      uxNote = `Анализ UI: ${e.message || e}`;
    }
  } catch (e) {
    shotBlock = `▸ Ошибка Playwright/скринов:\n  ${(e && e.message) || e}`;
    uxNote = "(анализ UI недоступен — нет кадров или таймаут)";
  }

  const bubbles = buildQaReportBubbles({ smoke, shotBlock, uxNote });
  for (const b of bubbles) {
    console.log("---\n" + b.slice(0, 800) + (b.length > 800 ? "…" : "") + "\n");
  }

  await sendQaBubbles(bubbles);
  console.log("\nOK: отчёт отправлен в ЛС (несколько сообщ.)", ADMIN);

  process.exit(smoke.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

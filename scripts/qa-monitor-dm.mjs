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
 *   GROQ_VISION_MODEL         — модель Groq (по умолчанию meta-llama/llama-4-scout-17b-16e-instruct)
 */

import { spawnSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

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
  process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

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
  const paths = Array.isArray(pngPaths) ? pngPaths : [pngPaths];
  const labs = Array.isArray(labels) ? labels : [];

  let total = 0;
  const parts = [];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    total += buf.length;
    if (buf.length > 3.5 * 1024 * 1024) {
      return `Скрин ${i + 1} слишком большой для Groq (>3.5MB).`;
    }
    const label = labs[i] || `кадр ${i + 1}`;
    parts.push({ label, b64: buf.toString("base64") });
  }
  if (parts.length === 0) {
    return "Нет файлов скринов для Groq.";
  }
  if (total > 10 * 1024 * 1024) {
    return "Суммарный размер скринов слишком большой — сократи число кадров.";
  }

  const intro =
    "Ты UI/UX-ревьюер. Скрины мобильного веб-мессенджера «Атон»: список чатов, затем **открытая переписка** (в приоритете). " +
    "Ориентир по ощущениям: **Telegram** и **WhatsApp** (чистая лента, пузыри, аватары, поле ввода, эмодзи/кнопки). " +
    "Разбери: **тред** (пузыри, свои/чужие, скругления, фон), **аватары** и выравнивание, **текст и эмодзи** в пузырях, " +
    "**шапка чата** и **compose** (ввод, микрофон, вложения, safe area). " +
    "12–16 коротких пунктов на русском, **без вступлений**; 3–4 пункта — явный gap vs Telegram/WhatsApp и что подтянуть.";

  const content = [{ type: "text", text: intro }];
  for (const part of parts) {
    content.push({ type: "text", text: `Кадр: ${part.label}` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${part.b64}` },
    });
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content }],
      max_tokens: 2000,
      temperature: 0.4,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return `Groq API ошибка ${res.status}: ${JSON.stringify(j).slice(0, 1200)}`;
  }
  const text = j.choices?.[0]?.message?.content;
  return text || JSON.stringify(j).slice(0, 500);
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

async function sendDmText(text) {
  const botUsername = await fetchBotUsername();
  const chatId = dmChatId(botUsername, ADMIN);
  const chunks = splitChunks(text, 3400);
  for (let i = 0; i < chunks.length; i++) {
    const part = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n${chunks[i]}` : chunks[i];
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

async function main() {
  if (!TOKEN || !String(TOKEN).trim()) {
    console.error("Задай QA_BOT_TOKEN (токен сессии верифицированного бота).");
    process.exit(1);
  }
  if (!ADMIN || !String(ADMIN).trim()) {
    console.error("Задай QA_ADMIN_USERNAME (кому слать отчёт в ЛС).");
    process.exit(1);
  }

  const lines = [];
  lines.push(`📋 Отчёт QA (бот)`);
  lines.push(`Время: ${new Date().toISOString()}`);
  lines.push(`API: ${API}`);
  lines.push(`Фронт: ${FRONT}`);
  lines.push("");

  const smoke = runSmoke();
  lines.push(smoke.ok ? "✅ API смоук: OK" : "❌ API смоук: FAIL");
  if (!smoke.ok) {
    lines.push("--- лог смоука ---");
    lines.push(smoke.out.slice(-3500) || "(пусто)");
  }
  lines.push("");

  let shotNote = "▸ Скриншоты: не сделаны";
  let uxNote = "";
  try {
    const shots = await takeFrontendScreenshots();
    shotNote =
      "▸ Скриншоты:\n" +
      shots.paths.map((p, i) => `  ${i + 1}. ${shots.labels[i] || "кадр"} → ${p}`).join("\n");
    lines.push(shotNote);
    try {
      uxNote = await analyzeUxWithGroq(shots.paths, shots.labels);
    } catch (e) {
      uxNote = `Анализ UI: ${e.message || e}`;
    }
  } catch (e) {
    lines.push(`▸ Скриншоты: ошибка — ${e.message || e}`);
    uxNote = "(Playwright недоступен, нет токена бота или таймаут загрузки)";
  }

  lines.push("");
  lines.push("--- UI / UX ---");
  lines.push(uxNote || "—");

  const report = lines.join("\n");
  console.log(report);

  await sendDmText(report);
  console.log("\nOK: сообщение отправлено в ЛС", ADMIN);

  process.exit(smoke.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

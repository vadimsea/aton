/**
 * QA-бот: смоук API → скриншот фронта (Playwright) → анализ UI (Groq Vision, опционально)
 * → личное сообщение админу через API (токен верифицированного бота).
 *
 * GitHub Actions Secrets:
 *   QA_BOT_TOKEN       — session token бота (аккаунт с подтверждённой почтой)
 *   QA_ADMIN_USERNAME  — username получателя отчёта
 *   GROQ_API_KEY       — опционально, для разбора скриншота
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

async function takeScreenshot() {
  const { chromium } = await import("playwright");
  const outPath = path.join(os.tmpdir(), `aton-qa-${Date.now()}.png`);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    await page.goto(FRONT, { waitUntil: "networkidle", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: outPath, fullPage: false, type: "png" });
    return outPath;
  } finally {
    await browser.close();
  }
}

async function analyzeUxWithGroq(pngPath) {
  if (!GROQ) {
    return [
      "GROQ_API_KEY не задан — автоматический разбор UI пропущен.",
      "Добавь секрет GROQ_API_KEY в GitHub (или локально в .env) для анализа скриншота.",
    ].join("\n");
  }
  const buf = readFileSync(pngPath);
  if (buf.length > 3.5 * 1024 * 1024) {
    return "Скриншот слишком большой для Groq (>3.5MB) — уменьши viewport или отключи fullPage.";
  }
  const b64 = buf.toString("base64");
  const prompt =
    "Ты UX-ревьюер. Проанализируй скриншот мобильной веб-страницы мессенджера «Атон». " +
    "Найди конкретные проблемы: отступы от выреза/status bar, выравнивание кнопок, читаемость, контраст, перегруженность. " +
    "Ответь 5–8 короткими пунктами на русском, без вступлений.";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64}` },
            },
          ],
        },
      ],
      max_tokens: 900,
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

  let shotNote = "▸ Скриншот: не сделан";
  let uxNote = "";
  try {
    const pngPath = await takeScreenshot();
    shotNote = `▸ Скриншот: ${pngPath}`;
    lines.push(shotNote);
    try {
      uxNote = await analyzeUxWithGroq(pngPath);
    } catch (e) {
      uxNote = `Анализ UI: ${e.message || e}`;
    }
  } catch (e) {
    lines.push(`▸ Скриншот: ошибка — ${e.message || e}`);
    uxNote = "(Playwright недоступен или таймаут загрузки страницы)";
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

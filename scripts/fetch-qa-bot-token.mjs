/**
 * Берёт QA_BOT_TOKEN через POST {QA_BASE}/api/login, если в .env заданы
 * QA_BOT_EMAIL и QA_BOT_PASSWORD (тест-аккаунт с подтверждённой почтой).
 * Пишет QA_BOT_TOKEN=... в корневой .env (тот же файл, не в git).
 *
 *   node scripts/fetch-qa-bot-token.mjs
 */
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
dotenv.config({ path: envPath });

const base = (process.env.QA_BASE || "https://aton-api.onrender.com").replace(/\/$/, "");
const email = (process.env.QA_BOT_EMAIL || "").trim();
const pass = (process.env.QA_BOT_PASSWORD || "").trim();

if (!email || !pass) {
  console.error(
    "В .env укажите QA_BOT_EMAIL и QA_BOT_PASSWORD (тест-бот, почта подтверждена), затем снова запустите этот скрипт."
  );
  process.exit(1);
}

const r = await fetch(`${base}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: pass }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error("Вход не удался:", r.status, j.error || j);
  process.exit(1);
}
const token = j.token;
if (!token) {
  console.error("В ответе нет token:", j);
  process.exit(1);
}
if (j.user && j.user.verified === false) {
  console.warn("Внимание: аккаунт может быть без подтверждения почты — фронт-боту нужен verified.");
}

let raw = readFileSync(envPath, "utf8");
const newLine = `QA_BOT_TOKEN=${token}`;
if (/^QA_BOT_TOKEN=.*$/m.test(raw)) {
  raw = raw.replace(/^QA_BOT_TOKEN=.*$/m, newLine);
} else {
  raw += (raw.endsWith("\n") ? "" : "\n") + newLine + "\n";
}
writeFileSync(envPath, raw, "utf8");
console.log("OK: QA_BOT_TOKEN записан в .env (длина", token.length, "символов)");

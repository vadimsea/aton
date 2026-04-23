/**
 * Одноразово: вывести session token (для копирования в GitHub → QA_BOT2_TOKEN / QA_BOT_TOKEN).
 * Пароль только в env или интерактивно, не в argv.
 *
 *   QA_BASE=https://... QA_EMAIL=... QA_PASSWORD=... node qa-bots/print-aton-token.mjs
 *   node qa-bots/print-aton-token.mjs   # тогда подхватит qa-bots/.env
 */

import { loadQaBotsEnv } from "./lib/load-env.mjs";

loadQaBotsEnv();

const base = (process.env.QA_BASE || process.env.QA_API_BASE || "https://aton-api.onrender.com").replace(
  /\/$/,
  ""
);
const email = (process.env.QA_EMAIL || process.env.QA_PRINT_EMAIL || "").trim();
const password = (process.env.QA_PASSWORD || process.env.QA_PRINT_PASSWORD || "").trim();

if (!email || !password) {
  console.error(
    "Задайте QA_EMAIL и QA_PASSWORD (или QA_PRINT_*) в окружении / qa-bots/.env, см. комментарий в скрипте."
  );
  process.exit(1);
}

const r = await fetch(`${base}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const j = await r.json().catch(() => ({}));
if (r.status !== 200 || !j.token) {
  console.error("Ошибка входа:", r.status, JSON.stringify(j).slice(0, 400));
  process.exit(1);
}
if (j.user && j.user.verified === false) {
  console.error("Предупреждение: почта не подтверждена — API мессенджера может отказать.");
}
console.log(j.token);
if (j.user?.username) {
  console.error(`username: ${j.user.username} (токен в stdout — для вставки в secret)`);
}

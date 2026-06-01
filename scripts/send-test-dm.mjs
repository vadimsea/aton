/**
 * Send a test DM via production API.
 * Usage: node scripts/send-test-dm.mjs <recipientUsername> [text]
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const base = (process.env.QA_BASE || "https://aton-api.onrender.com").replace(/\/$/, "");
const token = (process.env.QA_BOT_TOKEN || "").trim();
const recipient = (process.argv[2] || "Akhenaten").trim();
const text =
  process.argv[3] ||
  `Тест desktop-уведомлений ATEN (${new Date().toLocaleString("ru-RU")}). Если видите toast, звук и бейдж на иконке — всё работает.`;

if (!token) {
  console.error("Need QA_BOT_TOKEN in .env");
  process.exit(1);
}

async function api(method, endpoint, body) {
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const me = await api("GET", "/api/me");
if (me.status !== 200) {
  console.error("GET /api/me failed:", me.status, me.json?.error || me.json);
  process.exit(1);
}
const sender = me.json?.user?.username || me.json?.username;
if (!sender) {
  console.error("Could not resolve bot username");
  process.exit(1);
}

const chatId = [sender, recipient].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "accent" })).join("|");
const sent = await api("POST", "/api/messages", {
  chatId,
  type: "text",
  text,
});
if (sent.status !== 200 && sent.status !== 201) {
  console.error("POST /api/messages failed:", sent.status, sent.json?.error || sent.json);
  process.exit(1);
}

console.log("OK sent from", sender, "to", recipient, "chatId=", chatId);
console.log("Text:", text.slice(0, 80) + (text.length > 80 ? "…" : ""));

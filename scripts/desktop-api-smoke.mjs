/**
 * Smoke test for desktop client API flow (same endpoints as ApiClient.cpp).
 * Usage: node scripts/desktop-api-smoke.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const base = (process.env.QA_BASE || process.env.ATEN_API_URL || "https://aton-api.onrender.com").replace(/\/$/, "");
const email = (process.env.QA_BOT_EMAIL || process.env.QA_EMAIL || "").trim();
const password = (process.env.QA_BOT_PASSWORD || process.env.QA_PASSWORD || "").trim();
const tokenEnv = (process.env.QA_BOT_TOKEN || "").trim();

const results = [];

function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "OK" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(method, endpoint, { token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text: text.slice(0, 200) };
}

async function main() {
  console.log("Desktop API smoke @", base);

  const health = await api("GET", "/api/health");
  log("GET /api/health", health.status === 200 && health.json?.ok, `service=${health.json?.service}`);

  let token = tokenEnv;
  let loginOk = !!token;
  if (token) {
    const probe = await api("GET", "/api/me", { token });
    if (probe.status !== 200) {
      token = "";
      loginOk = false;
    }
  }
  if (!token && email && password) {
    const login = await api("POST", "/api/login", {
      body: email.includes("@") ? { email, password } : { username: email, password },
    });
    token = login.json?.token || "";
    loginOk = login.status === 200 && !!token;
    log("POST /api/login", loginOk, login.json?.error || `status ${login.status}`);
  } else if (token) {
    log("POST /api/login", true, "token from env");
  } else {
    log("POST /api/login", false, "no credentials");
    process.exit(1);
  }

  const me = await api("GET", "/api/me", { token });
  const user = me.json?.user || me.json;
  const username = user?.username || "";
  log("GET /api/me", me.status === 200 && !!username, username);

  const dialogs = await api("GET", "/api/dialogs", { token });
  const dialogCount = Array.isArray(dialogs.json) ? dialogs.json.length : 0;
  log("GET /api/dialogs", dialogs.status === 200, `${dialogCount} dialogs`);

  const contacts = await api("GET", "/api/contacts", { token });
  log("GET /api/contacts", contacts.status === 200, contacts.json?.friends ? "has friends key" : "object");

  let chatId = "";
  if (dialogCount > 0) {
    chatId = dialogs.json[0].id;
  } else if (username) {
    chatId = `${username}|golos_aton`;
  }

  if (chatId) {
    const enc = encodeURIComponent(chatId);
    const msgs = await api("GET", `/api/messages?chatId=${enc}`, { token });
    const count = Array.isArray(msgs.json) ? msgs.json.length : 0;
    log("GET /api/messages", msgs.status === 200, `${count} in ${chatId.slice(0, 40)}`);

    const testText = `[desktop-smoke ${new Date().toISOString()}]`;
    const sent = await api("POST", "/api/messages", {
      token,
      body: { chatId, type: "text", text: testText },
    });
    log("POST /api/messages", sent.status === 200 || sent.status === 201, sent.json?.error || testText.slice(0, 30));

    const msgs2 = await api("GET", `/api/messages?chatId=${enc}`, { token });
    const found = Array.isArray(msgs2.json) && msgs2.json.some((m) => m.text === testText);
    log("message round-trip", found, found ? "visible after send" : "not found");
  } else {
    log("GET /api/messages", false, "no chatId");
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\nSummary:", `${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

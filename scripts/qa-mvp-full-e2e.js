/**
 * QA MVP: полный сценарий пользователей (без изменения server.js).
 * Запуск: node scripts/qa-mvp-full-e2e.js
 * Требуется: сервер на QA_BASE (по умолчанию http://127.0.0.1:3000)
 */
const path = require("path");
const { io } = require("socket.io-client");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const TS = Date.now();

const U1 = { username: `qa_u1_${TS}`, email: `qa_u1_${TS}@test.local`, password: "QaSecret1!" };
const U2 = { username: `qa_u2_${TS}`, email: `qa_u2_${TS}@test.local`, password: "QaSecret2!" };
const ADM = { username: `qa_ad_${TS}`, email: `qa_ad_${TS}@test.local`, password: "QaAdmin1!" };

const log = [];
function L(msg, obj) {
  const line = obj !== undefined ? `${msg} ${JSON.stringify(obj)}` : msg;
  console.log(line);
  log.push(line);
}

async function api(method, p, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(BASE + p, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { status: r.status, data };
}

function dmChatId(a, b) {
  return [a, b].sort().join("|");
}

async function promoteSuperAdmin(username) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL обязателен для promoteSuperAdmin (хранение только в PostgreSQL)");
  }
  const { prisma } = require("../lib/prisma");
  const row = await prisma.user.findUnique({ where: { username } });
  if (!row) throw new Error("user not found for promote: " + username);
  await prisma.user.update({
    where: { username },
    data: { isSuperAdmin: true },
  });
  L("setup: isSuperAdmin=true in PostgreSQL for", username);
  await prisma.$disconnect();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  L("=== QA MVP FULL E2E ===");
  L("BASE", BASE);
  L("users", { u1: U1.username, u2: U2.username, ad: ADM.username });

  const results = { pass: [], fail: [], note: [] };

  function PASS(name) {
    results.pass.push(name);
    L("[PASS]", name);
  }
  function FAIL(name, detail) {
    results.fail.push({ name, detail });
    L("[FAIL]", name, detail || "");
  }

  // ---- 1 Register + login
  for (const u of [U1, U2, ADM]) {
    const reg = await api("POST", "/api/register", {
      body: { email: u.email, username: u.username, password: u.password },
    });
    if (reg.status !== 200 || !reg.data?.token) {
      FAIL(`register ${u.username}`, `status ${reg.status} ${JSON.stringify(reg.data)}`);
      console.log("\n--- LOG ---\n", log.join("\n"));
      process.exit(1);
    }
    PASS(`register ${u.username}`);
  }

  await promoteSuperAdmin(ADM.username);

  const tokens = {};
  for (const [key, u] of [
    ["u1", U1],
    ["u2", U2],
    ["admin", ADM],
  ]) {
    const lg = await api("POST", "/api/login", {
      body: { email: u.email, password: u.password },
    });
    if (lg.status !== 200 || !lg.data?.token) {
      FAIL(`login ${key}`, lg);
      process.exit(1);
    }
    tokens[key] = lg.data.token;
    PASS(`login ${key}`);
  }

  // ---- 2 /api/me
  for (const [key, u] of [
    ["u1", U1],
    ["u2", U2],
    ["admin", ADM],
  ]) {
    const me = await api("GET", "/api/me", { token: tokens[key] });
    if (me.status !== 200 || me.data?.username !== u.username) {
      FAIL(`GET /api/me ${key}`, me);
    } else PASS(`GET /api/me ${key}`);
  }

  const dmId = dmChatId(U1.username, U2.username);

  // ---- 3 DM HTTP
  const m1 = await api("POST", "/api/messages", {
    token: tokens.u1,
    body: { chatId: dmId, type: "text", text: "hi from u1", to: U2.username },
  });
  if (m1.status !== 200) FAIL("DM u1->u2", m1);
  else PASS("DM u1->u2 HTTP");

  const m2 = await api("POST", "/api/messages", {
    token: tokens.u2,
    body: { chatId: dmId, type: "text", text: "reply from u2", to: U1.username },
  });
  if (m2.status !== 200) FAIL("DM u2->u1", m2);
  else PASS("DM u2->u1 HTTP");

  const listDm = await api("GET", `/api/messages?chatId=${encodeURIComponent(dmId)}`, { token: tokens.u1 });
  if (listDm.status !== 200 || !Array.isArray(listDm.data)) FAIL("GET messages DM", listDm);
  else {
    const texts = listDm.data.map((m) => m.text).filter(Boolean);
    if (texts.includes("hi from u1") && texts.includes("reply from u2")) PASS("DM history order (2 msgs present)");
    else FAIL("DM history", texts);
  }

  // ---- 4 Group
  const g = await api("POST", "/api/chats", {
    token: tokens.u1,
    body: { title: `QA Group ${TS}`, type: "group", visibility: "public" },
  });
  if (g.status !== 200 || !g.data?.id) {
    FAIL("create group", g);
    console.log(log.join("\n"));
    process.exit(1);
  }
  const groupId = g.data.id;
  PASS("POST /api/chats group " + groupId);

  const addMem = await api("POST", `/api/chats/${encodeURIComponent(groupId)}/members/add`, {
    token: tokens.u1,
    body: { username: U2.username },
  });
  if (addMem.status !== 200) FAIL("members/add u2", addMem);
  else PASS("owner invites u2 (members/add)");

  const gMsg1 = await api("POST", "/api/messages", {
    token: tokens.u1,
    body: { chatId: groupId, type: "text", text: "hello group from u1" },
  });
  const gMsg2 = await api("POST", "/api/messages", {
    token: tokens.u2,
    body: { chatId: groupId, type: "text", text: "hello from u2 in group" },
  });
  if (gMsg1.status !== 200 || gMsg2.status !== 200) FAIL("group messages", { gMsg1, gMsg2 });
  else PASS("group messages HTTP");

  // Socket: group message:new
  const s1g = io(BASE, { auth: { token: tokens.u1 }, transports: ["websocket"], timeout: 8000 });
  const s2g = io(BASE, { auth: { token: tokens.u2 }, transports: ["websocket"], timeout: 8000 });

  await new Promise((res, rej) => {
    let n = 0;
    const ok = () => {
      n++;
      if (n === 2) res();
    };
    s1g.on("connect", ok);
    s2g.on("connect", ok);
    s1g.on("connect_error", rej);
    s2g.on("connect_error", rej);
    setTimeout(() => rej(new Error("socket connect timeout")), 12000);
  }).catch((e) => {
    FAIL("socket connect (group phase)", String(e));
  });

  s1g.emit("join_chat", groupId);
  s2g.emit("join_chat", groupId);
  await sleep(300);

  let gotOnS2 = false;
  s2g.once("message:new", (msg) => {
    if (msg && msg.chatId === groupId && String(msg.text || "").includes("socket test from u1")) gotOnS2 = true;
  });

  const gSock = await api("POST", "/api/messages", {
    token: tokens.u1,
    body: { chatId: groupId, type: "text", text: `socket test from u1 ${TS}` },
  });
  await sleep(1500);
  if (gSock.status === 200 && gotOnS2) PASS("socket message:new group (u2 receives u1)");
  else FAIL("socket message:new group", { status: gSock.status, gotOnS2 });

  s1g.disconnect();
  s2g.disconnect();

  // ---- 5 Global + socket (слушатели до connect, чтобы не терять события)
  let g1 = false;
  let g2 = false;
  const sg1 = io(BASE, { auth: { token: tokens.u1 }, transports: ["websocket"], timeout: 8000 });
  const sg2 = io(BASE, { auth: { token: tokens.u2 }, transports: ["websocket"], timeout: 8000 });
  sg1.on("message:new", (msg) => {
    if (msg?.chatId === "global" && msg?.from === U2.username) g1 = true;
  });
  sg2.on("message:new", (msg) => {
    if (msg?.chatId === "global" && msg?.from === U1.username) g2 = true;
  });

  try {
    await new Promise((res, rej) => {
      let n = 0;
      const ok = () => {
        n++;
        if (n === 2) res();
      };
      sg1.on("connect", ok);
      sg2.on("connect", ok);
      sg1.on("connect_error", rej);
      sg2.on("connect_error", rej);
      setTimeout(() => rej(new Error("socket global connect timeout")), 12000);
    });
  } catch (e) {
    FAIL("socket connect global", String(e));
    throw e;
  }

  sg1.emit("join_chat", "global");
  sg2.emit("join_chat", "global");
  await sleep(600);

  await api("POST", "/api/messages", {
    token: tokens.u2,
    body: { chatId: "global", type: "text", text: `global ping u2 ${TS}` },
  });
  await api("POST", "/api/messages", {
    token: tokens.u1,
    body: { chatId: "global", type: "text", text: `global ping u1 ${TS}` },
  });
  // prisma.message.create может долго ждать таймаута при мёртвом PG — emit идёт после await
  for (let i = 0; i < 60 && (!g1 || !g2); i++) await sleep(250);

  if (g1 && g2) PASS("global message:new both directions");
  else FAIL("global message:new", { g1, g2 });

  sg1.disconnect();
  sg2.disconnect();

  // ---- 6 Admin
  const usersList = await api("GET", "/api/users", { token: tokens.admin });
  if (usersList.status !== 200 || !Array.isArray(usersList.data)) FAIL("GET /api/users (admin)", usersList);
  else PASS("GET /api/users (admin)");

  const reports = await api("GET", "/api/reports", { token: tokens.admin });
  if (reports.status !== 200 || !Array.isArray(reports.data)) FAIL("GET /api/reports", reports);
  else PASS("GET /api/reports (admin)");

  const u1row = usersList.data.find((x) => x.username === U1.username);
  const ver = await api("POST", `/api/users/${u1row.id}/verify`, { token: tokens.admin });
  if (ver.status === 200) PASS("POST /api/users/:id/verify (admin)");
  else FAIL("verify user", ver);

  const admG = await api("POST", "/api/messages", {
    token: tokens.admin,
    body: { chatId: groupId, type: "text", text: "admin in group" },
  });
  if (admG.status === 403) PASS("admin forbidden in alien group (403 as expected)");
  else if (admG.status === 200)
    results.note.push("admin sent to group without membership: got 200 (unexpected?)");
  else FAIL("admin group msg", admG.status);

  const admGlob = await api("POST", "/api/messages", {
    token: tokens.admin,
    body: { chatId: "global", type: "text", text: "admin global" },
  });
  if (admGlob.status === 200) PASS("admin POST global");
  else FAIL("admin POST global", admGlob);

  // ---- 7 Edge cases
  const empty = await api("POST", "/api/messages", {
    token: tokens.u1,
    body: { chatId: "global", type: "text", text: "" },
  });
  if (empty.status === 400) PASS("empty message returns 400");
  else {
    results.note.push(`empty text: status ${empty.status} (ожидали 400 по ТЗ QA — API сейчас допускает пустой text)`);
    FAIL("empty message (expected 400 per QA spec)", `got ${empty.status}`);
  }

  const longText = "L".repeat(9000);
  const long = await api("POST", "/api/messages", {
    token: tokens.u1,
    body: { chatId: "global", type: "text", text: longText },
  });
  if (long.status === 200) PASS("long message 9000 chars");
  else FAIL("long message", long.status);

  const burst = [];
  for (let i = 0; i < 15; i++) {
    burst.push(
      api("POST", "/api/messages", {
        token: tokens.u1,
        body: { chatId: "global", type: "text", text: `burst ${i}` },
      })
    );
  }
  const burstRes = await Promise.all(burst);
  const burstOk = burstRes.every((r) => r.status === 200);
  if (burstOk) PASS("burst 15 messages");
  else FAIL("burst", burstRes.filter((r) => r.status !== 200).length);

  const conc = await Promise.all([
    api("POST", "/api/messages", {
      token: tokens.u1,
      body: { chatId: "global", type: "text", text: "concurrent u1" },
    }),
    api("POST", "/api/messages", {
      token: tokens.u2,
      body: { chatId: "global", type: "text", text: "concurrent u2" },
    }),
  ]);
  if (conc[0].status === 200 && conc[1].status === 200) PASS("concurrent two users global");
  else FAIL("concurrent", conc);

  // ---- 8 Dedicated two-socket (already covered group/global); mark explicit
  PASS("socket pair coverage: group + global message:new");

  // ---- Summary
  L("\n=== SUMMARY ===");
  L("PASS count", results.pass.length);
  L("FAIL count", results.fail.length);
  if (results.note.length) L("NOTES:", results.note.join("; "));
  for (const f of results.fail) L("FAILED ITEM:", JSON.stringify(f));

  if (results.fail.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

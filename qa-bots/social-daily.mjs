/**
 * E2E «два реальных пользователя»: дружба (заявка/принятие) + обмен личками.
 * Два верифицированных QA-аккаунта. Сессия:
 *   — QA_BOT_TOKEN / QA_BOT2_TOKEN, **или**
 *   — пары login: QA_EMAIL+QA_PASSWORD (бот A), QA_BOT2_EMAIL+QA_BOT2_PASSWORD (бот B)
 *
 * Env:
 *   QA_BASE / QA_API_BASE — API (по умолчанию https://aton-api.onrender.com)
 *   GROQ_API_KEY — опц.
 *   FTP_* — опц. загрузка отчёта
 */

import { loadQaBotsEnv } from "./lib/load-env.mjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { groqText } from "./lib/groq.mjs";
import { uploadOutDir } from "./lib/ftp-client.mjs";
import { writeIndexHtml } from "./lib/report-index.mjs";

loadQaBotsEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");

const base = (process.env.QA_BASE || process.env.QA_API_BASE || "https://aton-api.onrender.com").replace(
  /\/$/,
  ""
);

function chatIdForUsers(a, b) {
  return [a, b].sort().join("|");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiReq(token, method, p, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const t0 = Date.now();
  const r = await fetch(base + p, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const ms = Date.now() - t0;
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data, ms, path: p };
}

function line(/** @type {string[]} */ log, s) {
  log.push(s);
  console.log(s);
}

/**
 * @param {string} tokenA
 * @param {string} userA
 * @param {string} tokenB
 * @param {string} userB
 */
async function ensureFriendship(log, tokenA, userA, tokenB, userB) {
  const c1 = await apiReq(tokenA, "GET", "/api/contacts");
  if (c1.status !== 200) {
    line(log, `GET A /api/contacts → ${c1.status} ${String(JSON.stringify(c1.data)).slice(0, 300)}`);
    throw new Error("contacts A failed");
  }
  const hasFriend = (c1.data.friends || []).some((f) => f && f.username === userB);
  if (hasFriend) {
    line(log, "Дружба: уже в списке друзей (A) — пропуск заявки.");
    return;
  }

  const add = await apiReq(tokenA, "POST", "/api/contacts/add", { username: userB });
  line(
    log,
    `A POST /api/contacts/add (→${userB}) → ${add.status} за ${add.ms}ms, body: ${String(JSON.stringify(add.data)).slice(0, 500)}`
  );

  if (add.status === 200 && add.data && add.data.ok) {
    const st = add.data.status;
    if (st === "friends" || st === "accepted") {
      line(log, "Дружба: установлена за один шаг (mutual / уже было).");
      return;
    }
    if (st === "requested") {
      const acc = await apiReq(tokenB, "POST", "/api/contacts/accept", { username: userA });
      line(
        log,
        `B POST /api/contacts/accept (→${userA}) → ${acc.status} за ${acc.ms}ms, body: ${String(JSON.stringify(acc.data)).slice(0, 300)}`
      );
      if (acc.status === 200 && acc.data?.ok) return;
      throw new Error("accept B failed");
    }
  }

  if (add.status === 400) {
    const err = String((add.data && add.data.error) || "");
    if (err.includes("Заявка уже отправлена") || err.includes("уже отправлена")) {
      const acc = await apiReq(tokenB, "POST", "/api/contacts/accept", { username: userA });
      line(
        log,
        `B POST /api/contacts/accept (после «заявка уже…») → ${acc.status} за ${acc.ms}ms, body: ${String(JSON.stringify(acc.data)).slice(0, 300)}`
      );
      if (acc.status === 200 && acc.data?.ok) return;
    }
  }

  throw new Error("ensureFriendship: не удалось привести к статусу «друзья»");
}

async function getMe(token) {
  const r = await apiReq(token, "GET", "/api/me");
  if (r.status !== 200 || !r.data || r.data.error) {
    return { err: r };
  }
  return { me: r.data };
}

/**
 * @param {string} tokenA
 * @param {string} userA
 * @param {string} tokenB
 * @param {string} userB
 */
async function verifyFriends(log, tokenA, userA, tokenB, userB) {
  const a = await apiReq(tokenA, "GET", "/api/contacts");
  const b = await apiReq(tokenB, "GET", "/api/contacts");
  line(
    log,
    `GET /api/contacts: A ${a.status} за ${a.ms}ms, B ${b.status} за ${b.ms}ms`
  );
  if (a.status !== 200 || b.status !== 200) {
    throw new Error("GET contacts failed");
  }
  const aNames = (a.data.friends || []).map((x) => x.username);
  const bNames = (b.data.friends || []).map((x) => x.username);
  if (!aNames.includes(userB) || !bNames.includes(userA)) {
    line(log, `Друзья A: [${aNames.join(", ")}]  B: [${bNames.join(", ")}]`);
    throw new Error("после сценария ожидались взаимные друзья");
  }
  line(log, "Проверка: оба в друзьях у друг друга — OK");
}

/**
 * @param {string} token
 * @param {string} chatId
 * @param {string} to
 * @param {string} text
 */
function postText(token, chatId, to, text) {
  return apiReq(token, "POST", "/api/messages", {
    chatId,
    type: "text",
    text,
    to,
  });
}

/**
 * @param {string} token
 * @param {string} chatId
 */
async function getMessages(token, chatId) {
  const q = `?chatId=${encodeURIComponent(chatId)}`;
  return apiReq(token, "GET", `/api/messages${q}`);
}

/**
 * @param {any[]} msgs
 * @param {string} needle
 * @param {string} fromUser
 */
function hasMessage(msgs, needle, fromUser) {
  if (!Array.isArray(msgs)) return false;
  return msgs.some(
    (m) =>
      m &&
      m.from === fromUser &&
      typeof m.text === "string" &&
      m.text.includes(needle)
  );
}

/**
 * Сессия: явный токен или POST /api/login.
 * @param {string} label
 * @param {string|undefined} token
 * @param {string|undefined} email
 * @param {string|undefined} password
 */
async function resolveSession(/** @type {string[]} */ log, label, token, email, password) {
  const t = String(token || "").trim();
  if (t) {
    line(log, `${label}: сессия из токена (env)`);
    return t;
  }
  const e = String(email || "").trim();
  const p = String(password || "").trim();
  if (e && p) {
    line(log, `${label}: POST /api/login (email+пароль из env)`);
    const r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, password: p }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status !== 200 || !j.token) {
      throw new Error(
        `${label}: вход не удался ${r.status} ${String(JSON.stringify(j)).slice(0, 400)}`
      );
    }
    if (j.user && j.user.verified === false) {
      line(log, `${label}: внимание — в ответе login verified=false (нужна подтверждённая почта).`);
    }
    return j.token;
  }
  return null;
}

async function main() {
  const log = [];
  let tokenA;
  let tokenB;
  try {
    tokenA = await resolveSession(
      log,
      "A",
      process.env.QA_BOT_TOKEN,
      process.env.QA_EMAIL,
      process.env.QA_PASSWORD
    );
    tokenB = await resolveSession(
      log,
      "B",
      process.env.QA_BOT2_TOKEN,
      process.env.QA_BOT2_EMAIL,
      process.env.QA_BOT2_PASSWORD
    );
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  if (!tokenA || !tokenB) {
    console.error(
      "Нужны для A: QA_BOT_TOKEN или пары QA_EMAIL+QA_PASSWORD; для B: QA_BOT2_TOKEN или пары QA_BOT2_EMAIL+QA_BOT2_PASSWORD (аккаунты с подтверждённой почтой)."
    );
    process.exit(1);
  }
  if (tokenA === tokenB) {
    console.error("Сессии A и B не должны совпадать (разные аккаунты).");
    process.exit(1);
  }

  line(log, `=== Соц E2E — ${base} ===`);
  const ma = await getMe(tokenA);
  const mb = await getMe(tokenB);
  if (ma.err || !ma.me?.username) {
    line(log, "GET A /api/me failed: " + JSON.stringify(ma.err?.data || ma));
    process.exit(1);
  }
  if (mb.err || !mb.me?.username) {
    line(log, "GET B /api/me failed: " + JSON.stringify(mb.err?.data || mb));
    process.exit(1);
  }
  const userA = ma.me.username;
  const userB = mb.me.username;
  line(log, `Участники: A=${userA}, B=${userB}`);

  if (userA === userB) {
    line(log, "Ошибка: один и тот же username.");
    process.exit(1);
  }

  const stamp = Date.now();
  const markA = `QA-SOCIAL-A-${stamp}`;
  const markB = `QA-SOCIAL-B-${stamp}`;
  const dmId = chatIdForUsers(userA, userB);
  line(log, `DM chatId: ${dmId}`);

  let failed = null;
  try {
    await ensureFriendship(log, tokenA, userA, tokenB, userB);
    await sleep(300);
    await verifyFriends(log, tokenA, userA, tokenB, userB);

    const sendA = await postText(tokenA, dmId, userB, `Привет от бота A [${markA}]`);
    line(
      log,
      `A → ЛС: POST /api/messages → ${sendA.status} за ${sendA.ms}ms id=${sendA.data?.id || "—"}`
    );
    if (sendA.status !== 200) {
      throw new Error("отправка A не удалась");
    }

    let seenA = false;
    for (let i = 0; i < 6; i++) {
      await sleep(400);
      const rm = await getMessages(tokenB, dmId);
      line(
        log,
        `B GET /api/messages?chatId=… (попытка ${i + 1}) → ${rm.status} за ${rm.ms}ms, count=${Array.isArray(rm.data) ? rm.data.length : 0}`
      );
      if (rm.status === 200 && Array.isArray(rm.data) && hasMessage(rm.data, markA, userA)) {
        seenA = true;
        break;
      }
    }
    if (!seenA) {
      throw new Error("B не видит сообщение A в ЛС (GET /api/messages).");
    }
    line(log, "B увидел сообщение A — OK");

    const sendB = await postText(tokenB, dmId, userA, `Ответ B [${markB}]`);
    line(
      log,
      `B → ЛС: POST /api/messages → ${sendB.status} за ${sendB.ms}ms id=${sendB.data?.id || "—"}`
    );
    if (sendB.status !== 200) {
      throw new Error("отправка B не удалась");
    }

    let seenB = false;
    for (let i = 0; i < 6; i++) {
      await sleep(400);
      const am = await getMessages(tokenA, dmId);
      line(
        log,
        `A GET /api/messages?chatId=… (попытка ${i + 1}) → ${am.status} за ${am.ms}ms, count=${Array.isArray(am.data) ? am.data.length : 0}`
      );
      if (am.status === 200 && Array.isArray(am.data) && hasMessage(am.data, markB, userB)) {
        seenB = true;
        break;
      }
    }
    if (!seenB) {
      throw new Error("A не видит ответ B в ЛС (GET /api/messages).");
    }
    line(log, "A увидел ответ B — OK. Сценарий завершён.");
  } catch (e) {
    failed = e;
    line(log, `ОШИБКА: ${e.message || e}`);
  }

  const rawLog = log.join("\n");
  const stampD = new Date();
  const dateStr = stampD.toISOString().slice(0, 10);
  const timeStr = stampD.toISOString();

  let analysis = "Groq пропущен: нет GROQ_API_KEY.";
  if (process.env.GROQ_API_KEY) {
    const system = `Ты product+QA. Акцент — **UX** сценария друзья→ЛС и **приведение клиента** к ощущению **Telegram/WhatsApp** (чат, пузыри, аватары, ввод, эмодзи). Затем API. По-русски, без воды.`;
    const user = `E2e по API: два верифицированных бота — заявка в друзья / приём, личка туда-обратно.

Статус: ${failed ? "ПРОВАЛ" : "УСПЕХ"}.

1. **Резюме** — риск для пользователя.
2. **UX (приоритет)** — трения «заявка → друзья → первый диалог»; какие **экраны чата/переписки** и **контакты** стоит подтянуть под **Telegram/WhatsApp** (пузыри, список, ввод, смайлики, аватары) — по смыслу сценария; тексты ошибок.
3. **API** — статусы, согласованность.
4. **Надёжность** — гонки, задержки.
5. **Улучшения (P1/P2/P3)** и **3 шага** владельцу; не меньше **8** пунктов с пометкой UX vs API где уместно.

--- Журнал (не копируй дословно, только факты) ---

${rawLog.slice(0, 14_000)}`;
    try {
      analysis = await groqText({ system, user, maxTokens: 4000 });
    } catch (e) {
      analysis = `Ошибка Groq: ${e.message || e}`;
    }
  }

  await mkdir(OUT, { recursive: true });
  const safeName = `social-${dateStr}`;
  const titleOk = failed ? "❌" : "✅";
  const md = `# ${titleOk} Соц QA — ${dateStr}

**Время (UTC):** ${timeStr}  
**API:** ${base}  
**Участники (username):** \`${userA}\`, \`${userB}\`

---

## Журнал

\`\`\`text
${rawLog}
\`\`\`

## Анализ (Groq) — идеи улучшений

${analysis}

---

*Сгенерировано: qa-bots/social-daily.mjs (см. токены или QA_EMAIL+QA_PASSWORD / QA_BOT2_*)*
`;
  await writeFile(path.join(OUT, `${safeName}.md`), md, "utf8");
  await writeIndexHtml(OUT);
  console.log("OK:", path.join(OUT, `${safeName}.md`));

  if (process.env.FTP_HOST && process.env.FTP_USER && process.env.FTP_PASS) {
    try {
      await uploadOutDir(OUT);
      console.log("FTP: залито в", process.env.FTP_QA_DIR || "qa-bots");
    } catch (e) {
      console.error("FTP ошибка:", e.message || e);
      process.exit(1);
    }
  } else {
    console.log("FTP не настроен — только qa-bots/out");
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

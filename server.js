// Backend мессенджера «Атон»: PostgreSQL (Prisma), почта через SMTP.

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const { prisma } = require("./lib/prisma");
const {
  ensureLists,
  ensureVerificationFlags,
  userFromPrismaRow,
  chatFromPrismaRow,
  messageFromPrismaRow,
  generateUniquePublicId,
} = require("./lib/aton-mappers");
const { fetchGolosReply, transcribeGolosAudioDataUrl, buildGolosBotReplyContent } = require("./lib/golos-groq");

/** Ключ в peerAliases — точный username из БД; peerUsername в запросе может отличаться регистром. */
async function findCanonicalUsernameForPeerAlias(peerUsername) {
  if (!peerUsername || typeof peerUsername !== "string") return null;
  if (peerUsername.length > 64) return null;
  const direct = await prisma.user.findUnique({ where: { username: peerUsername } });
  if (direct) return direct.username;
  const ci = await prisma.user.findFirst({
    where: { username: { equals: peerUsername, mode: "insensitive" } },
  });
  return ci ? ci.username : null;
}

const app = express();
/** Системный ассистент: один DM с каждым пользователем, без входа в аккаунт. */
const GOLOS_ATON_USERNAME = "golos_aton";
const GOLOS_ATON_EMAIL = "golos_aton@system.internal";
const GOLOS_RATE = new Map();
const GOLOS_RATE_WINDOW_MS = 60 * 60 * 1000;
/** 0 = без лимита (по умолчанию). Иначе — макс. обращений к Голосу Атона за окно. */
const GOLOS_MAX_PER_WINDOW = Math.max(0, parseInt(String(process.env.GOLOS_MAX_PER_WINDOW || "0"), 10) || 0);

function golosRateAllow(username) {
  if (!username) return true;
  if (GOLOS_MAX_PER_WINDOW <= 0) return true;
  if (GOLOS_RATE.size > 5000) {
    const keys = [...GOLOS_RATE.keys()];
    for (let i = 0; i < Math.floor(keys.length / 2); i++) {
      GOLOS_RATE.delete(keys[i]);
    }
  }
  const now = Date.now();
  const rec = GOLOS_RATE.get(username) || { count: 0, windowStart: now };
  if (now - rec.windowStart > GOLOS_RATE_WINDOW_MS) {
    rec.count = 0;
    rec.windowStart = now;
  }
  rec.count += 1;
  GOLOS_RATE.set(username, rec);
  return rec.count <= GOLOS_MAX_PER_WINDOW;
}

function dmChatIdForUsernames(a, b) {
  return [a, b].sort().join("|");
}

/** Собеседник в личке user|user, если в теле не пришло to (клиент мог опустить undefined в JSON). */
function dmPeerFromChatId(chatId, myUsername) {
  if (!myUsername || !chatId || typeof chatId !== "string" || !chatId.includes("|")) {
    return null;
  }
  if (chatId === "global" || chatId.startsWith("group:") || chatId.startsWith("channel:")) {
    return null;
  }
  const parts = chatId.split("|");
  if (parts.length !== 2) return null;
  const a = parts[0];
  const b = parts[1];
  if (a === myUsername) return b;
  if (b === myUsername) return a;
  return null;
}

/** Личка `user|user` — для неё считаем delivered/read; в global/группах поле status не меняем по этой логике. */
function isDirectMessageChatId(chatId) {
  return (
    typeof chatId === "string" &&
    chatId.includes("|") &&
    !chatId.startsWith("group:") &&
    !chatId.startsWith("channel:")
  );
}

/** Не тянуть passwordHash/sessionToken в память на каждый запрос */
const PRISMA_USER_SELECT_LIST = {
  id: true,
  email: true,
  username: true,
  publicId: true,
  displayName: true,
  bio: true,
  avatarDataUrl: true,
  lastSeen: true,
  createdAt: true,
  friends: true,
  blocked: true,
  friendRequestsIn: true,
  friendRequestsOut: true,
  verified: true,
  isVerified: true,
  isSuperAdmin: true,
  peerAliases: true,
};

/** Только владельцы чатов (по username) — для ensureChatFields, без findMany(all users) */
async function loadUsersByUsernameMap(ownerUsernames) {
  const unique = [...new Set((ownerUsernames || []).filter(Boolean))];
  if (unique.length === 0) return {};
  const rows = await prisma.user.findMany({
    where: { username: { in: unique } },
    select: PRISMA_USER_SELECT_LIST,
  });
  const map = {};
  for (const row of rows) {
    const u = userFromPrismaRow(row);
    if (u.username) map[u.username] = u;
  }
  return map;
}

/**
 * Лимит строк в GET /api/messages/all. 0 или не задано = без лимита (полная лента; иначе сайдбар
 * теряет чаты, у которых все сообщения старее N «самых новых» глобально).
 * Число ≥200 — только жёсткий потолок RAM (Render), напр. MESSAGES_BOOTSTRAP_MAX=50000.
 */
const MESSAGES_BOOTSTRAP_MAX = (() => {
  const raw = process.env.MESSAGES_BOOTSTRAP_MAX;
  if (raw === undefined || String(raw).trim() === "" || String(raw).trim() === "0") {
    return null;
  }
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n) || n < 200) return null;
  return Math.min(100_000, n);
})();

/** Просмотр списка сообщений: только участник global / лички / группы. */
async function assertUserCanAccessChat(req, chatId) {
  const uid = req.user.id;
  const uname = req.user.username;
  if (!chatId || typeof chatId !== "string") {
    return { ok: false, error: "Некорректный чат" };
  }
  if (chatId === "global") {
    return { ok: true };
  }
  if (chatId.startsWith("group:") || chatId.startsWith("channel:")) {
    const raw = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!raw) return { ok: false, error: "Чат не найден" };
    const usersByUsername = await loadUsersByUsernameMap([raw.owner]);
    const chat = ensureChatFields(chatFromPrismaRow(raw), usersByUsername);
    const members = Array.isArray(chat.members) ? chat.members : [];
    if (!members.includes(uid)) {
      return { ok: false, error: "Нет доступа к чату" };
    }
    return { ok: true };
  }
  const peer = dmPeerFromChatId(chatId, uname);
  if (!peer) {
    return { ok: false, error: "Некорректный чат" };
  }
  return { ok: true };
}

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

/**
 * Статусы доставки/прочтения. Для личек — только `user:username` (оба участника
 * в этих комнатах с момента connect; иначе дубли с `io.to(chatId)`). Для global/групп — room чата.
 */
function emitMessageStatusForChat(chatId, payload) {
  if (isDirectMessageChatId(chatId)) {
    const parts = String(chatId).split("|");
    if (parts.length === 2 && parts[0] && parts[1]) {
      io.to(`user:${parts[0]}`).emit("message:status", payload);
      io.to(`user:${parts[1]}`).emit("message:status", payload);
      return;
    }
  }
  io.to(chatId).emit("message:status", payload);
}

// Rate limiting — защита от brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много попыток. Повторите через 15 минут." },
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов сброса. Повторите через час." },
});

const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много попыток регистрации. Повторите через 10 минут." },
});

// Дебаунс lastSeen: uid → timestamp последней записи
const lastSeenWriteCache = new Map();
const LAST_SEEN_DEBOUNCE_MS = 30_000;

app.use(express.json({ limit: "8mb" }));
// Кросс-доменные запросы: фронт на хостинге, API на Render и т.д.
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o) res.setHeader("Access-Control-Allow-Origin", o);
  else res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.static(__dirname));

/** Лёгкая проверка для мониторинга и CI (без БД-логики в ответе). */
app.get("/api/health", async (req, res) => {
  const out = { ok: true, service: "aton-api", ts: new Date().toISOString() };
  try {
    out.groqKeyConfigured = Boolean(String(process.env.GROQ_API_KEY || "").trim());
    out.openaiTtsConfigured = Boolean(String(process.env.OPENAI_API_KEY || "").trim());
    out.golosMaxPerWindow = GOLOS_MAX_PER_WINDOW;
    out.golosRateUnlimited = GOLOS_MAX_PER_WINDOW <= 0;
    out.messagesBootstrapMax = MESSAGES_BOOTSTRAP_MAX == null ? "unlimited" : MESSAGES_BOOTSTRAP_MAX;
    out.nodeFetch = typeof globalThis.fetch === "function";
    out.nodeVersion = process.version;
    const golos = await prisma.user.findUnique({
      where: { username: GOLOS_ATON_USERNAME },
      select: { id: true, username: true },
    });
    out.golosUserExists = Boolean(golos);
  } catch (e) {
    out.dbError = e instanceof Error ? e.message : String(e);
  }
  res.json(out);
});

// SPA: ссылка приглашения /join/:token → index.html
app.get("/join/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Socket.io: middleware авторизации по sessionToken
io.use(async (socket, next) => {
  let token = socket.handshake.auth?.token;
  if (!token) {
    const h = socket.handshake.headers?.authorization || "";
    const m = String(h).match(/^Bearer\s+(.+)$/i);
    if (m) token = m[1];
  }
  if (!token) {
    // Разрешаем анонимные соединения, но socket.user будет null
    socket.user = null;
    return next();
  }

  let pgUser = null;
  try {
    pgUser = await findUserBySessionToken(token);
  } catch (err) {
    console.error("socket.io prisma auth:", err);
  }

  if (pgUser) {
    socket.user = { id: pgUser.id, username: pgUser.username };
    return next();
  }

  socket.user = null;
  next();
});

io.on("connection", (socket) => {
  if (socket.user && socket.user.username) {
    socket.join(`user:${socket.user.username}`);
  }

  socket.on("join_chat", async (chatId) => {
    if (!chatId || typeof chatId !== "string") return;

    if (chatId === "global") {
      socket.join("global");
      return;
    }

    // Для личных чатов (формат "alice|bob") — только если пользователь один из участников
    if (!chatId.startsWith("group:") && !chatId.startsWith("channel:")) {
      if (!socket.user) return;
      const parts = chatId.split("|");
      if (!parts.includes(socket.user.username)) return;
      socket.join(chatId);
      return;
    }

    // Для групп/каналов — проверяем членство в БД
    if (!socket.user) return;
    let chatRow = null;
    try {
      chatRow = await prisma.chat.findUnique({ where: { id: chatId } });
    } catch (err) {
      console.error("join_chat prisma:", err);
      return;
    }
    if (!chatRow) return;
    const raw = chatRow.members;
    const members = Array.isArray(raw) ? raw : [];
    if (!members.includes(socket.user.id)) return;
    socket.join(chatId);
  });

  socket.on("leave_chat", (chatId) => {
    if (!chatId || typeof chatId !== "string") return;
    socket.leave(chatId);
  });

  socket.on("disconnect", () => {});
});

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** Сколько сессий хранить на пользователя (новые не вытесняют сразу; старые удаляем при превышении). */
const MAX_ACTIVE_SESSIONS = Math.min(
  200,
  Math.max(5, parseInt(String(process.env.ATON_MAX_ACTIVE_SESSIONS || "40"), 10) || 40)
);

/**
 * Сессия в таблице `sessions` ИЛИ legacy `users.sessionToken` (пока оба валидны).
 */
async function findUserBySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const sess = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (sess?.user) return sess.user;
  } catch (err) {
    console.error("findUserBySessionToken (sessions):", err);
  }
  try {
    return await prisma.user.findFirst({ where: { sessionToken: token } });
  } catch (err) {
    console.error("findUserBySessionToken (legacy):", err);
    return null;
  }
}

async function pruneExcessUserSessions(userId) {
  try {
    const all = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (all.length <= MAX_ACTIVE_SESSIONS) return;
    const toDelete = all.slice(MAX_ACTIVE_SESSIONS).map((s) => s.id);
    if (toDelete.length) {
      await prisma.session.deleteMany({ where: { id: { in: toDelete } } });
    }
  } catch (e) {
    console.error("pruneExcessUserSessions:", e);
  }
}

function ensureChatFields(chat, usersByUsername) {
  // owner (username) используется текущим UI и логикой удаления, поэтому не трогаем.
  if (!chat || typeof chat !== "object") return chat;

  // Преобразуем owner(username) → ownerId(user.id)
  const ownerId = chat.ownerId || usersByUsername?.[chat.owner]?.id || null;

  const visibility =
    chat.visibility === "private" ? "private" : "public";

  let inviteToken = chat.inviteToken;
  if (visibility === "private") {
    if (!inviteToken || typeof inviteToken !== "string") {
      inviteToken = generateToken();
    }
  } else {
    inviteToken = null;
  }

  const normalized = {
    ...chat,
    ownerId: chat.ownerId ?? ownerId,
    members:
      Array.isArray(chat.members) ? chat.members : ownerId ? [ownerId] : [],
    admins:
      Array.isArray(chat.admins) ? chat.admins : ownerId ? [ownerId] : [],
    avatarDataUrl:
      chat.avatarDataUrl === undefined ? null : chat.avatarDataUrl,
    verified: chat.verified === undefined ? false : chat.verified,
    description: chat.description !== undefined ? chat.description : null,
    visibility,
    inviteToken,
  };

  return normalized;
}

function createMailTransport() {
  const { ATON_SMTP_HOST, ATON_SMTP_PORT, ATON_SMTP_USER, ATON_SMTP_PASS } = process.env;
  if (!ATON_SMTP_HOST || !ATON_SMTP_USER || !ATON_SMTP_PASS) {
    console.warn("SMTP не настроен, письма будут логироваться в консоль.");
    return null;
  }
  return nodemailer.createTransport({
    host: ATON_SMTP_HOST,
    port: Number(ATON_SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: ATON_SMTP_USER,
      pass: ATON_SMTP_PASS,
    },
  });
}

const mailer = createMailTransport();

async function sendMail(to, subject, text) {
  if (!mailer) {
    console.log("=== Письмо (только лог, SMTP не настроен) ===");
    console.log("Кому:", to);
    console.log("Тема:", subject);
    console.log(text);
    console.log("===========================================");
    return;
  }
  await mailer.sendMail({
    from: process.env.ATON_FROM_EMAIL || process.env.ATON_SMTP_USER,
    to,
    subject,
    text,
  });
}

/** Письмо получателю при новой заявке в друзья */
async function sendFriendRequestEmail({ to, senderDisplayName, senderUsername }) {
  if (!to || !String(to).includes("@")) return;
  const baseUrl = (process.env.ATON_PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
  const who = `${senderDisplayName} (@${senderUsername})`;
  const subject = `${senderDisplayName} хочет добавить вас в друзья в Атоне`;
  const text = [
    `Здравствуйте!`,
    ``,
    `${who} отправил(а) вам заявку в друзья в мессенджере «Атон».`,
    ``,
    `Откройте приложение, чтобы принять или отклонить заявку в разделе «Друзья» (иконка людей в шапке):`,
    `${baseUrl}/`,
    ``,
    `Если вы не ожидали это письмо, просто проигнорируйте его.`,
    ``,
    `— Атон`,
  ].join("\n");
  try {
    await sendMail(to, subject, text);
  } catch (e) {
    console.error("sendFriendRequestEmail:", e);
  }
}

function isUserOnline(username) {
  for (const [, s] of io.sockets.sockets) {
    if (s.user && s.user.username === username) return true;
  }
  return false;
}

async function notifyNewMessage(msg, sender) {
  if (!mailer) return;
  const preview =
    msg.type === "text"
      ? (msg.text || "").slice(0, 120)
      : msg.type === "audio"
        ? "🎤 Голосовое сообщение"
        : msg.type === "image"
          ? "🖼 Изображение"
          : "Новое сообщение";

  const chatId = msg.chatId;
  // messageFromPrismaRow отдаёт получателя как `to`; в БД поле — recipientUsername
  const recipientUsername = msg.recipientUsername || msg.to;

  if (recipientUsername) {
    if (recipientUsername === GOLOS_ATON_USERNAME) return; // письмо на системного бота не отправляем
    // DM — notify recipient only
    if (isUserOnline(recipientUsername)) return;
    try {
      const recipient = await prisma.user.findUnique({
        where: { username: recipientUsername },
      });
      if (recipient?.email) {
        const fromLabel = sender && (sender.displayName || sender.username);
        await sendMail(
          recipient.email,
          `Новое сообщение от ${fromLabel}`,
          [
            `${fromLabel} написал(а) вам:`,
            ``,
            preview,
            ``,
            `Откройте Атон, чтобы ответить.`,
          ].join("\n")
        );
      }
    } catch (e) {
      console.error("notifyNewMessage DM:", e);
    }
    return;
  }

  // Group / channel / global — notify all participants except sender
  if (chatId === "global") return; // skip global chat notifications
  try {
    const chatRow = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chatRow) return;
    const memberIds = Array.isArray(chatRow.members) ? chatRow.members : [];
    if (memberIds.length === 0) return;

    const members = await prisma.user.findMany({
      where: { id: { in: memberIds } },
    });
    const chatName = chatRow.name || chatId;

    for (const member of members) {
      if (member.username === sender.username) continue;
      if (isUserOnline(member.username)) continue;
      if (!member.email) continue;
      sendMail(
        member.email,
        `Новое сообщение в «${chatName}»`,
        [
          `${sender.username} в «${chatName}»:`,
          ``,
          preview,
          ``,
          `Откройте Атон, чтобы прочитать.`,
        ].join("\n")
      ).catch((e) => console.error("notifyNewMessage group mail:", e));
    }
  } catch (e) {
    console.error("notifyNewMessage group:", e);
  }
}

async function postGolosAtonMessage({ text, toUsername, chatId, type = "text", audioDataUrl = null }) {
  const msgId = generateToken();
  const now = new Date();
  const msgType = type === "audio" && audioDataUrl ? "audio" : "text";
  const row = await prisma.message.create({
    data: {
      id: msgId,
      chatId,
      senderUsername: GOLOS_ATON_USERNAME,
      recipientUsername: toUsername,
      type: msgType,
      text: text || "",
      imageDataUrl: null,
      audioDataUrl: msgType === "audio" && audioDataUrl ? audioDataUrl : null,
      createdAt: now,
      editedAt: null,
      replyTo: null,
      pinned: false,
      reactions: [],
      status: "sent",
    },
  });
  const msg = messageFromPrismaRow(row);
  io.to(msg.chatId).emit("message:new", msg);
  if (msg.to) {
    io.to(`user:${msg.to}`).emit("message:new", msg);
    io.to(`user:${msg.from}`).emit("message:new", msg);
  }
  notifyNewMessage(msg, { username: GOLOS_ATON_USERNAME, displayName: "Голос Атона" }).catch((e) =>
    console.error("notifyNewMessage (golos):", e)
  );
}

function userMessageToGolosAton(saved, authorUsername) {
  if (saved && saved.to === GOLOS_ATON_USERNAME) return true;
  if (!saved || !authorUsername) return false;
  const p = dmPeerFromChatId(String(saved.chatId || ""), authorUsername);
  return p === GOLOS_ATON_USERNAME;
}

/** История в формате ChatGPT: user/assistant по сообщениям в личке с ботом. */
async function buildGolosLlmHistory(chatId, userUsername, currentMsg, currentUserText) {
  const maxN = (() => {
    const n = parseInt(String(process.env.GOLOS_HISTORY_MAX_MESSAGES || "40"), 10);
    return Number.isFinite(n) && n >= 2 ? Math.min(100, n) : 40;
  })();
  const rows = await prisma.message.findMany({
    where: { chatId: String(chatId) },
    orderBy: { createdAt: "desc" },
    take: maxN,
  });
  rows.reverse();
  const out = [];
  for (const row of rows) {
    if (row.senderUsername === userUsername) {
      let c = (row.text || "").trim();
      if (row.type === "image" && row.imageDataUrl) c = c || "«[изображение]»";
      if (row.type === "audio" && !c) c = "«[голосовое сообщение]»";
      if (row.id === currentMsg.id) c = (currentUserText || "").trim() || c;
      if (!c) c = "…";
      out.push({ role: "user", content: c });
    } else if (row.senderUsername === GOLOS_ATON_USERNAME) {
      let c = (row.text || "").trim();
      if (row.type === "audio" && !c) c = "«[голосовой ответ]»";
      if (!c) c = "…";
      out.push({ role: "assistant", content: c });
    }
  }
  if (!out.length) {
    return [{ role: "user", content: (currentUserText || "").trim() || "…" }];
  }
  if (out[out.length - 1].role === "assistant") {
    out.push({ role: "user", content: (currentUserText || "").trim() || "…" });
  }
  return out;
}

async function processGolosAtonUserReply({ savedUserMsg, authorUsername, authorId }) {
  if (!userMessageToGolosAton(savedUserMsg, authorUsername)) {
    return;
  }
  const isAudio = savedUserMsg.type === "audio" && String(savedUserMsg.audioDataUrl || "").trim();
  const isText = savedUserMsg.type === "text" && String(savedUserMsg.text || "").trim();
  if (!isAudio && !isText) return;

  const chatId = savedUserMsg.chatId || dmChatIdForUsernames(authorUsername, GOLOS_ATON_USERNAME);
  if (!golosRateAllow(authorUsername)) {
    await postGolosAtonMessage({
      text: "Вы достигли лимита сообщений к помощнику на этот час. Попробуйте позже.",
      toUsername: authorUsername,
      chatId,
    });
    return;
  }
  const authorRow = await prisma.user.findUnique({ where: { id: authorId } });
  const u = authorRow ? userFromPrismaRow(authorRow) : { username: authorUsername, displayName: authorUsername };

  let userText = "";
  if (isText) {
    userText = String(savedUserMsg.text).trim();
  } else {
    try {
      userText = await transcribeGolosAudioDataUrl(savedUserMsg.audioDataUrl);
    } catch (e) {
      console.error("transcribeGolosAudioDataUrl:", e);
    }
    userText = String(userText || "").trim();
    if (!userText) {
      await postGolosAtonMessage({
        type: "text",
        text: "Не разобрал голосовое сообщение. Скажите, пожалуйста, ещё раз или напишите текстом.",
        toUsername: authorUsername,
        chatId,
      });
      return;
    }
  }

  let replyText;
  try {
    const history = await buildGolosLlmHistory(chatId, authorUsername, savedUserMsg, userText);
    replyText = await fetchGolosReply({
      history,
      username: u.username,
      displayName: u.displayName,
      fromVoice: Boolean(isAudio),
    });
  } catch (e) {
    console.error("fetchGolosReply:", e);
    replyText = "Произошла ошибка. Попробуйте позже.";
  }

  const body = await buildGolosBotReplyContent(replyText, { asVoice: Boolean(isAudio) });
  await postGolosAtonMessage({
    type: body.type,
    text: body.text,
    audioDataUrl: body.audioDataUrl || null,
    toUsername: authorUsername,
    chatId,
  });
}

async function ensureGolosAtonUser() {
  try {
    const existing = await prisma.user.findUnique({ where: { username: GOLOS_ATON_USERNAME } });
    if (existing) return;
    const id = generateToken();
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    const publicId = await generateUniquePublicId(prisma, "golos");
    const verifyToken = generateToken();
    await prisma.user.create({
      data: {
        id,
        email: GOLOS_ATON_EMAIL,
        username: GOLOS_ATON_USERNAME,
        displayName: "Голос Атона",
        passwordHash,
        publicId,
        bio: "Помощник в мессенджере «Атон».",
        avatarDataUrl: null,
        sessionToken: null,
        lastSeen: new Date(),
        createdAt: new Date(),
        verified: true,
        isVerified: true,
        isSuperAdmin: false,
        verifyToken,
        resetToken: null,
        resetTokenExp: null,
        friends: [],
        blocked: [],
        friendRequestsIn: [],
        friendRequestsOut: [],
      },
    });
    console.log(`Создан системный пользователь «Голос Атона» (${GOLOS_ATON_USERNAME}).`);
  } catch (e) {
    if (e.code === "P2002") return;
    console.error("ensureGolosAtonUser:", e);
  }
}

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) return res.status(401).json({ error: "Нет токена" });

    let pgUser = null;
    try {
      pgUser = await findUserBySessionToken(token);
    } catch (err) {
      console.error("authMiddleware prisma lookup:", err);
    }

    if (pgUser) {
      const user = userFromPrismaRow(pgUser);
      ensureLists(user);
      ensureVerificationFlags(user);

      const uid = user.id;
      const now = Date.now();
      const lastWrite = lastSeenWriteCache.get(uid) || 0;
      if (now - lastWrite >= LAST_SEEN_DEBOUNCE_MS) {
        const iso = new Date(now).toISOString();
        user.lastSeen = iso;
        lastSeenWriteCache.set(uid, now);
        try {
          await prisma.user.update({
            where: { id: uid },
            data: { lastSeen: new Date(now) },
          });
        } catch (err) {
          console.error("authMiddleware lastSeen prisma:", err);
        }
      }

      req.user = user;
      req.user.verified = Boolean(pgUser.verified);
      return next();
    }

    return res.status(401).json({ error: "Неверный токен" });
  } catch (err) {
    console.error("authMiddleware:", err);
    next(err);
  }
}

function requireVerified(req, res, next) {
  if (!req.user || !req.user.verified) {
    return res.status(403).json({ error: "Подтвердите email для доступа к сервису" });
  }
  next();
}

// Регистрация
app.post("/api/register", registerLimiter, async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) {
    return res.status(400).json({ error: "email, username и password обязательны" });
  }
  if (String(username).toLowerCase() === GOLOS_ATON_USERNAME) {
    return res.status(400).json({ error: "Это имя зарезервировано" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verifyToken = generateToken();
  const sessionToken = generateToken();
  const userId = generateToken();

  try {
    const publicId = await generateUniquePublicId(prisma, username);
    const row = await prisma.user.create({
      data: {
        id: userId,
        email,
        username,
        displayName: username,
        passwordHash,
        publicId,
        bio: "",
        avatarDataUrl: null,
        sessionToken,
        lastSeen: new Date(),
        createdAt: new Date(),
        verified: false,
        isVerified: false,
        isSuperAdmin: false,
        verifyToken,
        resetToken: null,
        resetTokenExp: null,
        friends: [],
        blocked: [],
        friendRequestsIn: [],
        friendRequestsOut: [],
      },
    });

    await prisma.session.create({
      data: {
        id: generateToken(),
        userId,
        token: sessionToken,
      },
    });

    const user = userFromPrismaRow(row);
    const baseUrl = process.env.ATON_PUBLIC_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/?verify=${verifyToken}`;
    await sendMail(
      email,
      "Добро пожаловать в Атон!",
      [
        `Здравствуйте, ${username}!`,
        ``,
        `Добро пожаловать в мессенджер «Атон» — спокойные диалоги под солнцем Ахетатона.`,
        ``,
        `Ваш аккаунт создан. Вот что можно сделать:`,
        `• Найдите друзей по @username`,
        `• Создайте групповой чат или канал`,
        `• Настройте профиль — имя, аватар и статус`,
        ``,
        `Подтвердите почту по ссылке:`,
        verifyLink,
        ``,
        `Если вы не регистрировались — просто игнорируйте это письмо.`,
        ``,
        `— Атон`,
      ].join("\n")
    );

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        publicId: user.publicId,
        displayName: user.displayName,
        email: user.email,
        avatarDataUrl: user.avatarDataUrl,
        verified: false,
        peerAliases: user.peerAliases || {},
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ error: "Имя пользователя или почта уже заняты" });
    }
    console.error("register:", err);
    res.status(500).json({ error: "Не удалось зарегистрироваться" });
  }
});

// Подтверждение email по ссылке из письма
app.get("/api/verify-email", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Токен отсутствует" });
  try {
    const row = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (!row) return res.status(400).json({ error: "Неверный или устаревший токен" });
    await prisma.user.update({
      where: { id: row.id },
      data: { verified: true, verifyToken: null },
    });
    res.json({ ok: true, username: row.username });
  } catch (err) {
    console.error("verify-email:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Повторная отправка письма подтверждения
app.post("/api/resend-verify", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email обязателен" });
  try {
    const row = await prisma.user.findUnique({ where: { email } });
    if (!row || row.verified) return res.json({ ok: true });
    let token = row.verifyToken;
    if (!token) {
      token = generateToken();
      await prisma.user.update({ where: { id: row.id }, data: { verifyToken: token } });
    }
    const baseUrl = process.env.ATON_PUBLIC_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/?verify=${token}`;
    await sendMail(
      email,
      "Атон — подтверждение почты",
      [
        `Здравствуйте, ${row.username}!`,
        ``,
        `Подтвердите почту по ссылке:`,
        verifyLink,
        ``,
        `— Атон`,
      ].join("\n")
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("resend-verify:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Вход (по email или username)
app.post("/api/login", loginLimiter, async (req, res) => {
  const { email, username, password } = req.body || {};

  let pgUser = null;
  try {
    if (email) {
      pgUser = await prisma.user.findUnique({ where: { email } });
    } else if (username) {
      pgUser = await prisma.user.findUnique({ where: { username } });
    }
  } catch (err) {
    console.error("prisma login lookup:", err);
    return res.status(500).json({ error: "Ошибка сервера" });
  }

  if (!pgUser) return res.status(401).json({ error: "Неверное имя или пароль" });
  if (pgUser.username === GOLOS_ATON_USERNAME) {
    return res.status(403).json({ error: "Вход в этот аккаунт невозможен" });
  }
  const ok = await bcrypt.compare(password, pgUser.passwordHash);
  if (!ok) return res.status(401).json({ error: "Неверное имя или пароль" });

  const sessionToken = generateToken();

  try {
    await prisma.session.create({
      data: {
        id: generateToken(),
        userId: pgUser.id,
        token: sessionToken,
      },
    });
    await pruneExcessUserSessions(pgUser.id);
  } catch (err) {
    console.error("prisma login session create:", err);
    return res.status(500).json({ error: "Не удалось войти" });
  }

  const user = userFromPrismaRow(pgUser);
  res.json({
    token: sessionToken,
    user: {
      id: user.id,
      username: user.username,
      publicId: user.publicId,
      displayName: user.displayName,
      email: user.email,
      avatarDataUrl: user.avatarDataUrl,
      verified: Boolean(pgUser.verified),
      peerAliases: user.peerAliases || {},
    },
  });
});

// Текущий пользователь
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    let row = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!row) return res.status(404).json({ error: "Пользователь не найден" });
    let u = userFromPrismaRow(row);
    ensureLists(u);
    ensureVerificationFlags(u);
    if (!u.publicId) {
      u.publicId = await generateUniquePublicId(prisma, u.username);
      await prisma.user.update({ where: { id: u.id }, data: { publicId: u.publicId } });
    }
    res.json({
      id: u.id,
      username: u.username,
      publicId: u.publicId,
      displayName: u.displayName,
      email: u.email,
      avatarDataUrl: u.avatarDataUrl,
      bio: u.bio,
      lastSeen: u.lastSeen || null,
      verified: Boolean(row.verified),
      isVerified: Boolean(u.isVerified),
      isSuperAdmin: Boolean(u.isSuperAdmin),
      peerAliases: u.peerAliases || {},
    });
  } catch (err) {
    console.error("GET /api/me:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** Удалить текущую сессию (строка в `sessions` и при совпадении — legacy `users.sessionToken`). */
app.post("/api/logout", authMiddleware, async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const parts = header.split(" ");
    const sessionTok = parts.length >= 2 ? parts[1] : null;
    if (sessionTok) {
      await prisma.session.deleteMany({ where: { token: sessionTok } });
      await prisma.user.updateMany({
        where: { id: req.user.id, sessionToken: sessionTok },
        data: { sessionToken: null },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/logout:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** Один псевдоним собеседника; синхронно на всех устройствах (хранится в БД). */
app.put("/api/peer-alias", authMiddleware, requireVerified, async (req, res) => {
  const { peerUsername, alias } = req.body || {};
  try {
    if (!peerUsername || typeof peerUsername !== "string") {
      return res.status(400).json({ error: "Укажите peerUsername" });
    }
    if (peerUsername.length > 64) {
      return res.status(400).json({ error: "Некорректный peerUsername" });
    }
    const row = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!row) return res.status(404).json({ error: "Пользователь не найден" });
    const u = userFromPrismaRow(row);
    const next = { ...(u.peerAliases && typeof u.peerAliases === "object" ? u.peerAliases : {}) };
    const canonical = await findCanonicalUsernameForPeerAlias(peerUsername);
    if (!canonical) {
      return res.status(400).json({ error: "Пользователь не найден" });
    }
    if (canonical === u.username) {
      return res.status(400).json({ error: "Нельзя задать псевдоним себе" });
    }
    const t = alias == null || alias === "" ? "" : String(alias).trim();
    for (const k of Object.keys({ ...next })) {
      if (k.toLowerCase() === canonical.toLowerCase()) delete next[k];
    }
    if (t) {
      if (t.length > 120) {
        return res.status(400).json({ error: "Слишком длинное имя (макс. 120 символов)" });
      }
      next[canonical] = t;
    }
    if (Object.keys(next).length > 400) {
      return res.status(400).json({ error: "Слишком много переименований" });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { peerAliases: next },
    });
    res.json({ ok: true, peerAliases: next });
  } catch (err) {
    console.error("PUT /api/peer-alias:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

/** Слияние map из старого localStorage (одноразовая миграция). */
app.put("/api/peer-aliases/merge", authMiddleware, requireVerified, async (req, res) => {
  const { merge } = req.body || {};
  try {
    if (!merge || typeof merge !== "object" || Array.isArray(merge)) {
      return res.status(400).json({ error: "Нужен объект merge" });
    }
    const row = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!row) return res.status(404).json({ error: "Пользователь не найден" });
    const u = userFromPrismaRow(row);
    const base = { ...(u.peerAliases && typeof u.peerAliases === "object" ? u.peerAliases : {}) };
    for (const [k, v] of Object.entries(merge)) {
      if (typeof k !== "string" || k.length > 64) continue;
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (!t) continue;
      if (t.length > 120) continue;
      const canonical = await findCanonicalUsernameForPeerAlias(k);
      if (!canonical || canonical === u.username) continue;
      let hasForPeer = false;
      for (const bk of Object.keys(base)) {
        if (bk.toLowerCase() === canonical.toLowerCase() && String(base[bk] || "").trim()) {
          hasForPeer = true;
          break;
        }
      }
      if (hasForPeer) continue;
      for (const bk of Object.keys({ ...base })) {
        if (bk.toLowerCase() === canonical.toLowerCase() && bk !== canonical) delete base[bk];
      }
      base[canonical] = t;
    }
    if (Object.keys(base).length > 400) {
      return res.status(400).json({ error: "Слишком много переименований" });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { peerAliases: base },
    });
    res.json({ ok: true, peerAliases: base });
  } catch (err) {
    console.error("PUT /api/peer-aliases/merge:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

function clearPendingBetweenUsers(me, target) {
  const ta = target.username;
  const my = me.username;
  me.friendRequestsIn = (me.friendRequestsIn || []).filter((u) => u !== ta);
  me.friendRequestsOut = (me.friendRequestsOut || []).filter((u) => u !== ta);
  target.friendRequestsIn = (target.friendRequestsIn || []).filter((u) => u !== my);
  target.friendRequestsOut = (target.friendRequestsOut || []).filter((u) => u !== my);
}

function mutualAddFriendsUsers(me, target) {
  ensureLists(me);
  ensureLists(target);
  if (!me.friends.includes(target.username)) me.friends.push(target.username);
  if (!target.friends.includes(me.username)) target.friends.push(me.username);
  clearPendingBetweenUsers(me, target);
}

// Контакты: друзья, заявки, заблокированные
app.get("/api/contacts", authMiddleware, requireVerified, async (req, res) => {
  try {
    const meRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!meRow) return res.status(404).json({ error: "Пользователь не найден" });
    const me = userFromPrismaRow(meRow);
    ensureLists(me);

    const names = [
      ...new Set([
        ...(me.friends || []),
        ...(me.blocked || []),
        ...(me.friendRequestsIn || []),
        ...(me.friendRequestsOut || []),
      ]),
    ].filter(Boolean);
    const others =
      names.length > 0
        ? await prisma.user.findMany({ where: { username: { in: names } } })
        : [];
    const byName = Object.fromEntries(others.map((r) => [r.username, userFromPrismaRow(r)]));

    const toSummary = (u) => ({
      id: u.id,
      username: u.username,
      publicId: u.publicId,
      displayName: u.displayName,
      avatarDataUrl: u.avatarDataUrl,
      lastSeen: u.lastSeen || null,
    });

    const friends = (me.friends || []).map((n) => byName[n]).filter(Boolean).map(toSummary);
    const blocked = (me.blocked || []).map((n) => byName[n]).filter(Boolean).map(toSummary);
    const requestsIn = (me.friendRequestsIn || []).map((n) => byName[n]).filter(Boolean).map(toSummary);
    const requestsOut = (me.friendRequestsOut || []).map((n) => byName[n]).filter(Boolean).map(toSummary);

    res.json({ friends, blocked, requestsIn, requestsOut });
  } catch (err) {
    console.error("GET /api/contacts:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Обновление профиля
app.post("/api/profile", authMiddleware, requireVerified, async (req, res) => {
  const { displayName, bio, avatarDataUrl, publicId } = req.body || {};
  try {
    const row = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!row) return res.status(404).json({ error: "Пользователь не найден" });

    const data = {};
    if (displayName) data.displayName = displayName;
    data.bio = bio || "";
    if (avatarDataUrl !== undefined) data.avatarDataUrl = avatarDataUrl;

    if (publicId !== undefined) {
      const trimmed = String(publicId).trim();
      if (!trimmed) {
        return res.status(400).json({ error: "ID не может быть пустым" });
      }
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(trimmed)) {
        return res
          .status(400)
          .json({ error: "ID может содержать только латинские буквы, цифры, подчёркивание и дефис (3–32 символа)." });
      }
      const taken = await prisma.user.findFirst({
        where: { publicId: trimmed, NOT: { id: req.user.id } },
      });
      if (taken) {
        return res.status(400).json({ error: "Такой ID уже используется другим пользователем." });
      }
      data.publicId = trimmed;
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });
    const u = userFromPrismaRow(updated);
    ensureVerificationFlags(u);
    res.json({
      id: u.id,
      username: u.username,
      publicId: u.publicId,
      displayName: u.displayName,
      email: u.email,
      avatarDataUrl: u.avatarDataUrl,
      bio: u.bio,
      verified: Boolean(updated.verified),
      isVerified: Boolean(u.isVerified),
      isSuperAdmin: Boolean(u.isSuperAdmin),
      peerAliases: u.peerAliases || {},
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ error: "Такой ID уже используется другим пользователем." });
    }
    console.error("POST /api/profile:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Заявка в друзья (или принятие, если заявка уже была)
app.post("/api/contacts/add", authMiddleware, requireVerified, async (req, res) => {
  const { username, publicId } = req.body || {};
  let friendRequestEmailPayload = null;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const meRow = await tx.user.findUnique({ where: { id: req.user.id } });
      if (!meRow) {
        const e = new Error("notfound");
        e.code = "NOTFOUND";
        throw e;
      }
      const me = userFromPrismaRow(meRow);
      ensureLists(me);

      let targetRow = null;
      if (username) targetRow = await tx.user.findUnique({ where: { username } });
      if (!targetRow && publicId) targetRow = await tx.user.findUnique({ where: { publicId } });
      if (!targetRow) {
        const e = new Error("notarget");
        e.code = "NOTARGET";
        throw e;
      }
      const target = userFromPrismaRow(targetRow);
      ensureLists(target);

      if (target.id === me.id) {
        const e = new Error("self");
        e.code = "SELF";
        throw e;
      }

      if (target.blocked.includes(me.username) || me.blocked.includes(target.username)) {
        const e = new Error("blocked");
        e.code = "BLOCKED";
        throw e;
      }

      if (me.friends.includes(target.username)) {
        return { status: "friends" };
      }

      // У вас уже есть входящая заявка от этого человека — принимаем в друзья
      if (me.friendRequestsIn.includes(target.username)) {
        mutualAddFriendsUsers(me, target);
        await tx.user.update({
          where: { id: me.id },
          data: {
            friends: me.friends,
            friendRequestsIn: me.friendRequestsIn,
            friendRequestsOut: me.friendRequestsOut,
          },
        });
        await tx.user.update({
          where: { id: target.id },
          data: {
            friends: target.friends,
            friendRequestsIn: target.friendRequestsIn,
            friendRequestsOut: target.friendRequestsOut,
          },
        });
        return { status: "accepted" };
      }

      // Они раньше отправили вам заявку (симметрия по out/in)
      if (target.friendRequestsOut.includes(me.username)) {
        mutualAddFriendsUsers(me, target);
        await tx.user.update({
          where: { id: me.id },
          data: {
            friends: me.friends,
            friendRequestsIn: me.friendRequestsIn,
            friendRequestsOut: me.friendRequestsOut,
          },
        });
        await tx.user.update({
          where: { id: target.id },
          data: {
            friends: target.friends,
            friendRequestsIn: target.friendRequestsIn,
            friendRequestsOut: target.friendRequestsOut,
          },
        });
        return { status: "accepted" };
      }

      if (me.friendRequestsOut.includes(target.username)) {
        const e = new Error("pending");
        e.code = "PENDING";
        throw e;
      }

      if (!target.friendRequestsIn.includes(me.username)) target.friendRequestsIn.push(me.username);
      if (!me.friendRequestsOut.includes(target.username)) me.friendRequestsOut.push(target.username);

      await tx.user.update({
        where: { id: me.id },
        data: { friendRequestsIn: me.friendRequestsIn, friendRequestsOut: me.friendRequestsOut },
      });
      await tx.user.update({
        where: { id: target.id },
        data: { friendRequestsIn: target.friendRequestsIn, friendRequestsOut: target.friendRequestsOut },
      });
      friendRequestEmailPayload = {
        to: targetRow.email,
        senderDisplayName: me.displayName || me.username,
        senderUsername: me.username,
      };
      return { status: "requested" };
    });
    res.json({ ok: true, ...result });
    if (friendRequestEmailPayload && friendRequestEmailPayload.to) {
      sendFriendRequestEmail(friendRequestEmailPayload).catch((e) =>
        console.error("POST /api/contacts/add friend request email:", e)
      );
    }
  } catch (err) {
    if (err.code === "NOTFOUND") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOTARGET") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "SELF") return res.status(400).json({ error: "Нельзя добавить себя в друзья" });
    if (err.code === "PENDING") {
      return res.status(400).json({ error: "Заявка уже отправлена. Дождитесь ответа или отмените её." });
    }
    if (err.code === "BLOCKED") {
      return res
        .status(400)
        .json({ error: "Нельзя добавить в друзья пользователя с ограниченным доступом." });
    }
    console.error("POST /api/contacts/add:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/contacts/accept", authMiddleware, requireVerified, async (req, res) => {
  const { username, publicId } = req.body || {};
  try {
    await prisma.$transaction(async (tx) => {
      const meRow = await tx.user.findUnique({ where: { id: req.user.id } });
      if (!meRow) {
        const e = new Error("notfound");
        e.code = "NOTFOUND";
        throw e;
      }
      const me = userFromPrismaRow(meRow);
      ensureLists(me);

      let targetRow = null;
      if (username) targetRow = await tx.user.findUnique({ where: { username } });
      if (!targetRow && publicId) targetRow = await tx.user.findUnique({ where: { publicId } });
      if (!targetRow) {
        const e = new Error("notarget");
        e.code = "NOTARGET";
        throw e;
      }
      const target = userFromPrismaRow(targetRow);
      ensureLists(target);

      if (!me.friendRequestsIn.includes(target.username)) {
        const e = new Error("noin");
        e.code = "NOIN";
        throw e;
      }

      mutualAddFriendsUsers(me, target);
      await tx.user.update({
        where: { id: me.id },
        data: {
          friends: me.friends,
          friendRequestsIn: me.friendRequestsIn,
          friendRequestsOut: me.friendRequestsOut,
        },
      });
      await tx.user.update({
        where: { id: target.id },
        data: {
          friends: target.friends,
          friendRequestsIn: target.friendRequestsIn,
          friendRequestsOut: target.friendRequestsOut,
        },
      });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "NOTFOUND") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOTARGET") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOIN") return res.status(400).json({ error: "Нет входящей заявки от этого пользователя." });
    console.error("POST /api/contacts/accept:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/contacts/decline", authMiddleware, requireVerified, async (req, res) => {
  const { username, publicId } = req.body || {};
  try {
    await prisma.$transaction(async (tx) => {
      const meRow = await tx.user.findUnique({ where: { id: req.user.id } });
      if (!meRow) {
        const e = new Error("notfound");
        e.code = "NOTFOUND";
        throw e;
      }
      const me = userFromPrismaRow(meRow);
      ensureLists(me);

      let targetRow = null;
      if (username) targetRow = await tx.user.findUnique({ where: { username } });
      if (!targetRow && publicId) targetRow = await tx.user.findUnique({ where: { publicId } });
      if (!targetRow) {
        const e = new Error("notarget");
        e.code = "NOTARGET";
        throw e;
      }
      const target = userFromPrismaRow(targetRow);
      ensureLists(target);

      if (!me.friendRequestsIn.includes(target.username)) {
        const e = new Error("noin");
        e.code = "NOIN";
        throw e;
      }

      clearPendingBetweenUsers(me, target);
      await tx.user.update({
        where: { id: me.id },
        data: { friendRequestsIn: me.friendRequestsIn, friendRequestsOut: me.friendRequestsOut },
      });
      await tx.user.update({
        where: { id: target.id },
        data: { friendRequestsIn: target.friendRequestsIn, friendRequestsOut: target.friendRequestsOut },
      });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "NOTFOUND") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOTARGET") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOIN") return res.status(400).json({ error: "Нет входящей заявки." });
    console.error("POST /api/contacts/decline:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/contacts/cancel", authMiddleware, requireVerified, async (req, res) => {
  const { username, publicId } = req.body || {};
  try {
    await prisma.$transaction(async (tx) => {
      const meRow = await tx.user.findUnique({ where: { id: req.user.id } });
      if (!meRow) {
        const e = new Error("notfound");
        e.code = "NOTFOUND";
        throw e;
      }
      const me = userFromPrismaRow(meRow);
      ensureLists(me);

      let targetRow = null;
      if (username) targetRow = await tx.user.findUnique({ where: { username } });
      if (!targetRow && publicId) targetRow = await tx.user.findUnique({ where: { publicId } });
      if (!targetRow) {
        const e = new Error("notarget");
        e.code = "NOTARGET";
        throw e;
      }
      const target = userFromPrismaRow(targetRow);
      ensureLists(target);

      if (!me.friendRequestsOut.includes(target.username)) {
        const e = new Error("noout");
        e.code = "NOOUT";
        throw e;
      }

      clearPendingBetweenUsers(me, target);
      await tx.user.update({
        where: { id: me.id },
        data: { friendRequestsIn: me.friendRequestsIn, friendRequestsOut: me.friendRequestsOut },
      });
      await tx.user.update({
        where: { id: target.id },
        data: { friendRequestsIn: target.friendRequestsIn, friendRequestsOut: target.friendRequestsOut },
      });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "NOTFOUND") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOTARGET") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOOUT") return res.status(400).json({ error: "Нет исходящей заявки этому пользователю." });
    console.error("POST /api/contacts/cancel:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Заблокировать пользователя
app.post("/api/contacts/block", authMiddleware, requireVerified, async (req, res) => {
  const { username, publicId } = req.body || {};
  try {
    await prisma.$transaction(async (tx) => {
      const meRow = await tx.user.findUnique({ where: { id: req.user.id } });
      if (!meRow) {
        const e = new Error("notfound");
        e.code = "NOTFOUND";
        throw e;
      }
      const me = userFromPrismaRow(meRow);
      ensureLists(me);

      let targetRow = null;
      if (username) targetRow = await tx.user.findUnique({ where: { username } });
      if (!targetRow && publicId) targetRow = await tx.user.findUnique({ where: { publicId } });
      if (!targetRow) {
        const e = new Error("notarget");
        e.code = "NOTARGET";
        throw e;
      }
      const target = userFromPrismaRow(targetRow);
      ensureLists(target);

      if (target.id === me.id) {
        const e = new Error("self");
        e.code = "SELF";
        throw e;
      }

      clearPendingBetweenUsers(me, target);
      me.friends = me.friends.filter((u) => u !== target.username);
      target.friends = target.friends.filter((u) => u !== me.username);

      if (!me.blocked.includes(target.username)) me.blocked.push(target.username);

      await tx.user.update({
        where: { id: me.id },
        data: {
          friends: me.friends,
          blocked: me.blocked,
          friendRequestsIn: me.friendRequestsIn,
          friendRequestsOut: me.friendRequestsOut,
        },
      });
      await tx.user.update({
        where: { id: target.id },
        data: {
          friends: target.friends,
          friendRequestsIn: target.friendRequestsIn,
          friendRequestsOut: target.friendRequestsOut,
        },
      });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "NOTFOUND") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOTARGET") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "SELF") return res.status(400).json({ error: "Нельзя заблокировать себя" });
    console.error("POST /api/contacts/block:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Разблокировать пользователя
app.post("/api/contacts/unblock", authMiddleware, requireVerified, async (req, res) => {
  const { username, publicId } = req.body || {};
  try {
    const meRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!meRow) return res.status(404).json({ error: "Пользователь не найден" });
    const me = userFromPrismaRow(meRow);
    ensureLists(me);

    let targetRow = null;
    if (username) targetRow = await prisma.user.findUnique({ where: { username } });
    if (!targetRow && publicId) targetRow = await prisma.user.findUnique({ where: { publicId } });
    if (!targetRow) return res.status(404).json({ error: "Пользователь не найден" });
    const target = userFromPrismaRow(targetRow);

    me.blocked = me.blocked.filter((u) => u !== target.username);
    await prisma.user.update({ where: { id: me.id }, data: { blocked: me.blocked } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/contacts/unblock:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Запрос на сброс пароля
app.post("/api/password/reset-request", resetLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email обязателен" });
  try {
    const row = await prisma.user.findUnique({ where: { email } });
    if (!row) {
      return res.json({ ok: true });
    }
    const token = generateToken();
    const exp = new Date(Date.now() + 1000 * 60 * 30);
    await prisma.user.update({
      where: { id: row.id },
      data: { resetToken: token, resetTokenExp: exp },
    });
    const baseUrl = process.env.ATON_PUBLIC_URL || `http://localhost:${PORT}`;
    const link = `${baseUrl}/reset.html?token=${token}`;
    await sendMail(
      email,
      "Атон — восстановление пароля",
      [
        `Здравствуйте!`,
        ``,
        `Вы запросили восстановление пароля в мессенджере «Атон».`,
        `Перейдите по ссылке, чтобы задать новый пароль:`,
        link,
        ``,
        `Ссылка действительна 30 минут.`,
        ``,
        `Если это были не вы — просто игнорируйте это письмо.`,
        ``,
        `— Атон`,
      ].join("\n")
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("reset-request:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Сброс пароля
app.post("/api/password/reset", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "token и password обязательны" });
  try {
    const row = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: { gt: new Date() },
      },
    });
    if (!row) return res.status(400).json({ error: "Токен недействителен или истёк" });
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.session.deleteMany({ where: { userId: row.id } });
    await prisma.user.update({
      where: { id: row.id },
      data: { passwordHash, resetToken: null, resetTokenExp: null, sessionToken: null },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("password reset:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Список пользователей (для поиска)
app.get("/api/users", authMiddleware, requireVerified, async (req, res) => {
  try {
    const currentRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    const current = currentRow ? userFromPrismaRow(currentRow) : null;
    if (current) ensureLists(current);
    const friendsSet = new Set((current && current.friends) || []);
    const blockedSet = new Set((current && current.blocked) || []);
    const myUsername = current && current.username;

    const raw = await prisma.user.findMany({ select: PRISMA_USER_SELECT_LIST });
    for (const row of raw) {
      if (!row.publicId) {
        const pid = await generateUniquePublicId(prisma, row.username);
        await prisma.user.update({ where: { id: row.id }, data: { publicId: pid } });
        row.publicId = pid;
      }
    }

    const users = raw.map((row) => {
      const u = userFromPrismaRow(row);
      ensureLists(u);
      ensureVerificationFlags(u);
      return {
        id: u.id,
        username: u.username,
        publicId: u.publicId,
        displayName: u.displayName,
        avatarDataUrl: u.avatarDataUrl,
        lastSeen: u.lastSeen || null,
        isFriend: friendsSet.has(u.username),
        isBlocked: blockedSet.has(u.username),
        /** Собеседник добавил меня в свой список блокировок (для скрытия реального lastSeen в UI). */
        blockedMe: myUsername ? (u.blocked || []).includes(myUsername) : false,
        isVerified: Boolean(u.isVerified),
        isSuperAdmin: Boolean(u.isSuperAdmin),
      };
    });
    res.json(users);
  } catch (err) {
    console.error("GET /api/users:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Полный список пользователей с email (только super admin) — для админ-страницы
app.get("/api/admin/users", authMiddleware, requireVerified, async (req, res) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Недостаточно прав" });
  }
  try {
    const raw = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: PRISMA_USER_SELECT_LIST,
    });
    const out = raw.map((row) => {
      const u = userFromPrismaRow(row);
      ensureLists(u);
      ensureVerificationFlags(u);
      return {
        id: u.id,
        email: u.email,
        username: u.username,
        publicId: u.publicId,
        displayName: u.displayName,
        bio: typeof u.bio === "string" ? u.bio.slice(0, 500) : "",
        avatarDataUrl: u.avatarDataUrl,
        lastSeen: u.lastSeen || null,
        createdAt: u.createdAt || null,
        verified: Boolean(row.verified),
        isVerified: Boolean(u.isVerified),
        isSuperAdmin: Boolean(u.isSuperAdmin),
      };
    });
    res.json(out);
  } catch (err) {
    console.error("GET /api/admin/users:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Верификация пользователя (только super admin)
app.post("/api/users/:id/verify", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  console.log("VERIFY USER HIT", id, "as", req.user?.username, "super:", req.user?.isSuperAdmin);
  if (!req.user || !req.user.isSuperAdmin) return res.status(403).json({ error: "Недостаточно прав" });
  try {
    const row = await prisma.user.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Пользователь не найден" });
    await prisma.user.update({ where: { id }, data: { isVerified: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/users/:id/verify:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Чаты (группы)
app.get("/api/chats", authMiddleware, requireVerified, async (req, res) => {
  try {
    const chatRows = await prisma.chat.findMany();
    const ownerNames = chatRows.map((r) => r && r.owner).filter(Boolean);
    const usersByUsername = await loadUsersByUsernameMap(ownerNames);
    const normalizedChats = [];
    for (const row of chatRows) {
      let plain = chatFromPrismaRow(row);
      const before = { ...plain };
      const after = ensureChatFields(plain, usersByUsername);
      const changed =
        after.ownerId !== before.ownerId ||
        JSON.stringify(after.members) !== JSON.stringify(before.members) ||
        JSON.stringify(after.admins) !== JSON.stringify(before.admins) ||
        after.avatarDataUrl !== before.avatarDataUrl ||
        after.verified !== before.verified ||
        after.visibility !== before.visibility ||
        after.inviteToken !== before.inviteToken;
      if (changed) {
        await prisma.chat.update({
          where: { id: after.id },
          data: {
            ownerId: after.ownerId,
            members: after.members,
            admins: after.admins,
            avatarDataUrl: after.avatarDataUrl,
            verified: after.verified,
            description: after.description,
            visibility: after.visibility,
            inviteToken: after.inviteToken,
          },
        });
      }
      normalizedChats.push(after);
    }

    const visibleChats = normalizedChats.filter(
      (chat) => Array.isArray(chat.members) && chat.members.includes(req.user.id)
    );
    res.json(visibleChats);
  } catch (err) {
    console.error("GET /api/chats:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Публичный список чатов, в которых пользователь НЕ состоит (preview для вступления)
app.get("/api/chats/discover", authMiddleware, requireVerified, async (req, res) => {
  try {
    const chatRows = await prisma.chat.findMany();
    const discoverOwnerNames = chatRows.map((c) => c && c.owner).filter(Boolean);
    const usersByUsername = await loadUsersByUsernameMap(discoverOwnerNames);
    const normalized = chatRows.map((c) => ensureChatFields(chatFromPrismaRow(c), usersByUsername));

    const filtered = normalized.filter((chat) => {
      const members = Array.isArray(chat.members) ? chat.members : [];
      const vis = chat.visibility === "private" ? "private" : "public";
      return vis === "public" && !members.includes(req.user.id);
    });

    const memberIdSet = new Set();
    for (const ch of filtered) {
      for (const uid of ch.members || []) {
        memberIdSet.add(uid);
      }
    }
    const memberIdArr = [...memberIdSet];
    const memberRows =
      memberIdArr.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: memberIdArr } },
            select: PRISMA_USER_SELECT_LIST,
          })
        : [];
    const usersById = {};
    for (const row of memberRows) {
      const u = userFromPrismaRow(row);
      if (u.id) usersById[u.id] = u;
    }

    const discover = await Promise.all(
      filtered.map(async (chat) => {
        const members = Array.isArray(chat.members) ? chat.members : [];

        const previewMembers = members.slice(0, 3).map((uid) => {
          const u = usersById[uid];
          return u ? u.displayName || u.username : uid;
        });

        const lastMsgRow = await prisma.message.findFirst({
          where: { chatId: chat.id },
          orderBy: { createdAt: "desc" },
        });
        const lm = lastMsgRow ? messageFromPrismaRow(lastMsgRow) : null;
          const lastMessagePreview = lm
            ? lm.text
              ? lm.text.slice(0, 80)
              : lm.type === "image"
                ? "📷 Изображение"
                : lm.type === "audio"
                  ? "🎤 Голосовое сообщение"
                  : null
            : null;
        const lastMessageAt = lm ? lm.time : null;

        return {
          id: chat.id,
          type: chat.type || "group",
          title: chat.title || "Чат",
          description: chat.description || null,
          avatarDataUrl: chat.avatarDataUrl || null,
          verified: Boolean(chat.verified),
          visibility: "public",
          memberCount: members.length,
          previewMembers,
          createdAt: chat.createdAt || null,
          lastMessagePreview,
          lastMessageAt,
        };
      })
    );

    res.json(discover);
  } catch (err) {
    console.error("GET /api/chats/discover:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/chats", authMiddleware, requireVerified, async (req, res) => {
  const { title, type = "group", visibility: visIn = "public", description = null } = req.body || {};
  if (!title) return res.status(400).json({ error: "title обязателен" });
  if (type !== "group" && type !== "channel") {
    return res.status(400).json({ error: "type должен быть group или channel" });
  }
  const visibility = visIn === "private" ? "private" : "public";
  const ownerId = req.user.id;
  const id = `${type}:` + generateToken();
  try {
    const row = await prisma.chat.create({
      data: {
        id,
        type,
        title,
        description: description || null,
        owner: req.user.username,
        ownerId,
        members: [ownerId],
        admins: [ownerId],
        avatarDataUrl: null,
        verified: false,
        visibility,
        inviteToken: visibility === "private" ? generateToken() : null,
        createdAt: new Date(),
      },
    });
    res.json(chatFromPrismaRow(row));
  } catch (err) {
    console.error("POST /api/chats:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Превью чата по токену приглашения (без members/admins)
app.get("/api/chats/invite/:token", async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(404).json({ error: "Приглашение недействительно" });
  try {
    const rawRow = await prisma.chat.findFirst({ where: { inviteToken: token } });
    if (!rawRow) return res.status(404).json({ error: "Приглашение недействительно" });

    const usersByUsername = await loadUsersByUsernameMap([rawRow.owner]);
    const chat = ensureChatFields(chatFromPrismaRow(rawRow), usersByUsername);
    res.json({
      id: chat.id,
      title: chat.title || "Чат",
      avatarDataUrl: chat.avatarDataUrl || null,
      verified: Boolean(chat.verified),
      visibility: chat.visibility === "private" ? "private" : "public",
    });
  } catch (err) {
    console.error("GET /api/chats/invite/:token:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Вступление по приглашению (приватные и при необходимости любые чаты с токеном)
app.post("/api/chats/invite/:token/join", authMiddleware, requireVerified, async (req, res) => {
  const { token } = req.params;
  try {
    const row = await prisma.chat.findFirst({ where: { inviteToken: token } });
    if (!row) return res.status(404).json({ error: "Приглашение недействительно" });

    let usersByUsername = await loadUsersByUsernameMap([row.owner]);
    let chat = ensureChatFields(chatFromPrismaRow(row), usersByUsername);
    const members = Array.isArray(chat.members) ? [...chat.members] : [];
    if (!members.includes(req.user.id)) members.push(req.user.id);

    const updated = await prisma.chat.update({
      where: { id: chat.id },
      data: { members },
    });
    chat = ensureChatFields(chatFromPrismaRow(updated), usersByUsername);
    res.json({ ok: true, chat });
  } catch (err) {
    console.error("POST /api/chats/invite/:token/join:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.delete("/api/chats/:id", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
    const chat = chatFromPrismaRow(row);
    if (chat.owner !== req.user.username && !req.user.isSuperAdmin) {
      return res.status(403).json({ error: "Только создатель или super admin может удалять группу" });
    }
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { chatId: id } }),
      prisma.chat.deleteMany({ where: { id } }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/chats/:id:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Верификация чата (только super admin)
app.post("/api/chats/:id/verify", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  console.log("VERIFY CHAT HIT", id, "as", req.user?.username, "super:", req.user?.isSuperAdmin);
  if (!req.user || !req.user.isSuperAdmin) return res.status(403).json({ error: "Недостаточно прав" });
  try {
    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
    await prisma.chat.update({ where: { id }, data: { verified: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/chats/:id/verify:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Жалоба на чат
app.post("/api/chats/:id/report", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: "reason обязателен" });
  }

  try {
    const exists = await prisma.chat.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "Чат не найден" });

    const dup = await prisma.report.findFirst({
      where: { chatId: id, reportedBy: req.user.id },
    });
    if (dup) {
      return res.json({
        ok: true,
        report: {
          id: dup.id,
          chatId: dup.chatId,
          reportedBy: dup.reportedBy,
          reason: dup.reason,
          status: dup.status,
          createdAt: dup.createdAt.toISOString(),
        },
        duplicate: true,
      });
    }

    const report = await prisma.report.create({
      data: {
        id: generateToken(),
        chatId: id,
        reportedBy: req.user.id,
        reason: String(reason).trim(),
        status: "pending",
      },
    });
    res.json({
      ok: true,
      report: {
        id: report.id,
        chatId: report.chatId,
        reportedBy: report.reportedBy,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      const dup = await prisma.report.findFirst({
        where: { chatId: id, reportedBy: req.user.id },
      });
      if (dup) {
        return res.json({
          ok: true,
          report: {
            id: dup.id,
            chatId: dup.chatId,
            reportedBy: dup.reportedBy,
            reason: dup.reason,
            status: dup.status,
            createdAt: dup.createdAt.toISOString(),
          },
          duplicate: true,
        });
      }
    }
    console.error("POST /api/chats/:id/report:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Жалобы (только super admin)
app.get("/api/reports", authMiddleware, requireVerified, async (req, res) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Недостаточно прав" });
  }
  try {
    const rows = await prisma.report.findMany({ orderBy: { createdAt: "desc" } });
    const reports = rows.map((r) => ({
      id: r.id,
      chatId: r.chatId,
      reportedBy: r.reportedBy,
      reason: r.reason,
      status: r.status || "pending",
      createdAt: r.createdAt.toISOString(),
    }));
    res.json(reports);
  } catch (err) {
    console.error("GET /api/reports:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/reports/:id/resolve", authMiddleware, requireVerified, async (req, res) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Недостаточно прав" });
  }
  const { id } = req.params;
  try {
    const row = await prisma.report.updateMany({
      where: { id },
      data: { status: "resolved" },
    });
    if (row.count === 0) return res.status(404).json({ error: "Жалоба не найдена" });
    const report = await prisma.report.findUnique({ where: { id } });
    res.json({
      ok: true,
      report: {
        id: report.id,
        chatId: report.chatId,
        reportedBy: report.reportedBy,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /api/reports/:id/resolve:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/reports/:id/reject", authMiddleware, requireVerified, async (req, res) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Недостаточно прав" });
  }
  const { id } = req.params;
  try {
    const row = await prisma.report.updateMany({
      where: { id },
      data: { status: "rejected" },
    });
    if (row.count === 0) return res.status(404).json({ error: "Жалоба не найдена" });
    const report = await prisma.report.findUnique({ where: { id } });
    res.json({
      ok: true,
      report: {
        id: report.id,
        chatId: report.chatId,
        reportedBy: report.reportedBy,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /api/reports/:id/reject:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Участники (только owner)
app.post("/api/chats/:id/members/add", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: "username обязателен" });
  try {
    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
    let usersByUsername = await loadUsersByUsernameMap([row.owner]);
    let chat = ensureChatFields(chatFromPrismaRow(row), usersByUsername);

    if (!chat.ownerId || chat.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Только создатель может управлять участниками" });
    }

    const targetRow = await prisma.user.findUnique({ where: { username } });
    if (!targetRow) return res.status(404).json({ error: "Пользователь не найден" });
    const target = userFromPrismaRow(targetRow);

    const members = Array.isArray(chat.members) ? [...chat.members] : [];
    if (!members.includes(target.id)) members.push(target.id);

    const updated = await prisma.chat.update({
      where: { id },
      data: { members },
    });
    chat = ensureChatFields(chatFromPrismaRow(updated), usersByUsername);
    res.json({ ok: true, chat });
  } catch (err) {
    console.error("POST /api/chats/:id/members/add:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/chats/:id/members/remove", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId обязателен" });
  try {
    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
    let usersByUsername = await loadUsersByUsernameMap([row.owner]);
    let chat = ensureChatFields(chatFromPrismaRow(row), usersByUsername);

    if (!chat.ownerId || chat.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Только создатель может управлять участниками" });
    }

    if (String(userId) === String(chat.ownerId)) {
      return res.status(403).json({ error: "Нельзя удалить создателя чата" });
    }

    let members = Array.isArray(chat.members) ? chat.members : [];
    let admins = Array.isArray(chat.admins) ? chat.admins : [];
    members = members.filter((mid) => String(mid) !== String(userId));
    admins = admins.filter((aid) => String(aid) !== String(userId));

    const updated = await prisma.chat.update({
      where: { id },
      data: { members, admins },
    });
    chat = ensureChatFields(chatFromPrismaRow(updated), usersByUsername);
    res.json({ ok: true, chat });
  } catch (err) {
    console.error("POST /api/chats/:id/members/remove:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Выход из чата текущего пользователя
app.post("/api/chats/:id/leave", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
    let usersByUsername = await loadUsersByUsernameMap([row.owner]);
    let chat = ensureChatFields(chatFromPrismaRow(row), usersByUsername);

    let members = Array.isArray(chat.members) ? chat.members : [];
    let admins = Array.isArray(chat.admins) ? chat.admins : [];

    if (String(chat.ownerId) === String(req.user.id)) {
      return res.status(403).json({ error: "Создатель не может выйти из чата" });
    }

    if (!members.includes(req.user.id)) {
      return res.status(400).json({ error: "Вы не являетесь участником чата" });
    }

    members = members.filter((mid) => String(mid) !== String(req.user.id));
    admins = admins.filter((aid) => String(aid) !== String(req.user.id));

    const updated = await prisma.chat.update({
      where: { id },
      data: { members, admins },
    });
    chat = ensureChatFields(chatFromPrismaRow(updated), usersByUsername);
    res.json({ ok: true, chat });
  } catch (err) {
    console.error("POST /api/chats/:id/leave:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Вступление в чат текущего пользователя
app.post("/api/chats/:id/join", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
    let usersByUsername = await loadUsersByUsernameMap([row.owner]);
    let chat = ensureChatFields(chatFromPrismaRow(row), usersByUsername);

    const visibility = chat.visibility === "private" ? "private" : "public";
    if (visibility !== "public") {
      return res.status(403).json({
        error: "Этот чат приватный. Свободное вступление отключено.",
      });
    }

    const members = Array.isArray(chat.members) ? [...chat.members] : [];
    if (!members.includes(req.user.id)) members.push(req.user.id);

    const updated = await prisma.chat.update({
      where: { id },
      data: { members },
    });
    chat = ensureChatFields(chatFromPrismaRow(updated), usersByUsername);
    res.json({ ok: true, chat });
  } catch (err) {
    console.error("POST /api/chats/:id/join:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Сообщения
app.get("/api/messages", authMiddleware, requireVerified, async (req, res) => {
  const { chatId = "global" } = req.query;
  const me = req.user.username;
  try {
    const ac = await assertUserCanAccessChat(req, chatId);
    if (!ac.ok) {
      return res.status(ac.error === "Чат не найден" ? 404 : 403).json({ error: ac.error });
    }
    if (isDirectMessageChatId(chatId)) {
      await prisma.message.updateMany({
        where: {
          chatId,
          senderUsername: { not: me },
          status: "sent",
        },
        data: { status: "delivered" },
      });
      emitMessageStatusForChat(chatId, {
        chatId,
        kind: "delivered",
        viewer: me,
      });
    }
    const rows = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });
    res.json(rows.map(messageFromPrismaRow));
  } catch (err) {
    console.error("GET /api/messages:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Прочитано: входящие в чате → read; ответ — актуальный список сообщений чата
app.post("/api/messages/read", authMiddleware, requireVerified, async (req, res) => {
  const { chatId, userId } = req.body || {};
  const bodyUser = userId != null ? String(userId).trim() : "";
  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId обязателен" });
  }
  if (bodyUser && bodyUser !== req.user.id) {
    return res.status(403).json({ error: "Несоответствие пользователя" });
  }
  const me = req.user.username;
  try {
    const ac = await assertUserCanAccessChat(req, chatId);
    if (!ac.ok) {
      return res.status(ac.error === "Чат не найден" ? 404 : 403).json({ error: ac.error });
    }
    if (isDirectMessageChatId(chatId)) {
      await prisma.message.updateMany({
        where: {
          chatId,
          senderUsername: { not: me },
          status: { in: ["sent", "delivered"] },
        },
        data: { status: "read" },
      });
      emitMessageStatusForChat(chatId, {
        chatId,
        kind: "read",
        reader: me,
      });
    }
    const rows = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });
    const list = rows.map(messageFromPrismaRow);
    res.json({ ok: true, messages: list });
  } catch (err) {
    console.error("POST /api/messages/read:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Статус дружбы с пользователем (для поиска / кнопок)
app.get("/api/friendship-status", authMiddleware, requireVerified, async (req, res) => {
  const userId = req.query.userId != null ? String(req.query.userId).trim() : "";
  if (!userId) {
    return res.status(400).json({ error: "userId обязателен" });
  }
  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }
    if (target.id === req.user.id) {
      return res.json({ status: "accepted" });
    }
    const meRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!meRow) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }
    const me = userFromPrismaRow(meRow);
    ensureLists(me);
    const tu = target.username;
    if ((me.friends || []).includes(tu)) {
      return res.json({ status: "accepted" });
    }
    if ((me.friendRequestsIn || []).includes(tu)) {
      return res.json({ status: "pending", direction: "in" });
    }
    if ((me.friendRequestsOut || []).includes(tu)) {
      return res.json({ status: "pending", direction: "out" });
    }
    return res.json({ status: "none" });
  } catch (err) {
    console.error("GET /api/friendship-status:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Все сообщения для текущего пользователя (для построения списка чатов)
// ACL: для группы/канала — только если пользователь состоит в members
app.get("/api/messages/all", authMiddleware, requireVerified, async (req, res) => {
  const username = req.user.username;
  const userId = req.user.id;
  try {
    const chatRows = await prisma.chat.findMany();
    const ownerNameList = [];
    for (const raw of chatRows) {
      if (raw && raw.owner) ownerNameList.push(raw.owner);
    }
    const usersByUsername = await loadUsersByUsernameMap(ownerNameList);

    const memberChatIds = new Set();
    for (const raw of chatRows) {
      const chat = ensureChatFields(chatFromPrismaRow(raw), usersByUsername);
      const members = Array.isArray(chat.members) ? chat.members : [];
      if (members.includes(userId)) memberChatIds.add(chat.id);
    }

    const inChats = [...memberChatIds];
    const orClause = [
      { senderUsername: username },
      { recipientUsername: username },
    ];
    if (inChats.length) orClause.push({ chatId: { in: inChats } });
    const findArgs = {
      where: { OR: orClause },
      orderBy: { createdAt: "asc" },
    };
    if (MESSAGES_BOOTSTRAP_MAX != null) {
      findArgs.orderBy = { createdAt: "desc" };
      findArgs.take = MESSAGES_BOOTSTRAP_MAX;
    }
    const rows = await prisma.message.findMany(findArgs);
    if (MESSAGES_BOOTSTRAP_MAX != null) {
      rows.reverse();
    }
    res.json(rows.map(messageFromPrismaRow));
  } catch (err) {
    console.error("GET /api/messages/all:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/messages", authMiddleware, requireVerified, async (req, res) => {
  const {
    chatId = "global",
    type,
    text,
    audioDataUrl,
    imageDataUrl,
    to,
    replyTo = null,
    pinned = false,
  } = req.body || {};
  if (!type) return res.status(400).json({ error: "type обязателен" });

  const toTrimmed = to != null && String(to).trim() !== "" ? String(to).trim() : null;
  const myUsername = req.user.username;
  const peerFromChatId = dmPeerFromChatId(typeof chatId === "string" ? chatId : String(chatId), myUsername);
  const recipientForDb = toTrimmed || peerFromChatId || null;

  // Проверка блокировок для личных сообщений
  if (recipientForDb) {
    const senderRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    const receiverRow = await prisma.user.findUnique({ where: { username: recipientForDb } });
    if (senderRow && receiverRow) {
      const sender = userFromPrismaRow(senderRow);
      const receiver = userFromPrismaRow(receiverRow);
      ensureLists(sender);
      ensureLists(receiver);
      const senderBlockedReceiver = (sender.blocked || []).includes(receiver.username);
      const receiverBlockedSender = (receiver.blocked || []).includes(sender.username);
      if (senderBlockedReceiver || receiverBlockedSender) {
        return res
          .status(403)
          .json({ error: "Отправка сообщений этому пользователю недоступна." });
      }
    }
  }

  // ACL для групп/каналов: писать можно только участникам.
  const isGroupOrChannelChatId =
    typeof chatId === "string" && (chatId.startsWith("group:") || chatId.startsWith("channel:"));
  if (isGroupOrChannelChatId) {
    const rawChat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!rawChat) return res.status(404).json({ error: "Чат не найден" });
    const usersByUsername = await loadUsersByUsernameMap([rawChat.owner]);
    const chat = ensureChatFields(chatFromPrismaRow(rawChat), usersByUsername);
    const chatType = chat.type || (String(chat.id).startsWith("channel:") ? "channel" : "group");
    const isScopedType = chatType === "group" || chatType === "channel";
    if (isScopedType) {
      const members = Array.isArray(chat.members) ? chat.members : [];
      if (!members.includes(req.user.id)) {
        return res.status(403).json({ error: "Вы не являетесь участником этого чата" });
      }
      if (chatType === "channel") {
        const admins = Array.isArray(chat.admins) ? chat.admins : [];
        const isChannelWriter =
          String(chat.ownerId) === String(req.user.id) || admins.includes(req.user.id);
        if (!isChannelWriter) {
          return res.status(403).json({ error: "В канале писать могут только владелец и администраторы" });
        }
      }
    }
  }

  if (type === "audio" && !String(audioDataUrl || "").trim()) {
    return res.status(400).json({ error: "Нет аудиозаписи" });
  }

  if (
    type === "text" &&
    (!text || !String(text).trim()) &&
    !imageDataUrl &&
    !audioDataUrl
  ) {
    return res.status(400).json({ error: "Пустое сообщение" });
  }

  const msgId = generateToken();
  const now = new Date();
  try {
    const row = await prisma.message.create({
      data: {
        id: msgId,
        chatId,
        senderUsername: req.user.username,
        recipientUsername: recipientForDb,
        type,
        text: text || "",
        imageDataUrl: imageDataUrl || null,
        audioDataUrl: audioDataUrl || null,
        createdAt: now,
        editedAt: null,
        replyTo: replyTo == null ? undefined : replyTo,
        pinned: Boolean(pinned),
        reactions: [],
        status: "sent",
      },
    });
    const msg = messageFromPrismaRow(row);
    io.to(msg.chatId).emit("message:new", msg);
    if (msg.to) {
      io.to(`user:${msg.to}`).emit("message:new", msg);
      io.to(`user:${msg.from}`).emit("message:new", msg);
    }
    res.json(msg);

    const toGolos = userMessageToGolosAton(msg, req.user.username);
    const hasText = type === "text" && String(text || "").trim();
    const hasAudio = type === "audio" && String(audioDataUrl || "").trim();
    if (toGolos && (hasText || hasAudio)) {
      void processGolosAtonUserReply({
        savedUserMsg: msg,
        authorUsername: req.user.username,
        authorId: req.user.id,
      }).catch((e) => console.error("processGolosAtonUserReply:", e));
    }

    // Async email notifications — don't block the response
    notifyNewMessage(msg, req.user).catch((e) =>
      console.error("notifyNewMessage error:", e)
    );
  } catch (err) {
    console.error("prisma.message.create (POST /api/messages):", err);
    res.status(500).json({ error: "Не удалось сохранить сообщение" });
  }
});

// Редактирование текста сообщения
app.patch("/api/messages/:id", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body || {};
  try {
    const row = await prisma.message.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Сообщение не найдено" });
    if (row.senderUsername !== req.user.username) {
      return res.status(403).json({ error: "Можно редактировать только свои сообщения" });
    }
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Новый текст обязателен" });
    }
    const updated = await prisma.message.update({
      where: { id },
      data: { text: text.trim(), editedAt: new Date() },
    });
    res.json(messageFromPrismaRow(updated));
  } catch (err) {
    console.error("PATCH /api/messages/:id:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Пин сообщения (только автор)
app.post("/api/messages/:id/pin", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await prisma.message.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Сообщение не найдено" });
    if (row.senderUsername !== req.user.username) {
      return res.status(403).json({ error: "Можно закреплять только свои сообщения" });
    }
    const updated = await prisma.message.update({
      where: { id },
      data: { pinned: !row.pinned },
    });
    res.json(messageFromPrismaRow(updated));
  } catch (err) {
    console.error("POST /api/messages/:id/pin:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Реакции на сообщение (эмодзи)
app.post("/api/messages/:id/react", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  const { emoji } = req.body || {};
  if (!emoji || typeof emoji !== "string") {
    return res.status(400).json({ error: "emoji обязателен" });
  }
  try {
    const row = await prisma.message.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Сообщение не найдено" });
    let reactions = Array.isArray(row.reactions) ? [...row.reactions] : [];
    const existingIndex = reactions.findIndex(
      (r) => r.user === req.user.username && r.emoji === emoji
    );
    if (existingIndex >= 0) {
      reactions.splice(existingIndex, 1);
    } else {
      reactions = reactions.filter((r) => r.user !== req.user.username);
      reactions.push({ user: req.user.username, emoji });
    }
    const updated = await prisma.message.update({
      where: { id },
      data: { reactions },
    });
    res.json(messageFromPrismaRow(updated));
  } catch (err) {
    console.error("POST /api/messages/:id/react:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.delete("/api/messages/:id", authMiddleware, requireVerified, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await prisma.message.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Сообщение не найдено" });
    if (row.senderUsername !== req.user.username) {
      return res.status(403).json({ error: "Можно удалять только свои сообщения" });
    }
    await prisma.message.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/messages/:id:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/test-db-user", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        publicId: true,
        createdAt: true,
      },
    });
    res.json({ ok: true, users });
  } catch (err) {
    console.error("GET /api/test-db-user:", err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Ошибка базы данных",
    });
  }
});

ensureGolosAtonUser()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Атон backend запущен: http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error("ensureGolosAtonUser:", e);
    server.listen(PORT, () => {
      console.log(`Атон backend запущен: http://localhost:${PORT}`);
    });
  });


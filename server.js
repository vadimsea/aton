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

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

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
    pgUser = await prisma.user.findFirst({ where: { sessionToken: token } });
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

  if (msg.recipientUsername) {
    // DM — notify recipient only
    if (isUserOnline(msg.recipientUsername)) return;
    try {
      const recipient = await prisma.user.findUnique({
        where: { username: msg.recipientUsername },
      });
      if (recipient?.email) {
        await sendMail(
          recipient.email,
          `Новое сообщение от ${sender.username}`,
          [
            `${sender.username} написал(а) вам:`,
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

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (!token) return res.status(401).json({ error: "Нет токена" });

    let pgUser = null;
    try {
      pgUser = await prisma.user.findFirst({ where: { sessionToken: token } });
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
  const ok = await bcrypt.compare(password, pgUser.passwordHash);
  if (!ok) return res.status(401).json({ error: "Неверное имя или пароль" });

  const sessionToken = generateToken();

  try {
    await prisma.user.update({
      where: { id: pgUser.id },
      data: { sessionToken },
    });
  } catch (err) {
    console.error("prisma login session update:", err);
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
    });
  } catch (err) {
    console.error("GET /api/me:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Контакты (друзья и заблокированные)
app.get("/api/contacts", authMiddleware, requireVerified, async (req, res) => {
  try {
    const meRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!meRow) return res.status(404).json({ error: "Пользователь не найден" });
    const me = userFromPrismaRow(meRow);
    ensureLists(me);

    const names = [...new Set([...(me.friends || []), ...(me.blocked || [])])];
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

    res.json({ friends, blocked });
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
    res.json({
      id: u.id,
      username: u.username,
      publicId: u.publicId,
      displayName: u.displayName,
      email: u.email,
      avatarDataUrl: u.avatarDataUrl,
      bio: u.bio,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ error: "Такой ID уже используется другим пользователем." });
    }
    console.error("POST /api/profile:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Добавить в друзья
app.post("/api/contacts/add", authMiddleware, requireVerified, async (req, res) => {
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

      if (target.blocked.includes(me.username) || me.blocked.includes(target.username)) {
        const e = new Error("blocked");
        e.code = "BLOCKED";
        throw e;
      }

      if (!me.friends.includes(target.username)) me.friends.push(target.username);
      if (!target.friends.includes(me.username)) target.friends.push(me.username);

      await tx.user.update({ where: { id: me.id }, data: { friends: me.friends } });
      await tx.user.update({ where: { id: target.id }, data: { friends: target.friends } });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "NOTFOUND") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "NOTARGET") return res.status(404).json({ error: "Пользователь не найден" });
    if (err.code === "SELF") return res.status(400).json({ error: "Нельзя добавить себя в друзья" });
    if (err.code === "BLOCKED") {
      return res
        .status(400)
        .json({ error: "Нельзя добавить в друзья пользователя с ограниченным доступом." });
    }
    console.error("POST /api/contacts/add:", err);
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

      if (!me.blocked.includes(target.username)) me.blocked.push(target.username);
      me.friends = me.friends.filter((u) => u !== target.username);

      await tx.user.update({ where: { id: me.id }, data: { friends: me.friends, blocked: me.blocked } });
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
    await prisma.user.update({
      where: { id: row.id },
      data: { passwordHash, resetToken: null, resetTokenExp: null },
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

    const raw = await prisma.user.findMany();
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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const chatRows = await prisma.chat.findMany();
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
    const userRows = await prisma.user.findMany();
    const usersById = {};
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (!u.username) continue;
      usersByUsername[u.username] = u;
      if (u.id) usersById[u.id] = u;
    }

    const chatRows = await prisma.chat.findMany();
    const normalized = chatRows.map((c) => ensureChatFields(chatFromPrismaRow(c), usersByUsername));

    const filtered = normalized.filter((chat) => {
      const members = Array.isArray(chat.members) ? chat.members : [];
      const vis = chat.visibility === "private" ? "private" : "public";
      return vis === "public" && !members.includes(req.user.id);
    });

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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const rawRow = await prisma.chat.findFirst({ where: { inviteToken: token } });
    if (!rawRow) return res.status(404).json({ error: "Приглашение недействительно" });

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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const row = await prisma.chat.findFirst({ where: { inviteToken: token } });
    if (!row) return res.status(404).json({ error: "Приглашение недействительно" });

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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const row = await prisma.chat.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "Чат не найден" });
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
  try {
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

// Все сообщения для текущего пользователя (для построения списка чатов)
// ACL: для группы/канала — только если пользователь состоит в members
app.get("/api/messages/all", authMiddleware, requireVerified, async (req, res) => {
  const username = req.user.username;
  const userId = req.user.id;
  try {
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const chatRows = await prisma.chat.findMany();
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
    const rows = await prisma.message.findMany({
      where: { OR: orClause },
      orderBy: { createdAt: "asc" },
    });
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

  // Проверка блокировок для личных сообщений
  if (to) {
    const senderRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    const receiverRow = await prisma.user.findUnique({ where: { username: to } });
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
    const userRows = await prisma.user.findMany();
    const usersByUsername = {};
    for (const row of userRows) {
      const u = userFromPrismaRow(row);
      if (u.username) usersByUsername[u.username] = u;
    }

    const rawChat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!rawChat) return res.status(404).json({ error: "Чат не найден" });
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
        recipientUsername: to || null,
        type,
        text: text || "",
        imageDataUrl: imageDataUrl || null,
        audioDataUrl: audioDataUrl || null,
        createdAt: now,
        editedAt: null,
        replyTo: replyTo == null ? undefined : replyTo,
        pinned: Boolean(pinned),
        reactions: [],
      },
    });
    const msg = messageFromPrismaRow(row);
    io.to(msg.chatId).emit("message:new", msg);
    res.json(msg);

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

server.listen(PORT, () => {
  console.log(`Атон backend запущен: http://localhost:${PORT}`);
});


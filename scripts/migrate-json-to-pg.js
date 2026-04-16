/**
 * Одноразовый импорт из db/*.json в PostgreSQL после перехода на Prisma.
 * Запуск: node scripts/migrate-json-to-pg.js
 * Требуется DATABASE_URL в .env
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DB_DIR = path.join(__dirname, "..", "db");

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  const users = readJson(path.join(DB_DIR, "users.json"));
  const chats = readJson(path.join(DB_DIR, "chats.json"));
  const messages = readJson(path.join(DB_DIR, "messages.json"));
  const reports = readJson(path.join(DB_DIR, "reports.json"));

  console.log(`Импорт: ${users.length} пользователей, ${chats.length} чатов, ${messages.length} сообщений, ${reports.length} жалоб`);

  for (const u of users) {
    if (!u || !u.id) continue;
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName || u.username,
        passwordHash: u.passwordHash,
        publicId: u.publicId,
        bio: u.bio ?? "",
        avatarDataUrl: u.avatarDataUrl ?? null,
        sessionToken: u.sessionToken ?? null,
        lastSeen: u.lastSeen ? new Date(u.lastSeen) : null,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        verified: Boolean(u.verified),
        isVerified: Boolean(u.isVerified),
        isSuperAdmin: Boolean(u.isSuperAdmin),
        verifyToken: u.verifyToken ?? null,
        resetToken: u.resetToken ?? null,
        resetTokenExp:
          u.resetTokenExp != null ? new Date(u.resetTokenExp) : null,
        friends: Array.isArray(u.friends) ? u.friends : [],
        blocked: Array.isArray(u.blocked) ? u.blocked : [],
      },
      update: {
        email: u.email,
        username: u.username,
        displayName: u.displayName || u.username,
        passwordHash: u.passwordHash,
        publicId: u.publicId,
        bio: u.bio ?? "",
        avatarDataUrl: u.avatarDataUrl ?? null,
        sessionToken: u.sessionToken ?? null,
        lastSeen: u.lastSeen ? new Date(u.lastSeen) : null,
        verified: Boolean(u.verified),
        isVerified: Boolean(u.isVerified),
        isSuperAdmin: Boolean(u.isSuperAdmin),
        verifyToken: u.verifyToken ?? null,
        resetToken: u.resetToken ?? null,
        resetTokenExp:
          u.resetTokenExp != null ? new Date(u.resetTokenExp) : null,
        friends: Array.isArray(u.friends) ? u.friends : [],
        blocked: Array.isArray(u.blocked) ? u.blocked : [],
      },
    });
  }

  for (const c of chats) {
    if (!c || !c.id) continue;
    await prisma.chat.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        type: c.type,
        title: c.title,
        description: c.description ?? null,
        owner: c.owner ?? null,
        ownerId: c.ownerId ?? null,
        visibility: c.visibility === "private" ? "private" : "public",
        inviteToken: c.inviteToken ?? null,
        verified: Boolean(c.verified),
        avatarDataUrl: c.avatarDataUrl ?? null,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        members: Array.isArray(c.members) ? c.members : [],
        admins: Array.isArray(c.admins) ? c.admins : [],
      },
      update: {
        type: c.type,
        title: c.title,
        description: c.description ?? null,
        owner: c.owner ?? null,
        ownerId: c.ownerId ?? null,
        visibility: c.visibility === "private" ? "private" : "public",
        inviteToken: c.inviteToken ?? null,
        verified: Boolean(c.verified),
        avatarDataUrl: c.avatarDataUrl ?? null,
        members: Array.isArray(c.members) ? c.members : [],
        admins: Array.isArray(c.admins) ? c.admins : [],
      },
    });
  }

  for (const m of messages) {
    if (!m || !m.id) continue;
    await prisma.message.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        chatId: m.chatId,
        senderUsername: m.from,
        recipientUsername: m.to ?? null,
        type: m.type,
        text: m.text ?? "",
        imageDataUrl: m.imageDataUrl ?? null,
        audioDataUrl: m.audioDataUrl ?? null,
        createdAt: m.time ? new Date(m.time) : new Date(),
        editedAt: m.editedAt ? new Date(m.editedAt) : null,
        replyTo: m.replyTo == null ? undefined : m.replyTo,
        pinned: Boolean(m.pinned),
        reactions: Array.isArray(m.reactions) ? m.reactions : [],
      },
      update: {
        chatId: m.chatId,
        senderUsername: m.from,
        recipientUsername: m.to ?? null,
        type: m.type,
        text: m.text ?? "",
        imageDataUrl: m.imageDataUrl ?? null,
        audioDataUrl: m.audioDataUrl ?? null,
        createdAt: m.time ? new Date(m.time) : new Date(),
        editedAt: m.editedAt ? new Date(m.editedAt) : null,
        replyTo: m.replyTo == null ? undefined : m.replyTo,
        pinned: Boolean(m.pinned),
        reactions: Array.isArray(m.reactions) ? m.reactions : [],
      },
    });
  }

  for (const r of reports) {
    if (!r || !r.id) continue;
    await prisma.report.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        chatId: r.chatId,
        reportedBy: r.reportedBy,
        reason: r.reason,
        status: r.status || "pending",
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      },
      update: {
        reason: r.reason,
        status: r.status || "pending",
      },
    });
  }

  console.log("Готово.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

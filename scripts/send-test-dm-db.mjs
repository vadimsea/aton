/**
 * Send test DM via Prisma (when QA_BOT_TOKEN expired).
 * Usage: node scripts/send-test-dm-db.mjs <recipientUsername> [text]
 */
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const prisma = new PrismaClient();
const recipient = (process.argv[2] || "Akhenaten").trim();
const sender = (process.argv[3] || "golos_aton").trim();
const text =
  process.argv[4] ||
  `Привет! Тест уведомлений ATEN desktop (${new Date().toLocaleString("ru-RU")}). Должны быть звук, toast и бейдж на иконке.`;

function dmChatId(a, b) {
  return [a, b].sort().join("|");
}

try {
  const users = await prisma.user.findMany({
    where: { username: { in: [recipient, sender] } },
    select: { username: true, isVerified: true },
  });
  const names = new Set(users.map((u) => u.username));
  if (!names.has(recipient)) {
    throw new Error(`User not found: ${recipient}`);
  }
  if (!names.has(sender)) {
    throw new Error(`User not found: ${sender}`);
  }

  const chatId = dmChatId(sender, recipient);
  const id = crypto.randomBytes(16).toString("hex");
  const now = new Date();

  const row = await prisma.message.create({
    data: {
      id,
      chatId,
      senderUsername: sender,
      recipientUsername: recipient,
      type: "text",
      text,
      createdAt: now,
      status: "sent",
      reactions: [],
      pinned: false,
    },
  });

  console.log("OK inserted message", row.id);
  console.log("From:", sender, "→", recipient);
  console.log("Chat:", chatId);
  console.log("Text:", text);
} catch (err) {
  console.error("FAIL:", err.message || err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

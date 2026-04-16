/**
 * clean-members.js
 * Оставляет в каждом чате только ownerId в поле members и admins.
 * Запуск: node scripts/clean-members.js
 * Флаг --dry — только покажет изменения, не запишет файл.
 */

const fs = require("fs");
const path = require("path");

const DRY = process.argv.includes("--dry");
const CHATS_FILE = path.join(__dirname, "../db/chats.json");

let chats;
try {
  chats = JSON.parse(fs.readFileSync(CHATS_FILE, "utf8"));
} catch (e) {
  console.error("Не удалось прочитать chats.json:", e.message);
  process.exit(1);
}

let changed = 0;

const cleaned = chats.map((chat) => {
  const ownerId = chat.ownerId || null;

  const newMembers = ownerId ? [ownerId] : [];
  const newAdmins  = ownerId ? [ownerId] : [];

  const membersChanged =
    JSON.stringify(chat.members) !== JSON.stringify(newMembers);
  const adminsChanged  =
    JSON.stringify(chat.admins)  !== JSON.stringify(newAdmins);

  if (membersChanged || adminsChanged) {
    changed++;
    console.log(`[ИЗМЕНЁН] "${chat.title}" (${chat.id})`);
    if (membersChanged) {
      console.log(`  members: ${JSON.stringify(chat.members)} → ${JSON.stringify(newMembers)}`);
    }
    if (adminsChanged) {
      console.log(`  admins:  ${JSON.stringify(chat.admins)} → ${JSON.stringify(newAdmins)}`);
    }
  }

  return {
    ...chat,
    members: newMembers,
    admins:  newAdmins,
  };
});

if (changed === 0) {
  console.log("Все чаты уже чистые. Изменений нет.");
  process.exit(0);
}

if (DRY) {
  console.log(`\n[DRY RUN] ${changed} чатов были бы изменены. Файл не перезаписан.`);
} else {
  fs.writeFileSync(CHATS_FILE, JSON.stringify(cleaned, null, 2), "utf8");
  console.log(`\nГотово. Изменено чатов: ${changed}. Файл перезаписан.`);
}

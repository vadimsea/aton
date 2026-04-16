/**
 * Дымовой тест: создать пользователя в PostgreSQL и прочитать его обратно.
 * Запуск: npm run db:smoke
 *
 * Требуется .env с DATABASE_URL и выполненный prisma migrate / db push.
 */
const crypto = require("crypto");
const { prisma } = require("../lib/prisma");

function randomId() {
  return crypto.randomBytes(32).toString("hex");
}

async function main() {
  const id = randomId();
  const email = `smoke_${Date.now()}@example.local`;
  const username = `smoke_${Date.now()}`;
  const publicId = `smoke${Date.now()}`;

  const created = await prisma.user.create({
    data: {
      id,
      email,
      username,
      displayName: "Smoke User",
      passwordHash: "$2a$10$placeholderHashReplaceInRealCode",
      publicId,
      friends: [],
      blocked: [],
    },
  });

  console.log("created:", { id: created.id, email: created.email, username: created.username });

  const found = await prisma.user.findUnique({
    where: { id: created.id },
  });

  console.log("findUnique by id:", found ? "ok" : "missing", found?.username);

  const byEmail = await prisma.user.findUnique({
    where: { email: created.email },
  });

  console.log("findUnique by email:", byEmail?.username === created.username);

  // Очистка тестовой строки (раскомментируй, если хочешь удалять после проверки)
  // await prisma.user.delete({ where: { id: created.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

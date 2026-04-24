-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Существующие sessionToken → отдельные строки Session (устройства остаются залогинены)
INSERT INTO "sessions" ("id", "userId", "token", "createdAt")
SELECT
  lower(replace(gen_random_uuid()::text, '-', '')),
  u."id",
  u."sessionToken",
  COALESCE(u."lastSeen", u."createdAt", CURRENT_TIMESTAMP)
FROM "users" u
WHERE u."sessionToken" IS NOT NULL;

-- Индексы для тяжёлого OR в /api/messages/all
CREATE INDEX IF NOT EXISTS "messages_from_username_createdAt_idx" ON "messages" ("from_username", "time");
CREATE INDEX IF NOT EXISTS "messages_to_username_createdAt_idx" ON "messages" ("to_username", "time");

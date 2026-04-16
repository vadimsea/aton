-- CreateTable
CREATE TABLE IF NOT EXISTS "reports" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reports_chatId_reportedBy_key" ON "reports"("chatId", "reportedBy");

-- Уникальные sessionToken (несколько NULL допускается в PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "users_sessionToken_key" ON "users"("sessionToken");

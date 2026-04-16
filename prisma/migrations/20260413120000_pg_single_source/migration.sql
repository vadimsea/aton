-- Full initial schema for empty PostgreSQL (Render, etc.).
-- DROP: fixes a half-applied failed deploy (only `reports` existed, index on `users` failed).
-- Do not use on a DB with data you need — only for empty / broken first migration.
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "reports" CASCADE;
DROP TABLE IF EXISTS "chats" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "avatarDataUrl" TEXT,
    "sessionToken" TEXT,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "friends" JSONB NOT NULL DEFAULT '[]',
    "blocked" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "owner" TEXT,
    "ownerId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "inviteToken" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "avatarDataUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "members" JSONB NOT NULL DEFAULT '[]',
    "admins" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "from_username" TEXT NOT NULL,
    "to_username" TEXT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "imageDataUrl" TEXT,
    "audioDataUrl" TEXT,
    "time" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "replyTo" JSONB,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "reactions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "users_sessionToken_key" ON "users"("sessionToken");

-- CreateIndex
CREATE INDEX "messages_chatId_time_idx" ON "messages"("chatId", "time" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reports_chatId_reportedBy_key" ON "reports"("chatId", "reportedBy");

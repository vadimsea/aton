CREATE TABLE "device_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'ios',
  "token" TEXT NOT NULL,
  "appVersion" TEXT,
  "environment" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX "device_tokens_userId_enabled_idx" ON "device_tokens"("userId", "enabled");
CREATE INDEX "device_tokens_username_enabled_idx" ON "device_tokens"("username", "enabled");

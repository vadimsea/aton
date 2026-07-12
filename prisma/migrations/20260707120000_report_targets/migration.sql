ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "target_type" TEXT NOT NULL DEFAULT 'chat';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "target_user_id" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "message_id" TEXT;

ALTER TABLE "reports" ALTER COLUMN "chatId" DROP NOT NULL;

ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_chatId_reportedBy_key";

CREATE INDEX IF NOT EXISTS "reports_target_type_status_createdAt_idx" ON "reports"("target_type", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "reports_reportedBy_createdAt_idx" ON "reports"("reportedBy", "createdAt");
CREATE INDEX IF NOT EXISTS "reports_chatId_idx" ON "reports"("chatId");
CREATE INDEX IF NOT EXISTS "reports_target_user_id_idx" ON "reports"("target_user_id");
CREATE INDEX IF NOT EXISTS "reports_message_id_idx" ON "reports"("message_id");

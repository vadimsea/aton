-- Заявки в друзья (входящие / исходящие)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "friendRequestsIn" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "friendRequestsOut" JSONB NOT NULL DEFAULT '[]';

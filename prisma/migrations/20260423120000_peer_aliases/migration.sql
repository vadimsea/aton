-- PeerAlias: как текущий пользователь переименовал собеседников (синхронно на устройствах)
ALTER TABLE "users" ADD COLUMN "peerAliases" JSONB NOT NULL DEFAULT '{}';

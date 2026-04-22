/**
 * Подхватывает переменные из qa-bots/.env и при необходимости из .env в корне репозитория.
 * Второй файл не перезаписывает уже заданные ключи (удобно для локального override в qa-bots/.env).
 */
import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function loadQaBotsEnv() {
  const libDir = path.dirname(fileURLToPath(import.meta.url));
  const qaBotsDir = path.join(libDir, "..");
  const rootDir = path.join(qaBotsDir, "..");
  const rootEnv = path.join(rootDir, ".env");
  const qaEnv = path.join(qaBotsDir, ".env");
  if (existsSync(rootEnv)) dotenv.config({ path: rootEnv });
  if (existsSync(qaEnv)) dotenv.config({ path: qaEnv, override: true });
}

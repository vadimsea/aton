/**
 * Создаёт на FTP каталог для отчётов QA: заливает пустой маркер (STOR создаёт путь;
 * ensureDir+cd на части панелей даёт 550).
 *   node scripts/ensure-ftp-qa-dir.mjs
 */
import { Client } from "basic-ftp";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const host = process.env.FTP_HOST;
const user = process.env.FTP_USER;
const pass = process.env.FTP_PASS;
const port = process.env.FTP_PORT ? parseInt(process.env.FTP_PORT, 10) : 21;
const remoteRoot = (process.env.FTP_QA_DIR || "qa-bots")
  .trim()
  .replace(/^\/+/, "")
  .replace(/\/+$/, "");

if (!host || !user || !pass) {
  console.error("Нужны FTP_HOST, FTP_USER, FTP_PASS в .env");
  process.exit(1);
}
if (!remoteRoot) {
  console.error("FTP_QA_DIR пустой");
  process.exit(1);
}

const marker = path.join(tmpdir(), "qa-dir-marker");
writeFileSync(marker, "");
const remotePath = path.posix.join(remoteRoot, ".qa-dir-created");

const c = new Client(60_000);
c.ftp.verbose = process.env.FTP_DEBUG === "1";
try {
  await c.access({ host, user, password: pass, port, secure: false });
  await c.uploadFrom(marker, remotePath);
  console.log("OK: каталог для отчётов готов (маркер залит):", remotePath);
} finally {
  c.close();
}
try {
  unlinkSync(marker);
} catch {
  // ignore
}

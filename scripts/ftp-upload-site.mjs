/**
 * Заливает статику Атона на FTP (веб-корень согласно FTP_REMOTE_DIR в .env).
 * Учётные данные: .env, затем .env.deploy (deployment перекрывает пути, FTP можно только в .env).
 *
 *   npm run deploy:site
 *   node scripts/ftp-upload-site.mjs
 */
import { Client } from "basic-ftp";
import dotenv from "dotenv";
import { stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.deploy") });

const host = process.env.FTP_HOST;
const user = process.env.FTP_USER;
const pass = process.env.FTP_PASS;
const port = process.env.FTP_PORT ? parseInt(process.env.FTP_PORT, 10) : 21;
const raw = process.env.FTP_REMOTE_DIR;
const remoteRoot =
  raw === undefined
    ? "public_html"
    : String(raw).trim().replace(/^\/+/, "").replace(/\/+$/, "");
const useSubdir = remoteRoot && remoteRoot !== ".";

const SITE_FILES = [
  "index.html",
  "main.js",
  "style.css",
  "forgot.html",
  "reset.html",
  "admin-users.html",
];

if (!host || !user || !pass) {
  console.error("Нужны FTP_HOST, FTP_USER, FTP_PASS в .env или .env.deploy");
  process.exit(1);
}

const client = new Client(120_000);
client.ftp.verbose = process.env.FTP_DEBUG === "1";

try {
  await client.access({ host, user, password: pass, port, secure: false });
  if (useSubdir) {
    await client.ensureDir(remoteRoot);
    await client.cd(remoteRoot);
  }
  for (const name of SITE_FILES) {
    const lp = path.join(root, name);
    try {
      await stat(lp);
    } catch {
      console.warn("  (пропуск, нет файла)", name);
      continue;
    }
    console.log("  ->", name);
    await client.uploadFrom(lp, name);
  }
  console.log("Remote cwd:", await client.pwd());
  console.log("Готово. Обновите страницу с очисткой кэша (Ctrl+F5).");
} finally {
  client.close();
}

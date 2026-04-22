/**
 * Заливка каталога на FTP (passive) — удобнее, чем WebClient на chroot (меньше 553).
 * Читает .env.deploy в корне репозитория.
 *   node scripts/ftp-upload-deploy.mjs <путь_к_стейдж_папке>
 */
import { Client } from "basic-ftp";
import dotenv from "dotenv";
import { readdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.deploy") });

const staging = process.argv[2];
if (!staging) {
  console.error("Usage: node scripts/ftp-upload-deploy.mjs <stagingDir>");
  process.exit(1);
}

const host = process.env.FTP_HOST;
const user = process.env.FTP_USER;
const pass = process.env.FTP_PASS;
const port = process.env.FTP_PORT ? parseInt(process.env.FTP_PORT, 10) : 21;
// Ключ не задан → public_html. FTP_REMOTE_DIR= (пусто) → заливка в каталог сразу после логина (веб-корень).
const raw = process.env.FTP_REMOTE_DIR;
const remoteRoot =
  raw === undefined
    ? "public_html"
    : String(raw).trim().replace(/^\/+/, "").replace(/\/+$/, "");
// . или пусто = не заходить в подпапку (веб-корень = PWD при логине)
const useSubdir = remoteRoot && remoteRoot !== ".";

if (!host || !user || !pass) {
  console.error("Missing FTP_HOST, FTP_USER, or FTP_PASS in .env.deploy");
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
  const files = await readdir(staging);
  for (const name of files) {
    const lp = path.join(staging, name);
    if ((await stat(lp)).isFile()) {
      console.log("  ->", name);
      await client.uploadFrom(lp, name);
    }
  }
  const here = await client.pwd();
  console.log("Remote cwd:", here);
} finally {
  client.close();
}

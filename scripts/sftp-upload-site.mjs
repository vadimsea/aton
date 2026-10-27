/**
 * Заливает статику Атона на хостинг по SFTP (hoster.by, vh161).
 *
 *   npm run deploy:site              — заливка
 *   npm run deploy:site -- --dry-run — только показать, что изменится (ничего не пишет на сервер)
 *
 * Реквизиты берутся из переменных окружения (можно положить в .env / .env.deploy — оба в .gitignore):
 *   ATEN_SFTP_USER                 обязательно, логин (например h196284)
 *   ATEN_SFTP_PASSWORD             обязательно, пароль. В репозитории не хранится.
 *   ATEN_SFTP_HOST                 по умолчанию vh161.hoster.by
 *   ATEN_SFTP_PORT                 по умолчанию 22
 *   ATEN_SFTP_REMOTE_DIR           по умолчанию www/aten.vadzim.by (корень сайта относительно домашней папки)
 *   ATEN_SFTP_HOST_FINGERPRINT     SHA256-отпечаток ключа сервера вида "SHA256:...". Для vh161.hoster.by
 *                                  зашит по умолчанию; "off" — не проверять (не рекомендуется).
 *
 * Перед заливкой текущие файлы сервера копируются в backups/site-<время>/ (папка в .gitignore).
 * Каждый файл сначала кладётся во временное имя, сверяется по размеру и только потом переименовывается,
 * поэтому посетитель никогда не получит наполовину загруженный файл.
 */
import SftpClient from "ssh2-sftp-client";
import dotenv from "dotenv";
import { mkdir, readdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.deploy") });

const DEFAULT_HOST = "vh161.hoster.by";
/** Ключ ssh-ed25519 сервера vh161.hoster.by (87.232.64.21), зафиксирован при первом подключении. Это публичная информация. */
const DEFAULT_HOST_FINGERPRINTS = {
  "vh161.hoster.by": "SHA256:bY0AtRAaiB+g6Zp+XCEkyOXoQzZdIFk4DGmmG6Ay+Ik",
  "87.232.64.21": "SHA256:bY0AtRAaiB+g6Zp+XCEkyOXoQzZdIFk4DGmmG6Ay+Ik",
};

const host = (process.env.ATEN_SFTP_HOST || DEFAULT_HOST).trim();
const port = Number(process.env.ATEN_SFTP_PORT || 22);
const username = (process.env.ATEN_SFTP_USER || "").trim();
const password = process.env.ATEN_SFTP_PASSWORD || "";
const remoteRoot = (process.env.ATEN_SFTP_REMOTE_DIR || "www/aten.vadzim.by").trim().replace(/^\/+|\/+$/g, "");
const pinned = (process.env.ATEN_SFTP_HOST_FINGERPRINT || DEFAULT_HOST_FINGERPRINTS[host] || "").trim();
const dryRun = process.argv.includes("--dry-run");

if (!username || !password) {
  console.error("Нужны переменные окружения ATEN_SFTP_USER и ATEN_SFTP_PASSWORD (см. комментарий в начале файла).");
  console.error("Пример (PowerShell):  $env:ATEN_SFTP_USER='...'; $env:ATEN_SFTP_PASSWORD='...'; npm run deploy:site");
  process.exit(1);
}

const SITE_FILES = [
  "index.html",
  "main.js",
  "style.css",
  "forgot.html",
  "reset.html",
  "admin-users.html",
  "golos-aton-avatar.png",
  "aten-logo.png",
  "manifest.webmanifest",
];

async function listIcons() {
  const dir = path.join(root, "icons");
  try {
    return (await readdir(dir)).sort().map((f) => `icons/${f}`);
  } catch {
    return [];
  }
}

/** ssh2 отдаёт отпечаток hex-строкой; переводим в привычный вид SHA256:base64 без «=». */
function toFingerprint(hexHash) {
  return "SHA256:" + Buffer.from(hexHash, "hex").toString("base64").replace(/=+$/, "");
}

const sftp = new SftpClient();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(root, "backups", `site-${stamp}`);

try {
  await sftp.connect({
    host,
    port,
    username,
    password,
    readyTimeout: 30_000,
    hostHash: "sha256",
    hostVerifier: (hash) => {
      const actual = toFingerprint(hash);
      if (!pinned || pinned.toLowerCase() === "off") {
        console.warn(`! Ключ сервера не проверяется. Отпечаток: ${actual}`);
        return true;
      }
      if (actual === pinned) return true;
      console.error(`Отпечаток ключа сервера не совпал!\n  ожидался: ${pinned}\n  получен:  ${actual}`);
      return false;
    },
  });
  console.log(`Подключено: ${username}@${host}:${port}, каталог ${remoteRoot}${dryRun ? "  [dry-run]" : ""}`);

  if (!(await sftp.exists(remoteRoot))) {
    throw new Error(`На сервере нет каталога ${remoteRoot}. Проверьте ATEN_SFTP_REMOTE_DIR.`);
  }

  const files = [...SITE_FILES, ...(await listIcons())];
  const plan = [];
  for (const name of files) {
    const local = path.join(root, ...name.split("/"));
    let localSize;
    try {
      localSize = (await stat(local)).size;
    } catch {
      console.warn("  (пропуск, нет файла)", name);
      continue;
    }
    const remote = `${remoteRoot}/${name}`;
    const remoteInfo = (await sftp.exists(remote)) ? await sftp.stat(remote) : null;
    plan.push({ name, local, remote, localSize, remoteSize: remoteInfo ? remoteInfo.size : null });
  }

  if (dryRun) {
    for (const p of plan) {
      const state = p.remoteSize === null ? "новый" : p.remoteSize === p.localSize ? "тот же размер" : "изменён";
      console.log(`  ${p.name}  (${p.localSize} Б, на сервере: ${p.remoteSize ?? "нет"}) — ${state}`);
    }
    console.log("Dry-run: на сервер ничего не записано.");
  } else {
    // 1. Резервная копия того, что сейчас на сервере
    let saved = 0;
    for (const p of plan) {
      if (p.remoteSize === null) continue;
      const dst = path.join(backupDir, ...p.name.split("/"));
      await mkdir(path.dirname(dst), { recursive: true });
      await sftp.fastGet(p.remote, dst);
      saved++;
    }
    console.log(`Резервная копия: ${saved} файлов -> ${path.relative(root, backupDir)}`);

    // 2. Заливка через временное имя + атомарное переименование
    if (!(await sftp.exists(`${remoteRoot}/icons`))) await sftp.mkdir(`${remoteRoot}/icons`, true);
    for (const p of plan) {
      const tmp = `${p.remote}.upload`;
      await sftp.fastPut(p.local, tmp);
      const uploaded = (await sftp.stat(tmp)).size;
      if (uploaded !== p.localSize) {
        throw new Error(`Размер ${p.name} не совпал: локально ${p.localSize}, на сервере ${uploaded}`);
      }
      await sftp.posixRename(tmp, p.remote);
      console.log("  ->", p.name, p.localSize);
    }
    console.log("Готово. Обновите страницу с очисткой кэша (Ctrl+F5).");
  }
} catch (err) {
  console.error("Ошибка деплоя:", err && err.message ? err.message : err);
  process.exitCode = 1;
} finally {
  await sftp.end().catch(() => {});
}

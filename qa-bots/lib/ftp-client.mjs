/**
 * Загрузка плоской папки отчётов на FTP.
 * Env: FTP_HOST, FTP_USER, FTP_PASS, FTP_QA_DIR
 * (путь **от каталога после логина** на FTP, без ведущего / — напр. qa-bots или public_html/qa-bots)
 * Опц.: FTP_PORT (по умолчанию 21)
 */

import { Client } from "basic-ftp";
import { readdir, stat } from "fs/promises";
import path from "path";

/**
 * Список всех файлов в дереве: { localPath, relPosix } (relPosix — от localRoot).
 */
export async function walkLocalFiles(localRoot) {
  const out = [];
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      const lp = path.join(dir, name);
      const st = await stat(lp);
      if (st.isDirectory()) {
        await walk(lp);
      } else {
        const rel = path.relative(localRoot, lp).split(path.sep).join("/");
        out.push({ localPath: lp, relPosix: rel });
      }
    }
  }
  await walk(localRoot);
  return out;
}

/**
 * Всё дерево localOutDir → FTP внутри remoteRoot (файлы и подпапки, напр. shots/…).
 */
export async function uploadOutDir(localOutDir) {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const pass = process.env.FTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("Задайте FTP_HOST, FTP_USER, FTP_PASS");
  }
  const remoteRoot = (process.env.FTP_QA_DIR || "qa-bots")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!remoteRoot) {
    throw new Error("Задайте непустой FTP_QA_DIR");
  }
  const port = process.env.FTP_PORT
    ? parseInt(process.env.FTP_PORT, 10)
    : 21;

  const client = new Client(120_000);
  client.ftp.verbose = process.env.FTP_DEBUG === "1";
  try {
    await client.access({ host, user, password: pass, port, secure: false });
    const files = await walkLocalFiles(path.resolve(localOutDir));
    /** Уникальные префиксы `remoteRoot/.../папка` — Pure-FTPd иногда даёт 553, если вложенный STOR без явных катаалогов. */
    const parentDirs = new Set();
    for (const { relPosix } of files) {
      const remote = path.posix.join(remoteRoot, relPosix);
      let p = path.posix.dirname(remote);
      while (p && p !== "." && p !== "/") {
        parentDirs.add(p);
        p = path.posix.dirname(p);
        if (p === remoteRoot) break;
      }
    }
    const byDepth = Array.from(parentDirs).sort(
      (a, b) => a.split("/").length - b.split("/").length
    );
    for (const d of byDepth) {
      try {
        await client.ensureDir(d);
      } catch (e) {
        console.warn("FTP ensureDir", d, e.message || e);
      }
    }
    for (const { localPath, relPosix } of files) {
      const remote = path.posix.join(remoteRoot, relPosix);
      await client.uploadFrom(localPath, remote);
    }
  } finally {
    client.close();
  }
}

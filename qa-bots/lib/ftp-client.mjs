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
      if (d === remoteRoot) continue;
      try {
        await client.ensureDir(d);
      } catch (e) {
        console.warn("FTP ensureDir", d, e.message || e);
      }
    }
    // ensureDir оставляет CWD внутри вложенной папки; пути "qa-bots/…" дальше читаются неверно → 553
    try {
      await client.cd("/");
    } catch {
      // ignore
    }
    files.sort(
      (a, b) =>
        a.relPosix.split("/").length - b.relPosix.split("/").length
    );
    for (const { localPath, relPosix } of files) {
      const remote = path.posix.join(remoteRoot, relPosix);
      await client.uploadFrom(localPath, remote);
    }
  } finally {
    client.close();
  }
}

const REPORT_NAME_RE = /\.(html|md|png|webp|jpe?g)$/i;

/**
 * Список относительных путей (как в walkLocalFiles) внутри FTP_QA_DIR — файлы, уже существующие на сервере.
 * Нужен для merge в index.html, чтобы старые отчёты не исчезали из оглавления после заливки из «пустого» CI out/.
 */
export async function listRemoteQaReportPaths() {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const pass = process.env.FTP_PASS;
  if (!host || !user || !pass) {
    return [];
  }
  const remoteRoot = (process.env.FTP_QA_DIR || "qa-bots")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!remoteRoot) {
    return [];
  }
  const port = process.env.FTP_PORT
    ? parseInt(process.env.FTP_PORT, 10)
    : 21;
  const client = new Client(120_000);
  client.ftp.verbose = process.env.FTP_DEBUG === "1";
  const out = [];

  try {
    await client.access({ host, user, password: pass, port, secure: false });
    try {
      await client.cd("/");
    } catch {
      /* */
    }

    async function walkDir(relFromQaRoot) {
      const full = relFromQaRoot
        ? path.posix.join(remoteRoot, relFromQaRoot)
        : remoteRoot;
      let entries;
      try {
        entries = await client.list(full);
      } catch (e) {
        console.warn("FTP listRemoteQaReportPaths: list", full, e.message || e);
        return;
      }
      for (const ent of entries) {
        const name = ent.name;
        if (name === "." || name === "..") continue;
        const rel = relFromQaRoot ? path.posix.join(relFromQaRoot, name) : name;
        if (ent.isDirectory) {
          await walkDir(rel);
        } else {
          if (name === "index.html") continue;
          if (!REPORT_NAME_RE.test(name)) continue;
          out.push(rel);
        }
      }
    }

    await walkDir("");
  } finally {
    client.close();
  }
  return [...new Set(out.map((p) => p.split(path.sep).join("/")))];
}

/**
 * Загрузка плоской папки отчётов на FTP.
 * Env: FTP_HOST, FTP_USER, FTP_PASS, FTP_QA_DIR (например /public_html/qa-bots)
 */

import { Client } from "basic-ftp";
import { readdir, stat } from "fs/promises";
import path from "path";

/**
 * Все файлы из localOutDir → remoteDir (без вложенных подпапок)
 */
export async function uploadOutDir(localOutDir) {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const pass = process.env.FTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("Задайте FTP_HOST, FTP_USER, FTP_PASS");
  }
  const remoteRoot = (process.env.FTP_QA_DIR || "/public_html/qa-bots").replace(/\/$/, "");

  const client = new Client(120_000);
  client.ftp.verbose = process.env.FTP_DEBUG === "1";
  try {
    await client.access({ host, user, password: pass, secure: false });
    await client.ensureDir(remoteRoot);

    const files = await readdir(localOutDir);
    for (const name of files) {
      const lp = path.join(localOutDir, name);
      const st = await stat(lp);
      if (st.isFile()) {
        await client.uploadFrom(lp, `${remoteRoot}/${name}`);
      }
    }
  } finally {
    client.close();
  }
}

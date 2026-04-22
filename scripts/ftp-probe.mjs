/**
 * Одноразовая диагностика: PWD + список в корне после логина.
 *   node scripts/ftp-probe.mjs
 */
import { Client } from "basic-ftp";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.deploy") });

const port = process.env.FTP_PORT ? parseInt(process.env.FTP_PORT, 10) : 21;
const c = new Client(60_000);
try {
  await c.access({
    host: process.env.FTP_HOST,
    user: process.env.FTP_USER,
    password: process.env.FTP_PASS,
    port,
    secure: false
  });
  console.log("PWD:", await c.pwd());
  for (const x of await c.list()) {
    const t = x.isDirectory ? "d" : "-";
    console.log(t, x.name);
  }
} finally {
  c.close();
}

/**
 * index.html: локальные файлы + уже существующие на FTP (прошлые отчёты), чтобы CI не затирал оглавление.
 */
import { writeIndexHtml } from "./report-index.mjs";
import { listRemoteQaReportPaths } from "./ftp-client.mjs";

export async function writeMergedQaIndex(outDir) {
  let extra = [];
  if (process.env.FTP_HOST && process.env.FTP_USER && process.env.FTP_PASS) {
    try {
      extra = await listRemoteQaReportPaths();
    } catch (e) {
      console.warn("FTP listRemoteQaReportPaths (merge index):", e.message || e);
    }
  }
  await writeIndexHtml(outDir, { additionalRels: extra });
}

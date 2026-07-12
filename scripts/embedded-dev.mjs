/**
 * Локальная разработка без Docker/установщика PostgreSQL:
 * поднимает embedded-postgres (порт 5433), миграции, smoke, затем server.js.
 * Остановка: Ctrl+C (закроет и Node, и Postgres).
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PORT = Number(process.env.EMBEDDED_PG_PORT || 5433);
const PG_USER = "postgres";
const PG_PASS = "aton_embed_dev";
const DB_NAME = "aton";
const DATA_DIR =
  process.env.EMBEDDED_PG_DATA_DIR ||
  path.join(root, ".data", PORT === 5433 ? "embedded-pg" : `embedded-pg-${PORT}`);

function databaseUrl() {
  const pass = encodeURIComponent(PG_PASS);
  return `postgresql://${PG_USER}:${pass}@127.0.0.1:${PORT}/${DB_NAME}?schema=public`;
}

function patchEnvFile(url) {
  const envPath = path.join(root, ".env");
  let content = "";
  try {
    content = fs.readFileSync(envPath, "utf8");
  } catch {
    content = "";
  }
  const lines = content.split(/\r?\n/);
  let replaced = false;
  const out = lines.map((line) => {
    if (/^\s*DATABASE_URL\s*=/.test(line)) {
      replaced = true;
      return `DATABASE_URL="${url}"`;
    }
    return line;
  });
  if (!replaced) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    out.push("# Локальная БД: npm run dev:embedded (embedded-postgres, порт " + PORT + ")");
    out.push(`DATABASE_URL="${url}"`);
  }
  fs.writeFileSync(envPath, out.filter((l, i, a) => !(l === "" && a[i + 1] === "")).join("\n") + "\n", "utf8");
  console.log(`Обновлён ${path.relative(root, envPath)} → DATABASE_URL на порт ${PORT}`);
}

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: PG_USER,
    password: PG_PASS,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  console.log("Инициализация embedded PostgreSQL (первый запуск может скачать бинарники)…");
  const pgVersionFile = path.join(DATA_DIR, "PG_VERSION");
  if (!fs.existsSync(pgVersionFile)) {
    await pg.initialise();
  } else {
    console.log("Кластер уже есть в .data/embedded-pg — initdb пропущен.");
  }
  await pg.start();

  try {
    await pg.createDatabase(DB_NAME);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (!/already exists/i.test(msg) && !/duplicate/i.test(msg)) throw e;
    console.log(`База «${DB_NAME}» уже есть — ок.`);
  }

  const url = databaseUrl();
  process.env.DATABASE_URL = url;

  // Пустая БД: сначала схема из schema.prisma, иначе migrate падает (миграция добавляет индексы к уже существующим таблицам).
  console.log("Синхронизация схемы (prisma db push)…");
  execSync("npx prisma db push", { cwd: root, stdio: "inherit", env: process.env });

  // После db push схема уже в БД — `migrate deploy` даёт P3005. Baseline: только запись в _prisma_migrations.
  console.log("Фиксирую миграцию в истории Prisma (baseline)…");
  try {
    execSync("npx prisma migrate resolve --applied 20260413120000_pg_single_source", {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    console.log("Миграция уже в истории — ок.");
  }

  console.log("Дымовой тест БД…");
  execSync("npm run db:smoke", { cwd: root, stdio: "inherit", env: process.env });

  patchEnvFile(url);

  const serverPath = path.join(root, "server.js");
  console.log(`Запуск API: http://localhost:${process.env.PORT || 3000} (Ctrl+C — выход)\n`);

  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

  const shutdown = async () => {
    try {
      child.kill("SIGTERM");
    } catch (_) {}
    try {
      await pg.stop();
    } catch (_) {}
  };

  child.on("exit", (code) => {
    shutdown().then(() => process.exit(code ?? 0));
  });

  process.on("SIGINT", () => {
    shutdown().then(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

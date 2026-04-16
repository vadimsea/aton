/**
 * QA: HTTP API checks (curl-like via fetch)
 */
const base = process.env.QA_BASE || "http://127.0.0.1:3000";

async function req(path, opts = {}) {
  const r = await fetch(base + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data };
}

const ts = Date.now();
const email = `qa_${ts}@test.local`;
const username = `qauser${ts}`;
const password = "Secret123!";

const results = [];

function log(name, pass, detail) {
  results.push({ name, pass, detail });
  const s = pass === true ? "PASS" : pass === false ? "FAIL" : "SKIP";
  console.log(`[${s}] ${name}${detail ? " — " + detail : ""}`);
}

(async () => {
  console.log("=== QA API tests ===");
  console.log("base:", base);

  // 1 Root
  {
    const r = await fetch(base + "/");
    log("GET /", r.status === 200, `status ${r.status}`);
  }

  // 2 Register success
  let token;
  {
    const r = await req("/api/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    });
    const ok = Boolean(r.status === 200 && r.data && r.data.token);
    token = r.data?.token;
    log("POST /api/register (success)", ok, `status ${r.status} token=${!!token}`);
  }

  // 3 Duplicate email
  {
    const r = await req("/api/register", {
      method: "POST",
      body: JSON.stringify({ email, username: username + "x", password }),
    });
    log(
      "POST /api/register duplicate email",
      r.status === 400 && String(r.data?.error || "").length > 0,
      `status ${r.status} err=${r.data?.error || r.data}`
    );
  }

  // 4 Duplicate username (new email, same username)
  {
    const r = await req("/api/register", {
      method: "POST",
      body: JSON.stringify({ email: `qa2_${ts}@test.local`, username, password }),
    });
    log(
      "POST /api/register duplicate username",
      r.status === 400,
      `status ${r.status} err=${r.data?.error || r.data}`
    );
  }

  // 5 Login ok
  {
    const r = await req("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    log("POST /api/login (ok)", Boolean(r.status === 200 && r.data?.token), `status ${r.status}`);
    if (r.data?.token) token = r.data.token;
  }

  // 6 Login bad password
  {
    const r = await req("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "wrong" }),
    });
    log("POST /api/login (bad password)", r.status === 401, `status ${r.status}`);
  }

  // 7 GET /api/me with token
  {
    const r = await req("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    log("GET /api/me (with token)", r.status === 200 && r.data?.username === username, `status ${r.status}`);
  }

  // 8 GET /api/me no token
  {
    const r = await req("/api/me");
    log("GET /api/me (no token)", r.status === 401, `status ${r.status}`);
  }

  // 9 GET /api/me bad token
  {
    const r = await req("/api/me", {
      headers: { Authorization: "Bearer deadbeefinvalidtoken00000000000000000000000000000000" },
    });
    log("GET /api/me (bad token)", r.status === 401, `status ${r.status}`);
  }

  // 10 Messages
  {
    const r = await req("/api/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId: "global", type: "text", text: "hello QA" }),
    });
    log("POST /api/messages (text)", Boolean(r.status === 200 && r.data?.id), `status ${r.status}`);
  }

  for (let i = 0; i < 3; i++) {
    const r = await req("/api/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId: "global", type: "text", text: `burst ${i}` }),
    });
    log(`POST /api/messages burst ${i}`, r.status === 200, `status ${r.status}`);
  }

  // Empty — type required; empty text may still succeed
  {
    const r = await req("/api/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId: "global", type: "text", text: "" }),
    });
    log("POST /api/messages empty text", r.status === 200, `status ${r.status}`);
  }

  // Long message
  {
    const long = "A".repeat(5000);
    const r = await req("/api/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId: "global", type: "text", text: long }),
    });
    log("POST /api/messages long (5000 chars)", r.status === 200, `status ${r.status}`);
  }

  // -- PG-only user (needs DATABASE_URL + running Postgres)
  if (process.env.DATABASE_URL) {
    try {
      require("dotenv").config();
      const { prisma } = require("../lib/prisma");
      const crypto = require("crypto");
      const bcrypt = require("bcryptjs");
      const id = crypto.randomBytes(32).toString("hex");
      const pwd = "PgOnly123!";
      const hash = await bcrypt.hash(pwd, 10);
      const pub = `pgonly${ts}`;
      const em = `pgonly_${ts}@test.local`;
      const un = `pgonly${ts}`;
      await prisma.user.create({
        data: {
          id,
          email: em,
          username: un,
          displayName: "PG Only",
          passwordHash: hash,
          publicId: pub,
          friends: [],
          blocked: [],
          sessionToken: crypto.randomBytes(32).toString("hex"),
        },
      });
      const login = await req("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: em, password: pwd }),
      });
      const pgOnlyToken = login.data?.token;
      log(
        "POST /api/login (PG-only user)",
        Boolean(login.status === 200 && pgOnlyToken),
        `status ${login.status} (user only in PostgreSQL)`
      );
      await prisma.user.delete({ where: { id } }).catch(() => {});
      await prisma.$disconnect().catch(() => {});
    } catch (e) {
      log("POST /api/login (PG-only user)", false, String(e.message || e));
    }
  } else {
    log("POST /api/login (PG-only user)", "skip", "no DATABASE_URL");
  }

  console.log("\n=== Summary ===");
  const passed = results.filter((x) => x.pass === true).length;
  const failed = results.filter((x) => x.pass === false).length;
  const skipped = results.filter((x) => x.pass !== true && x.pass !== false).length;
  console.log("PASS:", passed, "FAIL:", failed, "SKIP/INFO:", skipped);
  if (failed) process.exit(1);
})();

/**
 * Бесплатный смоук-тест прод-API (GitHub Actions / локально).
 * Не шлёт писем в LLM — только проверяет, что бэкенд отвечает.
 *
 *   QA_BASE=https://aton-api.onrender.com node scripts/qa-prod-smoke.js
 */
const base = (process.env.QA_BASE || "https://aton-api.onrender.com").replace(/\/$/, "");

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

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass, detail });
  const s = pass ? "PASS" : "FAIL";
  console.log(`[${s}] ${name}${detail ? " — " + detail : ""}`);
}

(async () => {
  console.log("=== QA prod smoke ===");
  console.log("QA_BASE:", base);

  // 1 Health
  {
    const r = await req("/api/health");
    ok("GET /api/health", r.status === 200 && r.data && r.data.ok === true, `status ${r.status}`);
  }

  const ts = Date.now();
  const email = `smoke_${ts}@test.local`;
  const username = `smoke${ts}`;
  const password = "SmokeTest123!";

  // 2 Register
  let token;
  {
    const r = await req("/api/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    });
    token = r.data?.token;
    ok(
      "POST /api/register",
      r.status === 200 && Boolean(token),
      `status ${r.status} token=${Boolean(token)}`
    );
  }

  // 3 Login
  {
    const r = await req("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (r.data?.token) token = r.data.token;
    ok("POST /api/login", r.status === 200 && Boolean(token), `status ${r.status}`);
  }

  // 4 GET /api/me
  {
    const r = await req("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    ok(
      "GET /api/me",
      r.status === 200 && r.data?.username === username,
      `status ${r.status}`
    );
  }

  // 5 POST /api/messages — без подтверждённой почты ожидаем 403 (это норма)
  {
    const r = await req("/api/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId: "global", type: "text", text: "smoke" }),
    });
    const expect403 =
      r.status === 403 &&
      String(r.data?.error || "").includes("Подтвердите");
    ok(
      "POST /api/messages (unverified → 403)",
      expect403,
      `status ${r.status} err=${JSON.stringify(r.data?.error || "").slice(0, 80)}`
    );
  }

  const failed = results.filter((x) => !x.pass).length;
  console.log("\n=== Summary ===");
  console.log("FAIL:", failed, "/", results.length);
  if (failed) {
    console.error("\nПровалившиеся проверки:");
    results.filter((x) => !x.pass).forEach((x) => console.error(" -", x.name, x.detail));
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

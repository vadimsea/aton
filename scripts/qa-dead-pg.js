/* QA: backend with unreachable Postgres — must not crash core JSON paths */
const base = "http://127.0.0.1:3000";
const ts = Date.now();

(async () => {
  console.log("=== QA dead PostgreSQL ===");
  const reg = await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `deadpg_${ts}@test.local`,
      username: `deadpg${ts}`,
      password: "Secret123!",
    }),
  });
  const rj = await reg.json();
  console.log("register", reg.status, reg.ok ? "ok" : rj);
  const log = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `deadpg_${ts}@test.local`, password: "Secret123!" }),
  });
  const lj = await log.json();
  console.log("login", log.status, log.ok ? "ok" : lj);
  const token = lj.token;

  const me = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("/api/me", me.status, me.ok);

  const msg = await fetch(`${base}/api/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId: "global", type: "text", text: "dead pg test" }),
  });
  const mj = await msg.json();
  console.log("POST /api/messages", msg.status, msg.ok ? mj.id : mj);
  console.log(reg.ok && log.ok && me.ok && msg.ok ? "PASS all JSON paths" : "FAIL");
})();

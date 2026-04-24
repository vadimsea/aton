/**
 * Проверка: два POST /api/login (или register + login) с одного аккаунта —
 * оба токена дают 200 на GET /api/me (мультисессия).
 *
 *   QA_BASE=https://aton-api.onrender.com node scripts/test-multi-session.mjs
 */
const base = (process.env.QA_BASE || "https://aton-api.onrender.com").replace(/\/$/, "");
const pass = "MultiSessTest!a1";

const ts = Date.now();
const email = `multises_${ts}@test.local`;
const username = `multises${ts}`;

async function main() {
  const reg = await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password: pass }),
  });
  const regData = await reg.json().catch(() => ({}));
  if (reg.status !== 200 || !regData.token) {
    console.error("register failed:", reg.status, regData);
    process.exit(1);
  }
  const token1 = regData.token;

  const log = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const logData = await log.json().catch(() => ({}));
  if (log.status !== 200 || !logData.token) {
    console.error("login failed:", log.status, logData);
    process.exit(1);
  }
  const token2 = logData.token;

  if (token1 === token2) {
    console.error("ожидались два разных токена");
    process.exit(1);
  }

  const me1 = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const me2 = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  if (me1.status !== 200 || me2.status !== 200) {
    console.error("GET /api/me:", me1.status, me2.status);
    if (me1.status === 401 && me2.status === 200) {
      console.error(
        "(Старое API: один токен на пользователя; после деплоя с таблицей sessions — оба должны быть 200.)"
      );
    }
    process.exit(1);
  }

  const out1 = await me1.json();
  const out2 = await me2.json();
  if (out1.username !== username || out2.username !== username) {
    console.error("username mismatch", out1.username, out2.username);
    process.exit(1);
  }

  const off = await fetch(`${base}/api/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token1}` },
  });
  if (off.status !== 200) {
    console.error("logout", off.status);
    process.exit(1);
  }
  const after = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  if (after.status === 200) {
    console.error("после logout первый токен ещё действует");
    process.exit(1);
  }
  const still2 = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  if (still2.status !== 200) {
    console.error("второй токен перестал работать — ожидаем одну сессию отозвана");
    process.exit(1);
  }

  console.log("OK: multi-session + logout одной сессии");
  console.log("   base:", base);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

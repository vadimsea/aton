/**
 * QA: register → run test-socket.js logic inline + POST /api/messages
 */
const { io } = require("socket.io-client");

const base = "http://127.0.0.1:3000";

async function main() {
  const ts = Date.now();
  const email = `sock_${ts}@test.local`;
  const username = `sockuser${ts}`;
  const password = "Secret123!";

  const reg = await fetch(`${base}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });
  const j = await reg.json();
  if (!reg.ok || !j.token) {
    console.error("FAIL register", reg.status, j);
    process.exit(1);
  }
  const token = j.token;
  console.log("OK register, token acquired");

  const socket = io(base, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    timeout: 8000,
  });

  const ch = await fetch(`${base}/api/chats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: `QA Socket ${ts}`, type: "group" }),
  });
  const chj = await ch.json();
  if (!ch.ok || !chj.id) {
    console.error("FAIL create chat", ch.status, chj);
    process.exit(1);
  }
  const groupChatId = chj.id;
  console.log("OK group chat", groupChatId);

  let gotNew = false;
  socket.on("message:new", (msg) => {
    gotNew = true;
    console.log("OK message:new", msg?.id, (msg?.text || "").slice(0, 40));
    socket.disconnect();
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("connect timeout")), 10000);
    socket.on("connect", () => {
      clearTimeout(t);
      console.log("OK socket connect", socket.id);
      resolve();
    });
    socket.on("connect_error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  socket.emit("join_chat", groupChatId);

  const post = await fetch(`${base}/api/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      chatId: groupChatId,
      type: "text",
      text: "socket e2e ping",
    }),
  });
  const pj = await post.json();
  console.log("POST /api/messages", post.status, pj?.id ? "ok" : pj);

  await new Promise((r) => setTimeout(r, 4000));
  if (!socket.connected) {
    /* already disconnected by message:new */
  } else socket.disconnect();
  if (!post.ok) process.exit(2);
  if (!gotNew) {
    console.error("FAIL no message:new received");
    process.exit(4);
  }
  console.log("DONE");
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(3);
});

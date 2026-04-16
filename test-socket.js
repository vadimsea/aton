/**
 * QA: Socket.io smoke — token auth + message:new
 * Run: node test-socket.js <TOKEN>
 */
const { io } = require("socket.io-client");

const token = process.argv[2];
if (!token) {
  console.error("Usage: node test-socket.js <sessionToken>");
  process.exit(1);
}

const url = process.env.ATON_SOCKET_URL || "http://127.0.0.1:3000";

const socket = io(url, {
  auth: { token },
  transports: ["websocket"],
  reconnection: false,
  timeout: 8000,
});

let gotNew = false;

socket.on("connect", () => {
  console.log("OK connect, id=", socket.id);
  socket.emit("join_chat", "global");
});

socket.on("message:new", (msg) => {
  gotNew = true;
  console.log("OK message:new", msg?.id, msg?.chatId, String(msg?.text || "").slice(0, 40));
  socket.disconnect();
});

socket.on("connect_error", (e) => {
  console.error("FAIL connect_error:", e.message);
  process.exit(2);
});

socket.on("disconnect", () => {
  process.exit(gotNew ? 0 : 3);
});

setTimeout(() => {
  console.error("FAIL timeout waiting for message:new");
  process.exit(4);
}, 15000);

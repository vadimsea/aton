const base = process.env.QA_BASE || "http://127.0.0.1:3000";
(async () => {
  const ts = Date.now();
  const r = await fetch(base + "/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `q_${ts}@t.co`, username: `q${ts}`, password: "x" }),
  });
  const j = await r.json();
  const t = j.token;
  const empty = await fetch(base + "/api/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: "global", type: "text", text: "" }),
  });
  const b = await empty.json();
  console.log("POST empty text /global:", empty.status, b);
})();

/**
 * Проверка ключа Groq и модели (локально или на CI с секретом).
 *
 *   node scripts/check-groq.mjs
 *   # или из корня с .env:
 *   node -r dotenv/config scripts/check-groq.mjs
 *
 * Переменные: GROQ_API_KEY (обязательно), GROQ_TEXT_MODEL (опционально).
 */
import "dotenv/config";

const key = String(process.env.GROQ_API_KEY || "").trim();
const model = String(process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile").trim();

if (!key) {
  console.error("FAIL: нет GROQ_API_KEY. Добавьте в .env или экспортируйте в окружение.");
  process.exit(1);
}

const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "0" }],
    max_tokens: 8,
    temperature: 0,
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error("FAIL: Groq HTTP", res.status);
  console.error(text.slice(0, 800));
  process.exit(1);
}

let j;
try {
  j = JSON.parse(text);
} catch {
  console.error("FAIL: не JSON", text.slice(0, 200));
  process.exit(1);
}

const out = j?.choices?.[0]?.message?.content;
console.log("OK: модель", model, "→", JSON.stringify(out ?? "").slice(0, 120));
process.exit(0);

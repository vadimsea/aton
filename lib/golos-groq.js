/**
 * Ответы «Голоса Атона» через Groq (OpenAI-совместимый API).
 * Переменные: GROQ_API_KEY, опционально GROQ_TEXT_MODEL.
 */

async function fetchGolosReply(userText, { username, displayName }) {
  if (typeof globalThis.fetch !== "function") {
    console.error("golos-groq: нет globalThis.fetch — задайте на Render Node 18+ (Settings → Build & Deploy).");
    return "На сервере устарел Node. Нужен Node 18 или новее, чтобы обращаться к Groq.";
  }
  const key = String(process.env.GROQ_API_KEY || "").trim();
  if (!key) {
    return "Сейчас ответы помощника недоступны. Обратитесь к администраторам, если вопрос срочный.";
  }
  const model = String(process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile").trim();
  const system = [
    "Ты — «Голос Атона», вежливый и мудрый помощник в мессенджере «Атон».",
    "Отвечай по существу, на русском, спокойно и дружелюбно.",
    "Ты цифровой помощник, не выдавай себя за человека.",
    "Если вопрос вне твоей компетенции, скажи честно и мягко предложи написать в поддержку или к людям.",
  ].join(" ");

  const label = (displayName && String(displayName).trim()) || username;
  const user = `Собеседник: @${username} (${label}).\n\nСообщение:\n${userText}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 1500,
      temperature: 0.45,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Groq API error:", res.status, t);
    return "Сейчас не удалось сформировать ответ. Попробуйте чуть позже.";
  }
  const j = await res.json();
  const out = j?.choices?.[0]?.message?.content;
  if (!out || !String(out).trim()) {
    return "Прошу прощения, не получилось ответить. Напишите ещё раз.";
  }
  return String(out).trim();
}

module.exports = { fetchGolosReply };

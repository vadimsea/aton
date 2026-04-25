/**
 * «Голос Атона»: текст (Groq), расшифровка голоса (Groq Whisper), озвучка (OpenAI TTS или Google TTS).
 * Переменные: GROQ_API_KEY, опционально GROQ_TEXT_MODEL, GROQ_STT_MODEL, OPENAI_API_KEY (лучшее качество TTS).
 */

const { getAudioBase64, getAllAudioBase64 } = require("google-tts-api");
const { buildGolosSystemPrompt } = require("./golos-persona");

/**
 * @param {object} opts
 * @param {Array<{ role: "user" | "assistant"; content: string }>} opts.history — хронология, последняя реплика всегда от user (текущий вопрос)
 * @param {boolean} [opts.fromVoice] — последний вопрос с голоса (короче устный ответ)
 */
async function fetchGolosReply({ history, fromVoice = false } = {}) {
  if (typeof globalThis.fetch !== "function") {
    console.error("golos-groq: нет globalThis.fetch — задайте на Render Node 18+ (Settings → Build & Deploy).");
    return "Здесь среда слаба. Нужен Node 18+.";
  }
  const key = String(process.env.GROQ_API_KEY || "").trim();
  if (!key) {
    return "Речь сейчас недоступна.";
  }
  const model = String(process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile").trim();
  const maxReplyTokens = (() => {
    const n = parseInt(String(process.env.GROQ_MAX_TOKENS || "900"), 10);
    const cap = Number.isFinite(n) && n >= 200 && n <= 8000 ? n : 900;
    if (fromVoice) return Math.min(520, cap);
    return cap;
  })();
  const maxContextChars = (() => {
    const n = parseInt(String(process.env.GOLOS_MAX_CONTEXT_CHARS || "40000"), 10);
    return Number.isFinite(n) && n > 2000 ? n : 40000;
  })();

  let turnList = Array.isArray(history) ? history.map((m) => ({ role: m.role, content: String(m.content || "").trim() })) : [];
  turnList = turnList.filter((m) => m.content && (m.role === "user" || m.role === "assistant"));
  if (!turnList.length || turnList[turnList.length - 1].role !== "user") {
    return "Нить контекста оборвалась. Повтори.";
  }
  // Ужимаем с начала, если в истории слишком много текста (как окно в ChatGPT)
  let size = turnList.reduce((a, m) => a + m.content.length, 0);
  while (size > maxContextChars && turnList.length > 1) {
    const rm = turnList.shift();
    size -= rm.content.length;
  }

  const system = buildGolosSystemPrompt({ fromVoice });

  const messages = [{ role: "system", content: system }, ...turnList];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxReplyTokens,
      temperature: 0.28,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Groq API error:", res.status, t);
    return "Ответ не дошёл. Повтори.";
  }
  const j = await res.json();
  const out = j?.choices?.[0]?.message?.content;
  if (!out || !String(out).trim()) {
    return "С той стороны — тишина. Повтори.";
  }
  return String(out).trim();
}

/** Расшифровка голосового (data URL) через Groq Whisper. */
async function transcribeGolosAudioDataUrl(dataUrl) {
  if (typeof globalThis.fetch !== "function") return "";
  const key = String(process.env.GROQ_API_KEY || "").trim();
  if (!key) {
    return "";
  }
  const s = String(dataUrl || "").trim();
  const m = /^data:([^;]+);base64,(.*)$/s.exec(s);
  if (!m) return "";
  let buf;
  try {
    buf = Buffer.from(m[2].replace(/\s/g, ""), "base64");
  } catch {
    return "";
  }
  if (buf.length < 32) return "";
  const mime = (m[1] || "audio/webm").split(";")[0].trim();
  const sttModel = String(process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo").trim();
  const name = mime.includes("webm")
    ? "voice.webm"
    : mime.includes("ogg")
      ? "voice.ogg"
      : mime.includes("mp4") || mime.includes("m4a")
        ? "voice.m4a"
        : mime.includes("mpeg") || mime.includes("mp3")
          ? "voice.mp3"
          : "voice.webm";
  const form = new FormData();
  const blob = new Blob([buf], { type: mime });
  form.append("file", blob, name);
  form.append("model", sttModel);
  form.append("language", "ru");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Groq STT error:", res.status, t);
    return "";
  }
  const j = await res.json().catch(() => ({}));
  if (j && typeof j.text === "string" && j.text.trim()) {
    return j.text.trim();
  }
  const plain = await res.text().catch(() => "");
  return String(plain || "").trim();
}

async function ttsOpenAiMpegDataUrl(text) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) return null;
  const input = String(text).slice(0, 4096);
  if (!input.trim()) return null;
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input,
      voice: "nova",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("OpenAI TTS error:", res.status, t);
    return null;
  }
  const ab = await res.arrayBuffer();
  return `data:audio/mpeg;base64,${Buffer.from(ab).toString("base64")}`;
}

const GOOGLE_TTS_OPTS = { lang: "ru", slow: false, timeout: 25_000, splitPunct: ",.!?;:\n—" };

/** Озвучка: OpenAI TTS при OPENAI_API_KEY, иначе Google TTS (короткий текст сразу, длинный — несколько сегментов → один data URL). */
async function synthesizeGolosReplyToDataUrl(fullText) {
  const t = String(fullText || "").trim();
  if (!t) return null;

  const oa = await ttsOpenAiMpegDataUrl(t);
  if (oa) return oa;

  try {
    if (t.length <= 200) {
      const b64 = await getAudioBase64(t, GOOGLE_TTS_OPTS);
      if (b64) return `data:audio/mpeg;base64,${b64}`;
    } else {
      const parts = await getAllAudioBase64(t, GOOGLE_TTS_OPTS);
      if (parts && parts.length) {
        const bufs = parts.map((p) => Buffer.from(p.base64, "base64"));
        const merged = Buffer.concat(bufs);
        return `data:audio/mpeg;base64,${merged.toString("base64")}`;
      }
    }
  } catch (e) {
    console.error("google-tts-api:", e);
  }
  return null;
}

/**
 * @param {object} opt
 * @param {string} opt.replyText
 * @param {boolean} [opt.asVoice] — если true, пытаемся вернуть только голос; иначе можно только текст
 */
async function buildGolosBotReplyContent(replyText, { asVoice = false } = {}) {
  const text = String(replyText || "").trim();
  if (!text) {
    return { type: "text", text: "Пустой ответ.", audioDataUrl: null };
  }
  const dataUrl = await synthesizeGolosReplyToDataUrl(text);
  if (dataUrl) {
    return { type: "audio", text, audioDataUrl: dataUrl };
  }
  if (asVoice) {
    return {
      type: "text",
      text: `${text}\n\n(Озвучка временно недоступна, ответ текстом.)`,
      audioDataUrl: null,
    };
  }
  return { type: "text", text, audioDataUrl: null };
}

module.exports = {
  fetchGolosReply,
  transcribeGolosAudioDataUrl,
  synthesizeGolosReplyToDataUrl,
  buildGolosBotReplyContent,
};

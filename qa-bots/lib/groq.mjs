/**
 * Вызовы Groq (vision + text). Ключ: GROQ_API_KEY
 * Vision: у модели лимит **5 изображений** за запрос — пакуем и сливаем в один отчёт.
 */

const GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions";
/** Groq: Too many images provided. This model supports up to 5 images */
const GROQ_VISION_MAX_IMAGES = 5;

export async function groqVision({
  system,
  userText,
  imagePaths,
  imageLabels,
  model = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
  maxTokens = 4000,
}) {
  const paths = Array.isArray(imagePaths) ? imagePaths.filter(Boolean) : [];
  if (paths.length <= GROQ_VISION_MAX_IMAGES) {
    return groqVisionOnce({ system, userText, imagePaths: paths, model, maxTokens });
  }
  const labels = Array.isArray(imageLabels) && imageLabels.length === paths.length ? imageLabels : null;
  const parts = [];
  const totalBatches = Math.ceil(paths.length / GROQ_VISION_MAX_IMAGES);
  for (let b = 0; b < totalBatches; b++) {
    const from = b * GROQ_VISION_MAX_IMAGES;
    const chunk = paths.slice(from, from + GROQ_VISION_MAX_IMAGES);
    const lab = labels ? labels.slice(from, from + GROQ_VISION_MAX_IMAGES) : null;
    const sub =
      `**Пакет кадров ${b + 1} из ${totalBatches}** (${chunk.length} скриншот).` +
      (lab && lab.length
        ? `\nПодписи к кадрам этого пакета: ${lab.join(" | ")}`
        : "") +
      `\n\n${userText}`;
    const p = await groqVisionOnce({ system, userText: sub, imagePaths: chunk, model, maxTokens: Math.min(maxTokens, 5000) });
    parts.push(`--- Пакет ${b + 1} / ${totalBatches} ---\n\n${p}`);
  }
  return groqText({
    system: `Ты редактор UI/UX-отчёта (мессенджер «Атон»). Ниже — части анализа **разных паков скриншотов** (один пак = до ${GROQ_VISION_MAX_IMAGES} кадров). Объедини в **один** связный отчёт на русском, сохрани P1-проблемы и конкретику, убери дубли, добавь краткое резюме в начало.`,
    user: `Части анализа:\n\n${parts.join("\n\n")}`,
    maxTokens: Math.min(8000, maxTokens + 2000),
  });
}

async function groqVisionOnce({
  system,
  userText,
  imagePaths,
  model = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
  maxTokens = 4000,
}) {
  const fs = await import("fs");
  const { readFileSync, existsSync } = fs;

  const content = [{ type: "text", text: userText }];
  let i = 0;
  for (const p of imagePaths) {
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    if (buf.length > 3.2 * 1024 * 1024) {
      content.push({ type: "text", text: `(Кадр ${++i} пропущен: файл слишком большой)` });
      continue;
    }
    const b64 = buf.toString("base64");
    content.push({ type: "text", text: `Скриншот ${++i}:` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${b64}` },
    });
  }

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content });

  const res = await fetch(GROQ_CHAT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.35,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Groq vision ${res.status}: ${JSON.stringify(j).slice(0, 800)}`);
  }
  return j.choices?.[0]?.message?.content || String(JSON.stringify(j)).slice(0, 2000);
}

export async function groqText({ system, user, model, maxTokens = 4000 }) {
  const m = model || process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });

  const res = await fetch(GROQ_CHAT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: m,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Groq text ${res.status}: ${JSON.stringify(j).slice(0, 800)}`);
  }
  return j.choices?.[0]?.message?.content || String(JSON.stringify(j)).slice(0, 2000);
}

/**
 * One-shot: проверка в main.js цепочки кнопки микрофона + PTT + Голос Атона.
 *   node scripts/check-golos-ptt.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(path.join(root, "main.js"), "utf8");

const checks = [
  ["В разметке compose есть кнопка #aton-mic", /id="aton-mic"/.test(main)],
  [
    "Мик: pointerdown (PTT, не клик по toggle)",
    /micButton\.addEventListener\(\s*["']pointerdown["']/.test(main),
  ],
  ["Функция runPttFromPointerEvent (getUserMedia + MediaRecorder)", /async function runPttFromPointerEvent/.test(main)],
  ["getUserMedia + setPointerCapture в потоке", /getUserMedia\(\s*\{\s*audio:\s*true/.test(main)],
  [
    "Для чата Голоса Атона: отпустил = авто-отправка (без превью)",
    /pttToGolosAton/.test(main) && /sendAudioBlobAsMessage/.test(main),
  ],
  ["Скрытие кнопки «Отправить» в Голосе", /updateGolosChatChrome/.test(main) && /sendButton\.setAttribute\(\s*["']hidden["']/.test(main)],
  ["Класс aton-compose--golos на панель ввода", /aton-compose--golos/.test(main)],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log(ok ? "OK  " : "FAIL", name);
  if (!ok) fail++;
}

if (main.includes('addEventListener("click"') && main.match(/micButton\.addEventListener/)) {
  // доп. проверка: у микрофона не должно остаться ТОЛЬКО click — pointerdown обязателен
  const micClick = /micButton\.addEventListener\(\s*["']click["']/.test(main);
  console.log(micClick ? "WARN mic still has click handler (ok if alongside pointer)" : "OK  mic: no exclusive click handler line");
}

const url = process.env.VERIFY_PROD_URL;
if (url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const t = await r.text();
    const ok =
      t.includes("runPttFromPointerEvent") &&
      t.includes("id=\"aton-mic\"") &&
      t.includes("sendAudioBlobAsMessage");
    console.log(ok ? "OK  " : "FAIL", `Проверка по сети: ${url} (${(t.length / 1024).toFixed(0)} KB)`);
    if (!ok) fail++;
  } catch (e) {
    console.log("FAIL сеть", url, (e && e.message) || e);
    fail++;
  }
}

process.exit(fail ? 1 : 0);

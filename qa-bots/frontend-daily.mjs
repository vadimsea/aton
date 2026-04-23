/**
 * Фронт QA: логин по токену, 3 вьюпорта (ПК / планшет / мобилка), длинная сессия (по умолч. ≥20 мин),
 * мобильный размер **меняется по волнам** (низкие/узкие экраны), Playwright сверяет topbar+compose с viewport;
 * микро-сценарии → Groq vision → UI/UX-отчёт. До скринов: **замер сессии** (F5+токен, повторный F5, `networkidle`).
 * После анализа **PNG удаляются** (остаются .md / .html). FTP: FTP_QA_DIR.
 *
 * Env: GROQ_API_KEY, QA_BOT_TOKEN, QA_FRONTEND_URL,
 *      FTP_HOST, FTP_USER, FTP_PASS, FTP_QA_DIR
 *      QA_MIN_TEST_MS — целевая длительность (мс), по умолчанию 1_200_000 (20 мин)
 *      QA_BETWEEN_WAVES_MS — пауза между волнами (три вьюпорта), по умолчанию 5 мин
 */

import { loadQaBotsEnv } from "./lib/load-env.mjs";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { groqVision } from "./lib/groq.mjs";
import { uploadOutDir } from "./lib/ftp-client.mjs";
import { writeMergedQaIndex } from "./lib/write-merged-qa-index.mjs";

loadQaBotsEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");

const FRONT = (process.env.QA_FRONTEND_URL || "https://aten.vadzim.by").replace(/\/$/, "");
const TOKEN = process.env.QA_BOT_TOKEN;
const ATON_KEY = "aton_token";

const DESKTOP_VP = { name: "desktop", width: 1440, height: 900, label: "Настольный (≈1440×900)" };
const TABLET_VP = { name: "tablet", width: 834, height: 1112, label: "Планшет (≈834×1112)" };
/** Смена по волнам — ловит обрезку шапки/строки ввода на разных моб. размерах */
const MOBILE_VP_ROT = [
  { name: "m390-844", width: 390, height: 844, label: "Моб. (≈390×844, типовой)" },
  { name: "m360-640", width: 360, height: 640, label: "Моб. низкий/широкий (360×640)" },
  { name: "m320-568", width: 320, height: 568, label: "Моб. узкий/короткий (320×568, SE-эстетика)" },
];

/**
 * @param {number} wave 1-based
 */
function getViewportsForWave(wave) {
  const m = MOBILE_VP_ROT[(Math.max(1, wave) - 1) % MOBILE_VP_ROT.length];
  return [DESKTOP_VP, TABLET_VP, m];
}

/**
 * В режиме открытого чата: шапка и панель ввода не должны выходить за innerHeight.
 * @param {import('playwright').Page} page
 */
async function checkChatChromeInViewport(page) {
  const inChat = await page.locator(".aton-shell--has-chat").count().then((c) => c > 0);
  if (!inChat) return null;
  const vh = await page.evaluate(() => window.innerHeight);
  const topbar = page.locator("#aton-topbar");
  const compose = page.locator(".aton-compose");
  const input = page.locator("#aton-input");
  const tb = await topbar.boundingBox().catch(() => null);
  const cp = await compose.boundingBox().catch(() => null);
  if (!tb) return "нет bbox у #aton-topbar";
  if (!cp) return "нет bbox у .aton-compose";
  const parts = [];
  if (tb.y < -0.5) parts.push(`topbar.y=${tb.y.toFixed(0)} (вышел вверх)`);
  if (tb.y + tb.height > vh + 1) parts.push(`topbar низ ${(tb.y + tb.height).toFixed(0)} > ${vh}`);
  if (cp.y < -0.5) parts.push(`compose.y=${cp.y.toFixed(0)}`);
  if (cp.y + cp.height > vh + 2) parts.push(`compose низ ${(cp.y + cp.height).toFixed(0)} > innerHeight`);
  const inpVis = await input.isVisible().catch(() => false);
  if (!inpVis) parts.push("#aton-input невидим");
  return parts.length ? `ПРОБЛЕМА: ${parts.join("; ")}` : "ok: topbar+compose+поле ввода в пределах innerHeight";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Замер: восстановление сессии с токеном в localStorage, повторный F5, «долгий» networkidle.
 * @param {import("playwright").Browser} browser
 * @param {string} baseUrl
 * @param {string} token
 * @param {string} storageKey
 */
async function runSessionAndLatencyProbe(browser, baseUrl, token, storageKey) {
  /** @type {{ lines: string[]; hadFailure: boolean }} */
  const out = { lines: [], hadFailure: false };
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.evaluate(
      ([k, v]) => {
        localStorage.setItem(k, v);
      },
      [storageKey, token]
    );

    const t1 = Date.now();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector(".aton-auth-logged", { state: "visible", timeout: 120_000 });
    const ms1 = Date.now() - t1;
    out.lines.push(
      `1) Первый F5 с токеном в localStorage: панель «вошли» (класс .aton-auth-logged) за **${ms1}ms**`
    );
    if (ms1 > 20_000) {
      out.lines.push("   **ПРОБЛЕМА:** >20с до рабочей панели (ожидаем обычно <10с; холодный API допустим слабее).");
      out.hadFailure = true;
    }

    const t2 = Date.now();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector(".aton-auth-logged", { state: "visible", timeout: 120_000 });
    const ms2 = Date.now() - t2;
    out.lines.push(`2) Второй F5 (проверка «не разлогинивает»): снова «вошли» за **${ms2}ms**`);
    if (ms2 > 20_000) {
      out.lines.push("   **ПРОБЛЕМА:** повторный F5 слишком долгий.");
      out.hadFailure = true;
    }

    const t3 = Date.now();
    await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
    const ms3 = Date.now() - t3;
    out.lines.push(
      `3) F5 с waitUntil=networkidle: **${ms3}ms** (субъективная «долгота сети»/WebSocket; часто объясняет ощущение «логин ~30с»).`
    );
    if (ms3 > 30_000) {
      out.lines.push("   **ПРОБЛЕМА:** networkidle >30с — неприемлемо для ощущения отзывчивости.");
      out.hadFailure = true;
    }

    const still = await page.locator(".aton-auth-logged").isVisible().catch(() => false);
    if (!still) {
      out.lines.push("**ПРОБЛЕМА:** после reload(networkidle) UI как у гостя — сессия/токен не держатся на обновлении.");
      out.hadFailure = true;
    } else {
      out.lines.push("После `networkidle` панель «вошли» **видна** — визуальный «разлогин только по UI» в этом сценарии нет.");
    }
  } catch (e) {
    out.hadFailure = true;
    out.lines.push(
      `**ПРОБЛЕМА:** сессия не поднялась (форма входа / таймаут / 401) — **${(e && e.message) || String(e)}**`
    );
  } finally {
    await page.close();
  }
  return out;
}

const MIN_TEST_MS = Number(process.env.QA_MIN_TEST_MS) > 0 ? Number(process.env.QA_MIN_TEST_MS) : 20 * 60 * 1000;
const BETWEEN_WAVES_MS =
  Number(process.env.QA_BETWEEN_WAVES_MS) > 0 ? Number(process.env.QA_BETWEEN_WAVES_MS) : 5 * 60 * 1000;

/**
 * @param {import('playwright').Page} page
 * @param {string} tag
 * @param {string} dateStr
 * @param {number} wave 1-based — разные микро-действия для разнообразия UI в кадре
 * @returns {Promise<{ path: string, layoutNote: string | null }>}
 */
async function runUserFlowAndShot(page, tag, dateStr, wave = 1) {
  await page.goto(FRONT, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.evaluate(
    ([k, v]) => {
      localStorage.setItem(k, v);
    },
    [ATON_KEY, TOKEN]
  );
  await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
  await sleep(2000);
  try {
    await page.waitForSelector("#aton-chat-list", { timeout: 60_000 });
  } catch {
    // гость / ошибка — всё равно скрин
  }

  // Волны: друзья, фильтр «личные», смена темы — больше поверхностей UI для UX-отчёта
  const phase = (wave - 1) % 3;
  try {
    if (phase === 1) {
      const fr = page.locator("#aton-friends-btn, #aton-sidebar-friends-btn").first();
      try {
        await fr.waitFor({ state: "visible", timeout: 2000 });
        await fr.click();
        await sleep(900);
        await page.keyboard.press("Escape").catch(() => {});
        await sleep(300);
      } catch {
        /* кнопка невидна на этом вьюпорте */
      }
    } else if (phase === 2) {
      const fp = page.locator("#aton-filter-private");
      try {
        await fp.waitFor({ state: "visible", timeout: 2000 });
        await fp.click();
        await sleep(500);
      } catch {
        /* */
      }
    } else {
      const th = page.locator("#aton-theme-toggle, #aton-sidebar-theme-btn").first();
      try {
        await th.waitFor({ state: "visible", timeout: 2000 });
        await th.click();
        await sleep(400);
        await th.click();
        await sleep(300);
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }

  const list = page.locator("#aton-chat-list");
  if (await list.isVisible().catch(() => false)) {
    try {
      await list.evaluate((el) => {
        el.scrollTop = Math.min(el.scrollHeight, 180);
      });
      await sleep(300);
    } catch {
      /* */
    }
  }

  const items = page.locator(".aton-chat-item");
  const n = await items.count();
  if (n > 0) {
    try {
      const idx = wave % n;
      await items.nth(idx).click();
      await page.waitForSelector(".aton-messages", { state: "visible", timeout: 15_000 });
      await sleep(600);
      const msg = page.locator(".aton-messages");
      if (await msg.count()) {
        await msg.first().evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await sleep(400);
      }
    } catch {
      /* */
    }
  }
  const layoutNote = await checkChatChromeInViewport(page);
  // Плоские имена в out/ (без shots/дата/) — тот же уровень, что у бэкенд-отчётов, чтобы FTP (Pure-FTPd) заливал без 553
  const outP = path.join(OUT, `fe-${dateStr}-${tag}.png`);
  await page.screenshot({ path: outP, fullPage: false, type: "png" });
  return { path: outP, layoutNote };
}

async function main() {
  if (!TOKEN) {
    console.error("Нужен QA_BOT_TOKEN (верифицированный бот).");
    process.exit(1);
  }
  if (!process.env.GROQ_API_KEY) {
    console.error("Нужен GROQ_API_KEY");
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  const stamp = new Date();
  const dateStr = stamp.toISOString().slice(0, 10);
  const timeStr = stamp.toISOString();
  const tSession = Date.now();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const sessionProbe = await runSessionAndLatencyProbe(browser, FRONT, TOKEN, ATON_KEY);
  if (sessionProbe.hadFailure) {
    console.warn("FE QA: сессия или задержка входа — детали в отчёте:\n" + sessionProbe.lines.join("\n"));
  }
  const shots = [];
  const labels = [];
  /** @type {string[]} */
  const layoutNotes = [];
  let wave = 0;

  try {
    // Не меньше MIN_TEST_MS: несколько волн (десктоп / планшет / мобилка) + паузы
    do {
      wave += 1;
      for (const vp of getViewportsForWave(wave)) {
        const page = await browser.newPage({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.name.startsWith("m") ? 2 : 1,
        });
        try {
          const tag = `w${wave}-${vp.name}`;
          const { path: p, layoutNote } = await runUserFlowAndShot(page, tag, dateStr, wave);
          shots.push(p);
          const noteLabel = layoutNote && layoutNote.startsWith("ПРОБЛЕМА") ? ` [${layoutNote}]` : "";
          labels.push(`${vp.label} · волна ${wave}${noteLabel}`);
          layoutNotes.push(`[${tag}] ${layoutNote || "—"}`);
        } finally {
          await page.close();
        }
      }
      const elapsed = Date.now() - tSession;
      if (elapsed >= MIN_TEST_MS) break;
      const remain = MIN_TEST_MS - elapsed;
      const wait = Math.min(BETWEEN_WAVES_MS, remain);
      if (wait > 0) await sleep(wait);
    } while (Date.now() - tSession < MIN_TEST_MS);
    const badLayout = layoutNotes.filter((l) => /ПРОБЛЕМА|нет bbox|невидим/.test(l));
    if (badLayout.length) {
      console.warn("FE QA: шапка/панель ввода вне viewport (см. отчёт и логи):\n" + badLayout.join("\n"));
    }
    // Гарантия: не короче MIN_TEST_MS на таймлайне
    const spent = Date.now() - tSession;
    if (spent < MIN_TEST_MS) {
      await sleep(MIN_TEST_MS - spent);
    }
  } finally {
    await browser.close();
  }

  const system = `Ты senior product-дизайнер и UI-ревьюер. Продукт — веб-мессенджер «Атон». **Критерий качества** — довести визуал и UX **в духе сильных референсов**: **Telegram** и **WhatsApp** (чистая лента, читаемые пузыри, аккуратные аватары, предсказуемая панель ввода, нормальные эмодзи/стикер-панель в перспективе). Пиши по-русски, **конкретно по кадру**, без общих фраз.
**Про мобилку (обязательно):** на кадре с **узким/низким** экраном проверяй, что **шапка чата (назад, заголовок)** и **вся панель ввода (поле + кнопки)** **полностью** попадают в кадр — половинчатая шапка или обрезанная строка ввода = **P1 / регрессия**. Сверяй с подсказками **автопроверки Playwright** ниже (если там «ПРОБЛЕМА», усиль приоритет).
**Сессия и «долгий» вход (обязательно):** в блоке **автотеста сессии** ниже — **миллисекунды** до панели «вошли», повторный F5 и **networkidle**. Разлогин при обновлении, **>15–20с** до UI или **>30с** `networkidle` = **P1** (токен, /api/me, тяжёлый bootstrap, WebSocket, cold start). Обязан отдельный подпункт в дорожной карте с причинами, не «промолчи».`;

  const sessionBlock = `\n**Сессия и задержка (автотест Playwright, до скриншотов):**\n${sessionProbe.lines.map((l) => `- ${l}`).join("\n")}\n`;

  const autoChecks = layoutNotes
    .filter((line) => /ПРОБЛЕМА/.test(line) || /нет bbox/.test(line) || /невидим/.test(line))
    .join("\n");
  const logForPrompt = layoutNotes.length > 36 ? "…(старые строки сокращены)\n" + layoutNotes.slice(-36).join("\n") : layoutNotes.join("\n");
  const autoBlock = autoChecks
    ? `\n**Автопроверка (bounding box, до скриншота):** проблемы:\n${autoChecks}\n\n**Лог (хвост):**\n${logForPrompt}\n`
    : `\n**Автопроверка (bounding box):** критичных срабатываний нет.\n**Лог:**\n${logForPrompt}\n`;

  const userPrompt = `Серия из ${shots.length} скриншотов (волны, вьюпорты **десктоп / планшет / мобилка**; мобильный размер **ротируется** — низкие и узкие). Подписи кадров: ${labels.join(" | ")}.
${sessionBlock}
${autoBlock}
**Главный фокус — зона чата и переписки** (и список чатов тоже, но **приоритет** — **интерфейс диалога**):

**А. Окно переписки (тред)** — фон, разделители дат, группировка сообщений, **пузыри** (входящие/исходящие, скругления, тень, ширина, переносы, выравнивание), **аватары** (размер, круг, сетка, выравнивание с текстом, дубли, «хвосты» если есть), **медиа/превью** в ленте, **ответы/цитаты/reply** если видны.

**Б. Содержимое сообщений** — типографика в пузыре, межстрочный интервал, **эмодзи и смайлики** (размер, соседство с текстом, обрезка), вложения, длина строки, контраст текста на фоне пузыря.

**В. Панель ввода (compose)** — поле, кнопки (отправка, вложения, **микрофон**), высота, прилипание к низу, **целиком видна** ли панель на **коротком** моб. экране (не уезжает за нижний край), safe area, **бар эмодзи/стикеров** (если виден) или его отсутствие vs **Telegram/WhatsApp**.

**Г. Список чатов (сайдбар/экран списка)** — превью, жирнота непрочитанного, бейджи, аватарки, подписи времени, согласованность с топовыми мессенджерами.

**Д. Сравнение с референсом** — в каждом разделе кратко: «чем отличается от привычного **Telegram / WhatsApp** и что **подтянуть** (цвет, плотность, ритм, иконки)».

**Е. Адаптив и вьюпорт** — **десктоп vs планшет vs мобилка**: **шапка диалога** (имя, статус, кнопка «назад») **не обрезана** сверху/по ширине; **нижняя** зона: поле ввода + кнопки **в кадре целиком** на **низких** (≈360×640, 320×568) и **узких** экранах. Если в логе автопроверки «ПРОБЛЕМА» — **P1** и конкретное исправление (CSS vh/svh/dvh, flex min-height, safe-area, не дублировать insets). Отдельно: пузыри, ширина, tap targets.

**Ё. Сессия, F5, скорость входа** — по **числам** в начале (даже без скриншота): **разлогин при F5?** (строка «ПРОБЛЕМА»), **сколько мс** до панели «вошли», «долгий» **networkidle** vs жалобы **«~30 с»** на проде; **P1** с гипотезами (токен, 401, тяжёлые запросы при bootstrap, сокеты).

Структура отчёта (сохрани нумерацию):
1. **Переписка и пузыри** (детально).
2. **Аватары, метаданные, время.**
3. **Эмодзи, текст, вложения.**
4. **Поле ввода и панель действий.**
5. **Список чатов.**
6. **Планшет** — мост между ПК и мобилкой.
7. **Волны** (тема/фильтр/друзья) — влияние на чат.
8. **A11y** (контраст, кликабельность) по видимому.
9. **Сессия, обновление страницы, задержка входа** (по данным автотеста в начале + если по скринам видно гостя при ожидаемом логине).
10. **Дорожная карта: не меньше 15** пунктов P1/P2/P3 (тег: чат / список / ввод / **сессия-перф** / везде) — к **Telegram/WhatsApp** и **стабильной** сессии.
11. **Три приоритета** (самое важное, включая сессию/скорость если цифры плохие).`;

  let analysis;
  let groqOk = false;
  try {
    analysis = await groqVision({
      system,
      userText: userPrompt,
      imagePaths: shots,
      imageLabels: labels,
      maxTokens: 6000,
    });
    groqOk = true;
  } catch (e) {
    analysis = `Ошибка Groq: ${e.message || e}`;
  }

  if (groqOk) {
    for (const p of shots) {
      try {
        await unlink(p);
      } catch (e) {
        console.warn("Не удалось удалить скриншот:", p, (e && e.message) || e);
      }
    }
  } else {
    console.warn("Groq не ответил — PNG сохранены в out/ для разбора:", shots.length, "файл(ов)");
  }

  const md = `# Фронтенд QA — ${dateStr}

**Время (UTC):** ${timeStr}  
**URL:** ${FRONT}  
**Вьюпорты:** ${labels.join(", ")}  
**Сессия (цель):** ≥ ${(MIN_TEST_MS / 60_000).toFixed(0)} мин, волны: ${BETWEEN_WAVES_MS / 60_000} мин между полными тройками вьюпортов.  
**Скриншоты:** исходные PNG удаляются после анализа; в репозиторий/FTP попадают только **текстовые** отчёты (.md / .html).

## Сессия и задержка (автотест, Playwright)

${sessionProbe.lines.join("\n\n")}

---

## Анализ (Groq)

${analysis}

---

*Сгенерировано ботом qa-bots/frontend-daily.mjs*
`;

  const safeName = `frontend-${dateStr}`;
  /* BOM: чтобы браузер/Блокнот на Windows не показывали «кракозябры» при UTF-8 */
  await writeFile(path.join(OUT, `${safeName}.md`), "\uFEFF" + md, "utf8");
  const preBody = String(analysis)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const htmlOut = `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Атон — фронт QA ${dateStr}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:50rem;margin:0 auto;padding:1.2rem;background:#0f172a;color:#e2e8f0;line-height:1.5;}
h1{font-size:1.1rem;color:#7dd3fc}
.meta{color:#94a3b8;font-size:0.85rem}
pre.content{white-space:pre-wrap;word-break:break-word;font-size:0.9rem;margin-top:0.8rem}
</style></head><body>
<h1>Отчёт фронтенд-бота</h1>
<p class="meta">${timeStr} · ${FRONT}</p>
<pre class="content">${preBody}</pre>
</body></html>`;
  await writeFile(path.join(OUT, `${safeName}.html`), htmlOut, "utf8");

  await writeMergedQaIndex(OUT);

  console.log("OK:", path.join(OUT, `${safeName}.md`));

  if (process.env.FTP_HOST && process.env.FTP_USER && process.env.FTP_PASS) {
    try {
      await uploadOutDir(OUT);
      console.log("FTP: залито в", process.env.FTP_QA_DIR || "qa-bots", "(без PNG — они удалены после анализа)");
    } catch (e) {
      console.error("FTP ошибка:", e.message || e);
      process.exit(1);
    }
  } else {
    console.log("FTP не настроен — только локальная папка qa-bots/out");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

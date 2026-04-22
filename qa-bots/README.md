# QA-боты (Groq) — фронт и бэк

Два **ежедневных** сценария: отчёты в формате **Markdown** и **HTML** и загрузка на **FTP** в отдельную папку на хостинге, чтобы смотреть вручную и пересылать в чат с ИИ.

## Что делает

| Скрипт | Расписание (UTC) | Суть |
|--------|------------------|------|
| `frontend-daily.mjs` | 05:00 | Playwright: десктоп / планшет / мобилка, вход по `QA_BOT_TOKEN`, открытие первого чата, скрины → **Groq vision** — полный UX/UI-отчёт. |
| `backend-daily.mjs` | 06:00 | Смоук `scripts/qa-prod-smoke.js`, ручные GET/metrics → **Groq text** — API, перф, безопасность, рекомендации. |

Локальная сборка: `qa-bots/out/` (добавлена в `.gitignore`). В CI папка каждый раз пустая; на **FTP** накапливаются файлы `frontend-YYYY-MM-DD.*` и `backend-YYYY-MM-DD.*`, пока не попадут под перезапись в тот же день. **`index.html`** в заливке — только для **текущего** прогона; полный список удобно смотреть в **файловом менеджере** FTP.

## Секреты GitHub (Settings → Actions)

Обязательные:

- `GROQ_API_KEY` — [console.groq.com](https://console.groq.com)
- `FTP_HOST`, `FTP_USER`, `FTP_PASS` — тот же доступ, что к сайту
- `FTP_QA_DIR` — **абсолютный путь на сервере**, например `/public_html/qa-bots` (папку можно создать пустой в панели хостинга; скрипт при необходимости создаст каталог по пути)

Дополнительно для фронт-бота:

- `QA_BOT_TOKEN` — сессия **верифицированного** тест-бота (Local Storage `aton_token` на фронте)

Опционально (переменные в workflow): `GROQ_VISION_MODEL`, `GROQ_TEXT_MODEL`.

## Локальный запуск

```bash
# из корня репозитория
npm ci
npx playwright install chromium

# фронт
set GROQ_API_KEY=...
set QA_BOT_TOKEN=...
set FTP_HOST=... & set FTP_USER=... & set FTP_PASS=...
set FTP_QA_DIR=/public_html/qa-bots
node qa-bots/frontend-daily.mjs

# бэк (FTP те же)
set GROQ_API_KEY=...
set QA_BASE=https://aton-api.onrender.com
node qa-bots/backend-daily.mjs
```

Без FTP: не задавайте `FTP_*` — отчёты останутся в `qa-bots/out/`.

## NPM-скрипты

- `npm run qa:bot:fe`
- `npm run qa:bot:be`

## Куда смотреть на проде

В браузере: `https://ваш-домен/qa-bots/index.html` (если `FTP_QA_DIR` = `/public_html/qa-bots`).

По FTP: скачивайте `.md` / `.html` с датой в имени.

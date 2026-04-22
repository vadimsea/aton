# QA-боты (Groq) — фронт и бэк

Два **ежедневных** сценария: отчёты в формате **Markdown** и **HTML** и загрузка на **FTP** (в т.ч. **подкаталоги** — скриншоты) в папку на хостинге, чтобы смотреть вручную и пересылать в чат с ИИ.

## Форматы

| | Формат | Где |
|---|--------|-----|
| **Фронт** (каждый день) | `frontend-YYYY-MM-DD.md` — Markdown | текст отчёта, удобно вставлять в чат |
| | `frontend-YYYY-MM-DD.html` | тот же анализ в веб-странице с оформлением |
| | **PNG** (3 шт. за прогон) | `out/shots/YYYY-MM-DD/fe-desktop.png`, `fe-tablet.png`, `fe-mobile.png` — **исходные скриншоты** для сравнения с текстом и правок дизайна; на FTP: `.../qa-bots/shots/YYYY-MM-DD/…` |
| **Бэк** (каждый день) | `backend-YYYY-MM-DD.md` / `.html` | API, сеть, рекомендации (без картинок) |
| **Оглавление** | `index.html` | ссылки на все залитые **.md / .html / .png** в `out` (и вложенных папках) |

Groq **vision** анализирует именно эти PNG, затем файлы **сохраняются** (не удаляются) и уходят на FTP вместе с отчётами.

## Что делает

| Скрипт | Расписание (UTC) | Суть |
|--------|------------------|------|
| `frontend-daily.mjs` | 05:00 | Playwright: десктоп / планшет / мобилка, вход по `QA_BOT_TOKEN`, открытие первого чата, скрины → **Groq vision** — полный UX/UI-отчёт. |
| `backend-daily.mjs` | 06:00 | Смоук `scripts/qa-prod-smoke.js`, ручные GET/metrics → **Groq text** — API, перф, безопасность, рекомендации. |

Локальная сборка: `qa-bots/out/` (в `.gitignore`). В CI папка каждый раз пустая; на **FTP** накапливаются суточные `frontend-*` / `backend-*`, подкаталог **`shots/дата/*.png`**, и обновлённый **`index.html`**. Список в оглавлении; при необходимости — **файловый менеджер** на хосте.

## Автозагрузка переменных

Скрипты сначала читают **`.env` в корне** репозитория, затем **`qa-bots/.env`**; при совпадении имён **приоритет у `qa-bots/.env`** (удобно для локального переопределения).

## Секреты GitHub (Settings → Actions)

Обязательные:

- `GROQ_API_KEY` — [console.groq.com](https://console.groq.com)
- `FTP_HOST`, `FTP_USER`, `FTP_PASS` — тот же доступ, что к сайту
- `FTP_QA_DIR` — путь **от каталога после входа по FTP** (часто без ведущего `/`), например `qa-bots` или `public_html/qa-bots`. Скрипт сам создаёт каталог при первой заливке; отдельно можно: `node scripts/ensure-ftp-qa-dir.mjs`

Дополнительно для фронт-бота:

- `QA_BOT_TOKEN` — сессия **верифицированного** тест-бота (Local Storage `aton_token` на фронте)

Опционально (переменные в workflow): `GROQ_VISION_MODEL`, `GROQ_TEXT_MODEL`.

### Быстрая заливка секретов в GitHub (с вашего ПК)

**Проще всего** (проверка `.env`, вход в `gh`, заливка, открытие страниц GitHub):

`powershell -ExecutionPolicy Bypass -File scripts/finish-qa-bots.ps1`

Или вручную:

1. Установите [GitHub CLI](https://cli.github.com/), выполните `gh auth login`.
2. Скопируйте `qa-bots/env.example` → **корень репозитория** как `.env`, заполните значения.
3. Запустите:

`powershell -ExecutionPolicy Bypass -File scripts/push-qa-secrets-to-github.ps1`

Скрипт передаёт в `gh secret set` только перечисленные ключи (см. сам скрипт). Иначе добавьте секреты **вручную** в веб-интерфейсе GitHub.

## Локальный запуск

```bash
# из корня репозитория
npm ci
npx playwright install chromium

# фронт
set GROQ_API_KEY=...
set QA_BOT_TOKEN=...
set FTP_HOST=... & set FTP_USER=... & set FTP_PASS=...
set FTP_QA_DIR=qa-bots
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

В браузере: `https://ваш-домен/qa-bots/index.html` (если сайт в корне FTP и `FTP_QA_DIR=qa-bots`).

По FTP: скачивайте `.md` / `.html` с датой в имени.

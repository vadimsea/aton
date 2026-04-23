# QA-боты (Groq) — фронт и бэк

Два **ежедневных** сценария: отчёты в формате **Markdown** и **HTML** и загрузка на **FTP** (в т.ч. **подкаталоги** — скриншоты) в папку на хостинге, чтобы смотреть вручную и пересылать в чат с ИИ.

## Форматы

| | Формат | Где |
|---|--------|-----|
| **Фронт** (каждый день) | `frontend-YYYY-MM-DD.md` — Markdown | текст отчёта, удобно вставлять в чат |
| | `frontend-YYYY-MM-DD.html` | тот же анализ в веб-странице с оформлением |
| | **PNG** (Playwright) | делаются на время прогона, **Groq vision** их читает, после успешного анализа **файлы удаляются** — на диск / FTP остаются только **.md / .html** (текст). |
| **Бэк** (каждый день) | `backend-YYYY-MM-DD.md` / `.html` | API, сеть, рекомендации (без картинок) |
| **Оглавление** | `index.html` | ссылки на **.md / .html** в `out` (и вложенных папках) |

Groq **vision** — до **5 картинок за запрос**; длинные сессии бьются на **пакеты** и **сливаются** текстовой моделью. Скриншоты после успеха **удаляются**; при ошибке — **оставляют** в `out/`. Для читаемого русского: откройте **`.html`**, либо `.md` с **UTF-8** (у файла с FTP добавлен **BOM**).

## Что делает

| Скрипт | Расписание (UTC) | Суть |
|--------|------------------|------|
| `frontend-daily.mjs` | 05:00 | Playwright: **замер сессии** (F5+токен, повторный F5, `networkidle`) → затем волны **десктоп / планшет / мобилка**, чат, скрины; авто-чек **PTT** (title #aton-mic) → **Groq vision** (числа сессии в промпте и в .md, без опоры только на картинки). |
| `backend-daily.mjs` | 06:00 | Смоук `scripts/qa-prod-smoke.js` (в т.ч. `golosMaxPerWindow===0`), ручные GET/metrics → **Groq text** — API, перф, безопасность, рекомендации. |

Локальная сборка: `qa-bots/out/` (в `.gitignore`). В CI папка каждый раз пустая; на **FTP** накапливаются суточные `frontend-*` / `backend-*` (текст) и обновлённый **`index.html`**. Старые вручную залитые `shots/*.png` на хосте с ботом не синхронизируются.

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

**Полуавтомат** (токен бота через `POST /api/login` по `QA_BOT_EMAIL`/`QA_BOT_PASSWORD` + GitHub без браузерного входа через `GITHUB_PAT` в `.env`):

1. Создать [classic token](https://github.com/settings/tokens) (scope `repo`), в корневой `.env`: `GITHUB_PAT=ghp_...`  
2. В `.env` указать `QA_BOT_EMAIL` и `QA_BOT_PASSWORD` **тест-бота** (подтверждённая почта).  
3. Запустить: `powershell -ExecutionPolicy Bypass -File scripts/one-setup-qa.ps1`  

Скрипт: `node scripts/fetch-qa-bot-token.mjs` → `gh auth login --with-token` → `push-qa-secrets-to-github.ps1`. Без `GITHUB_PAT` запросит обычный `gh auth login` вручную.

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

# Life Sync Bot

Telegram-бот, який перетворює плани та розклад на реалістичний таймлайн українською мовою.

## Налаштування

Потрібен Node.js 22 або новіший. Скопіюйте `.env.example` у `.env` і вкажіть токен Telegram-бота та ключ Gemini.

```sh
npm install
npm run dev
```

Для звичайного запуску зібраної версії:

```sh
npm run build
npm start
```

`npm run typecheck` перевіряє типи без створення файлів.

## Деплой на Cloudflare

Бот запускається як Cloudflare Container. Для цього потрібен Docker із доступним daemon і тариф Workers Paid. Скопіюй `.env.example` у `.env`, заповни `BOT_TOKEN` та `GEMINI_API_KEY`, потім виконай:

```sh
npm ci
npm run deploy:cloudflare
```

Wrangler завантажить значення з `.env` як Worker secrets і збудує контейнер. Cron trigger щохвилини перевіряє, чи працює бот, і перезапускає контейнер після зупинки. SQLite зберігається всередині контейнера й може очиститися після його перезапуску.

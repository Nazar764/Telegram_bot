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

`npm test` запускає тести розбору розкладу.

Розклад підтримує українські, англійські й російські назви днів, скорочення днів,
нумерацію пар арабськими або римськими цифрами, записи на кшталт «Пара №2»,
рядки з явним часом і позначки чисельника/знаменника.

Навігаційні меню оновлюються в одному повідомленні; повторний `/start` використовує останнє меню.

## Деплой на Cloudflare

Бот розгортається як Cloudflare Worker із SQLite Durable Object; Docker і каталог зі статичними файлами не потрібні. Не використовуй `wrangler pages deploy` — це команда для Cloudflare Pages, яка шукає HTML/CSS/JS-файли.

Запускай команди з кореня проєкту (`Telegram_bot`), а не з батьківського каталогу. Скопіюй `.env.example` у `.env` і заповни `BOT_TOKEN`, `GEMINI_API_KEY` та `WEBHOOK_SECRET`, потім виконай:

```sh
npm ci
npm run deploy:cloudflare
```

Скрипт явно вказує Wrangler конфігурацію `wrangler.jsonc`, завантажує значення з `.env` як Worker secrets і розгортає Worker. Після деплою зареєструй Telegram webhook POST-запитом на `/register-webhook`, передавши `Authorization` заголовок із bearer-токеном на основі `WEBHOOK_SECRET`. Cron trigger щохвилини запускає перевірку сповіщень; дані зберігаються в SQLite Durable Object.

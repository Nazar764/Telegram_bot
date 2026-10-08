import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { createBot } from './bot.js';

const database = new DatabaseSync(process.env.DATABASE_PATH ?? 'life-sync.sqlite');
const { bot, runNotificationScheduler } = createBot(database, process.env);

let retryDelayMs = 2_000;
async function launchBot(): Promise<void> {
  while (true) {
    try {
      await bot.launch({}, () => console.log('Бот підключився до Telegram і слухає повідомлення.'));
      return;
    } catch (error) {
      const telegramError = error as { code?: number; response?: { error_code?: number } };
      const errorCode = telegramError.response?.error_code ?? telegramError.code;
      console.error('❌ Помилка Telegram polling:', error);
      if (errorCode === 401 || errorCode === 409) {
        process.exitCode = 1;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
    }
  }
}

void launchBot();
const notificationScheduler = setInterval(() => void runNotificationScheduler(), 15_000);
notificationScheduler.unref();
void runNotificationScheduler();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

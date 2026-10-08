import { DurableObject } from 'cloudflare:workers';
import { createBot } from '../src/bot.ts';

const BOT_ID = 'life-sync-bot';

function secureEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function makeDatabase(sql) {
  return {
    exec(query) {
      sql.exec(query);
    },
    prepare(query) {
      return {
        get(...bindings) {
          return sql.exec(query, ...bindings).toArray()[0];
        },
        all(...bindings) {
          return sql.exec(query, ...bindings).toArray();
        },
        run(...bindings) {
          const cursor = sql.exec(query, ...bindings);
          return { changes: cursor.rowsWritten };
        },
      };
    },
  };
}

export class BotRunner extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.database = makeDatabase(ctx.storage.sql);
    const instance = createBot(this.database, env, true);
    this.bot = instance.bot;
    this.bot.telegram.webhookReply = false;
    this.runNotificationScheduler = instance.runNotificationScheduler;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return Response.json({ ok: true, storage: 'sqlite' });
    if (url.pathname === '/cron' && request.method === 'POST') {
      await this.runNotificationScheduler();
      return Response.json({ ok: true });
    }
    if (url.pathname === '/telegram-update' && request.method === 'POST') {
      if (!secureEquals(request.headers.get('x-telegram-bot-api-secret-token'), this.env.WEBHOOK_SECRET)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const update = await request.json();
      await this.bot.handleUpdate(update);
      return Response.json({ ok: true });
    }
    return new Response('Not found', { status: 404 });
  }
}

function runner(env) {
  const id = env.BOT_RUNNER.idFromName(BOT_ID);
  return env.BOT_RUNNER.get(id);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return runner(env).fetch('https://bot.internal/health');
    }

    if (url.pathname === '/register-webhook' && request.method === 'POST') {
      if (!secureEquals(request.headers.get('authorization'), `Bearer ${env.WEBHOOK_SECRET}`)) {
        return new Response('Unauthorized', { status: 401 });
      }
      const webhookUrl = `${url.origin}/telegram/webhook`;
      const telegramResponse = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'] }),
      });
      const result = await telegramResponse.json();
      return Response.json(result, { status: telegramResponse.ok ? 200 : 502 });
    }

    if (url.pathname === '/telegram/webhook' && request.method === 'POST') {
      if (!secureEquals(request.headers.get('x-telegram-bot-api-secret-token'), env.WEBHOOK_SECRET)) {
        return new Response('Unauthorized', { status: 401 });
      }
      return runner(env).fetch('https://bot.internal/telegram-update', request);
    }
    return new Response('Not found', { status: 404 });
  },

  scheduled(_event, env, ctx) {
    ctx.waitUntil(runner(env).fetch('https://bot.internal/cron', { method: 'POST' }));
  },
};

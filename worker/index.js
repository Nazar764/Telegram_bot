import { DurableObject } from 'cloudflare:workers';

const CONTAINER_PORT = 8080;
const RETRY_DELAY_MS = 500;
const MAX_HEALTH_ATTEMPTS = 40;
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000;

export class BotRunner extends DurableObject {
  async fetch() {
    try {
      await this.ensureBotRunning();
      return Response.json({ status: 'running' });
    } catch (error) {
      console.error('Life Sync bot container failed health check:', error);
      return Response.json({ status: 'starting' }, { status: 503 });
    }
  }

  async ensureBotRunning() {
    const container = this.ctx.container;
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: 'lite',
        enableInternet: true,
        env: {
          BOT_TOKEN: this.env.BOT_TOKEN,
          GEMINI_API_KEY: this.env.GEMINI_API_KEY,
        },
      });
    }

    const port = container.getTcpPort(CONTAINER_PORT);
    let lastError;
    for (let attempt = 0; attempt < MAX_HEALTH_ATTEMPTS; attempt++) {
      try {
        const response = await port.fetch('http://container/health', {
          signal: AbortSignal.timeout(2_000),
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error(`Container health returned ${response.status}`);
        await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    throw new Error('Bot container did not become healthy', { cause: lastError });
  }
}

const getBot = (env) => env.BOT_RUNNER.get(env.BOT_RUNNER.idFromName('life-sync-bot'));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/health' || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }
    return getBot(env).fetch('https://bot.internal/health');
  },

  scheduled(_event, env, context) {
    context.waitUntil(getBot(env).fetch('https://bot.internal/health'));
  },
};

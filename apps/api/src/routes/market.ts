import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { redis } from '../lib/redis.js';
import { REDIS_KEYS } from '@pulsewatch/shared';

export async function marketRoutes(app: FastifyInstance) {
  // ── Historical candles ───────────────────────────────────
  app.get('/api/market/:symbol/candles', async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const { timeframe = '1h', limit = '200' } = request.query as {
      timeframe?: string;
      limit?: string;
    };

    const validTimeframes = ['1m', '5m', '1h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid timeframe. Valid: ${validTimeframes.join(', ')}`,
      });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

    // Look up asset
    const asset = await query('SELECT id FROM assets WHERE symbol = $1', [symbol.toUpperCase()]);
    if (asset.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Asset not found' });
    }

    const result = await query(
      `SELECT open_time, open_price as open, high, low, close, volume
       FROM price_candles
       WHERE asset_id = $1 AND timeframe = $2
       ORDER BY open_time DESC
       LIMIT $3`,
      [asset.rows[0].id, timeframe, parsedLimit],
    );

    // Return in chronological order (query is DESC for LIMIT efficiency)
    return reply.send({ data: result.rows.reverse() });
  });

  // ── Latest price (Redis-backed) ──────────────────────────
  app.get('/api/market/:symbol/latest', async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const key = REDIS_KEYS.price(symbol.toUpperCase());

    const cached = await redis.get(key);
    if (!cached) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No live price data for this symbol. The ingestion service may not be running.',
      });
    }

    return reply.send({ data: JSON.parse(cached) });
  });
}

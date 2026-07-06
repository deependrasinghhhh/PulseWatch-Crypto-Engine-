import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { authGuard } from '../lib/auth.js';

export async function assetRoutes(app: FastifyInstance) {
  // ── Search / List assets ─────────────────────────────────
  app.get('/api/assets', async (request, reply) => {
    const { search } = request.query as { search?: string };

    let sql = 'SELECT id, symbol, display_name, asset_type, is_active FROM assets WHERE is_active = true';
    const params: string[] = [];

    if (search && search.trim()) {
      sql += ' AND (LOWER(symbol) LIKE $1 OR LOWER(display_name) LIKE $1)';
      params.push(`%${search.toLowerCase().trim()}%`);
    }

    sql += ' ORDER BY symbol ASC LIMIT 50';
    const result = await query(sql, params);
    return reply.send({ data: result.rows });
  });
}

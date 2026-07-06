import { FastifyInstance, FastifyRequest } from 'fastify';
import { AddWatchlistSchema } from '@pulsewatch/shared';
import { query } from '../db/pool.js';
import { authGuard } from '../lib/auth.js';

export async function watchlistRoutes(app: FastifyInstance) {
  // All watchlist routes require auth
  app.addHook('preHandler', authGuard);

  // ── List watchlist ───────────────────────────────────────
  app.get('/api/watchlist', async (request, reply) => {
    const userId = (request as any).user.userId;
    const result = await query(
      `SELECT w.id, w.user_id, w.asset_id, w.added_at,
              a.symbol, a.display_name, a.asset_type
       FROM watchlist_items w
       JOIN assets a ON a.id = w.asset_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [userId],
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      asset_id: row.asset_id,
      added_at: row.added_at,
      asset: {
        id: row.asset_id,
        symbol: row.symbol,
        display_name: row.display_name,
        asset_type: row.asset_type,
      },
    }));

    return reply.send({ data });
  });

  // ── Add to watchlist ─────────────────────────────────────
  app.post('/api/watchlist', async (request, reply) => {
    const userId = (request as any).user.userId;
    const parsed = AddWatchlistSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.issues.map((i: any) => i.message).join(', '),
      });
    }

    // Verify asset exists
    const asset = await query('SELECT id FROM assets WHERE id = $1 AND is_active = true', [
      parsed.data.asset_id,
    ]);
    if (asset.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Asset not found',
      });
    }

    try {
      const result = await query(
        `INSERT INTO watchlist_items (user_id, asset_id)
         VALUES ($1, $2)
         RETURNING id, user_id, asset_id, added_at`,
        [userId, parsed.data.asset_id],
      );
      return reply.status(201).send({ data: result.rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        // unique constraint violation
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Asset already in watchlist',
        });
      }
      throw err;
    }
  });

  // ── Remove from watchlist ────────────────────────────────
  app.delete('/api/watchlist/:id', async (request, reply) => {
    const userId = (request as any).user.userId;
    const { id } = request.params as { id: string };

    const result = await query(
      'DELETE FROM watchlist_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Watchlist item not found',
      });
    }

    return reply.status(204).send();
  });
}

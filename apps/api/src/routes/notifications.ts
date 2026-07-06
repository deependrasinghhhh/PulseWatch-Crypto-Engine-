import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { authGuard } from '../lib/auth.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  // ── List notifications ───────────────────────────────────
  app.get('/api/notifications', async (request, reply) => {
    const userId = (request as any).user.userId;
    const { unread_only } = request.query as { unread_only?: string };

    let sql = `SELECT * FROM notifications WHERE user_id = $1`;
    const params: unknown[] = [userId];

    if (unread_only === 'true') {
      sql += ' AND read_at IS NULL';
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';
    const result = await query(sql, params);
    return reply.send({ data: result.rows });
  });

  // ── Mark notification as read ────────────────────────────
  app.patch('/api/notifications/:id/read', async (request, reply) => {
    const userId = (request as any).user.userId;
    const { id } = request.params as { id: string };

    const result = await query(
      `UPDATE notifications SET read_at = now()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING *`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Notification not found or already read',
      });
    }

    return reply.send({ data: result.rows[0] });
  });

  // ── Mark all as read ─────────────────────────────────────
  app.patch('/api/notifications/read-all', async (request, reply) => {
    const userId = (request as any).user.userId;
    await query(
      'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL',
      [userId],
    );
    return reply.send({ success: true });
  });
}

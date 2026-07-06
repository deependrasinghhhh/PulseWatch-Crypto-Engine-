import { FastifyInstance } from 'fastify';
import { CreateAlertSchema, UpdateAlertSchema } from '@pulsewatch/shared';
import { query } from '../db/pool.js';
import { authGuard } from '../lib/auth.js';

export async function alertRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  // ── List alerts ──────────────────────────────────────────
  app.get('/api/alerts', async (request, reply) => {
    const userId = (request as any).user.userId;
    const result = await query(
      `SELECT al.*, a.symbol, a.display_name
       FROM alerts al
       JOIN assets a ON a.id = al.asset_id
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC`,
      [userId],
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      asset_id: row.asset_id,
      alert_type: row.alert_type,
      condition_config: row.condition_config,
      is_active: row.is_active,
      cooldown_minutes: row.cooldown_minutes,
      last_triggered_at: row.last_triggered_at,
      created_at: row.created_at,
      asset: {
        id: row.asset_id,
        symbol: row.symbol,
        display_name: row.display_name,
      },
    }));

    return reply.send({ data });
  });

  // ── Create alert ─────────────────────────────────────────
  app.post('/api/alerts', async (request, reply) => {
    const userId = (request as any).user.userId;
    const parsed = CreateAlertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.issues.map((i: any) => i.message).join(', '),
      });
    }

    const { asset_id, alert_type, condition_config, cooldown_minutes } = parsed.data;

    // Verify asset exists
    const asset = await query('SELECT id FROM assets WHERE id = $1', [asset_id]);
    if (asset.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Asset not found' });
    }

    const result = await query(
      `INSERT INTO alerts (user_id, asset_id, alert_type, condition_config, cooldown_minutes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, asset_id, alert_type, JSON.stringify(condition_config), cooldown_minutes],
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ── Update alert ─────────────────────────────────────────
  app.patch('/api/alerts/:id', async (request, reply) => {
    const userId = (request as any).user.userId;
    const { id } = request.params as { id: string };
    const parsed = UpdateAlertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.issues.map((i: any) => i.message).join(', '),
      });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (parsed.data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(parsed.data.is_active);
    }
    if (parsed.data.condition_config !== undefined) {
      updates.push(`condition_config = $${paramCount++}`);
      values.push(JSON.stringify(parsed.data.condition_config));
    }
    if (parsed.data.cooldown_minutes !== undefined) {
      updates.push(`cooldown_minutes = $${paramCount++}`);
      values.push(parsed.data.cooldown_minutes);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No fields to update' });
    }

    values.push(id, userId);
    const result = await query(
      `UPDATE alerts SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Alert not found' });
    }

    return reply.send({ data: result.rows[0] });
  });

  // ── Delete alert ─────────────────────────────────────────
  app.delete('/api/alerts/:id', async (request, reply) => {
    const userId = (request as any).user.userId;
    const { id } = request.params as { id: string };

    const result = await query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Alert not found' });
    }

    return reply.status(204).send();
  });

  // ── Alert trigger history ────────────────────────────────
  app.get('/api/alerts/:id/history', async (request, reply) => {
    const userId = (request as any).user.userId;
    const { id } = request.params as { id: string };

    // Verify ownership
    const alert = await query('SELECT id FROM alerts WHERE id = $1 AND user_id = $2', [id, userId]);
    if (alert.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Alert not found' });
    }

    const result = await query(
      `SELECT * FROM alert_triggers WHERE alert_id = $1 ORDER BY triggered_at DESC LIMIT 50`,
      [id],
    );

    return reply.send({ data: result.rows });
  });
}

import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { RegisterSchema, LoginSchema } from '@pulsewatch/shared';
import { query } from '../db/pool.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/auth.js';

export async function authRoutes(app: FastifyInstance) {
  // ── Register ─────────────────────────────────────────────
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.issues.map((i: any) => i.message).join(', '),
      });
    }
    const { email, password, full_name } = parsed.data;

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'An account with this email already exists',
      });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, created_at, updated_at`,
      [email, password_hash, full_name],
    );

    const user = result.rows[0];
    const payload = { userId: user.id, email: user.email };
    const access_token = signAccessToken(payload);
    const refresh_token = signRefreshToken(payload);

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      access_token,
      refresh_token,
    });
  });

  // ── Login ────────────────────────────────────────────────
  app.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parsed.error.issues.map((i: any) => i.message).join(', '),
      });
    }
    const { email, password } = parsed.data;

    const result = await query(
      'SELECT id, email, password_hash, full_name, created_at, updated_at FROM users WHERE email = $1',
      [email],
    );
    if (result.rows.length === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const payload = { userId: user.id, email: user.email };
    const access_token = signAccessToken(payload);
    const refresh_token = signRefreshToken(payload);

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      access_token,
      refresh_token,
    });
  });

  // ── Refresh Token ────────────────────────────────────────
  app.post('/api/auth/refresh', async (request, reply) => {
    const { refresh_token } = request.body as { refresh_token?: string };
    if (!refresh_token) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    try {
      const payload = verifyRefreshToken(refresh_token);
      // Verify user still exists
      const result = await query('SELECT id, email FROM users WHERE id = $1', [payload.userId]);
      if (result.rows.length === 0) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User no longer exists',
        });
      }
      const user = result.rows[0];
      const newPayload = { userId: user.id, email: user.email };
      const access_token = signAccessToken(newPayload);
      const new_refresh_token = signRefreshToken(newPayload);

      return reply.send({ access_token, refresh_token: new_refresh_token });
    } catch {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }
  });
}

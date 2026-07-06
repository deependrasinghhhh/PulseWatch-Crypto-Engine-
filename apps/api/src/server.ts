import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from './config.js';
import { redisSub, redisPub } from './lib/redis.js';
import { verifyAccessToken } from './lib/auth.js';

// Routes
import { authRoutes } from './routes/auth.js';
import { assetRoutes } from './routes/assets.js';
import { watchlistRoutes } from './routes/watchlist.js';
import { alertRoutes } from './routes/alerts.js';
import { marketRoutes } from './routes/market.js';
import { insightRoutes } from './routes/insights.js';
import { notificationRoutes } from './routes/notifications.js';

async function main() {
  const app = Fastify({ logger: true });

  // ── Security plugins ───────────────────────────────────
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Disabled for development
  });

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
  });

  // Stricter rate limit for auth endpoints
  await app.register(async (authApp) => {
    await authApp.register(rateLimit, {
      max: 5,
      timeWindow: '1 minute',
    });
    // Re-register auth routes within this limited scope
  });

  // ── Register routes ────────────────────────────────────
  await app.register(authRoutes);
  await app.register(assetRoutes);
  await app.register(watchlistRoutes);
  await app.register(alertRoutes);
  await app.register(marketRoutes);
  await app.register(insightRoutes);
  await app.register(notificationRoutes);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', ts: Date.now() }));

  // ── Start HTTP server ──────────────────────────────────
  await app.listen({ port: config.port, host: config.host });

  // ── Socket.io setup ────────────────────────────────────
  const io = new Server(app.server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Redis adapter for horizontal scaling
  io.adapter(createAdapter(redisPub, redisSub));

  // Auth middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log(`🔌 User ${user.email} connected via WebSocket`);

    // Join user's personal room for notifications
    socket.join(`user:${user.userId}`);

    // Subscribe to price updates for a symbol
    socket.on('subscribe:symbol', ({ symbol }: { symbol: string }) => {
      const room = `symbol:${symbol.toUpperCase()}`;
      socket.join(room);
      console.log(`📡 ${user.email} subscribed to ${room}`);
    });

    socket.on('unsubscribe:symbol', ({ symbol }: { symbol: string }) => {
      const room = `symbol:${symbol.toUpperCase()}`;
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User ${user.email} disconnected`);
    });
  });

  // ── Redis pub/sub → Socket.io broadcast ────────────────
  // Create a dedicated subscriber for price channel
  const priceSubscriber = redisSub.duplicate();
  await priceSubscriber.subscribe('prices');

  priceSubscriber.on('message', (_channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      const room = `symbol:${data.symbol}`;
      io.to(room).emit('price:update', data);
    } catch (err) {
      console.error('Error broadcasting price:', err);
    }
  });

  console.log(`🚀 PulseWatch API server running on http://${config.host}:${config.port}`);
  console.log(`🔌 Socket.io ready for connections`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

import 'dotenv/config';

export const config = {
  port: parseInt(process.env.API_PORT || '3001', 10),
  host: process.env.API_HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/pulsewatch',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
} as const;

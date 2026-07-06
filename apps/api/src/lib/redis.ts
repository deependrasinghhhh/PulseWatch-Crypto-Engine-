import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    if (times > 10) return null; // stop retrying after 10 attempts
    return Math.min(times * 200, 5000);
  },
});

// Separate subscriber connection (Redis requires separate connections for pub/sub)
export const redisSub = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Separate publisher connection
export const redisPub = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => console.error('Redis error:', err));
redisSub.on('error', (err) => console.error('Redis sub error:', err));
redisPub.on('error', (err) => console.error('Redis pub error:', err));

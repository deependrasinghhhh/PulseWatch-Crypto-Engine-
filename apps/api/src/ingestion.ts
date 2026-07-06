/**
 * Ingestion Service (Node process #1)
 * 
 * Connects to Binance WebSocket streams for all active symbols,
 * normalizes ticks, writes to Redis (self-expiring cache),
 * publishes to Redis pub/sub, and aggregates 1-minute candles.
 */
import 'dotenv/config';
import WebSocket from 'ws';
import { redis, redisPub } from './lib/redis.js';
import { query, pool } from './db/pool.js';
import { BINANCE_WS_BASE, REDIS_KEYS } from '@pulsewatch/shared';

interface TickBuffer {
  symbol: string;
  assetId: number;
  openTime: number; // minute boundary timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount: number;
}

// In-memory candle buffers per symbol
const candleBuffers = new Map<string, TickBuffer>();

// Track 24h prices for change calculation
const price24hCache = new Map<string, number>();

async function getActiveSymbols(): Promise<{ id: number; symbol: string }[]> {
  // Get all symbols that are either in someone's watchlist or in the assets table
  const result = await query(
    `SELECT DISTINCT a.id, a.symbol
     FROM assets a
     WHERE a.is_active = true
     ORDER BY a.symbol`,
  );
  return result.rows;
}

function getMinuteBoundary(ts: number): number {
  return Math.floor(ts / 60000) * 60000;
}

async function flushCandle(buffer: TickBuffer) {
  try {
    await query(
      `INSERT INTO price_candles (asset_id, timeframe, open_time, open_price, high, low, close, volume)
       VALUES ($1, '1m', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (asset_id, timeframe, open_time) DO UPDATE SET
         high = GREATEST(price_candles.high, EXCLUDED.high),
         low = LEAST(price_candles.low, EXCLUDED.low),
         close = EXCLUDED.close,
         volume = price_candles.volume + EXCLUDED.volume`,
      [
        buffer.assetId,
        new Date(buffer.openTime),
        buffer.open,
        buffer.high,
        buffer.low,
        buffer.close,
        buffer.volume,
      ],
    );
  } catch (err) {
    console.error(`Failed to flush candle for ${buffer.symbol}:`, err);
  }
}

async function rollUpCandles() {
  // Roll 1m candles into 5m, 1h, 1d
  const timeframes = [
    { tf: '5m', interval: '5 minutes', trunc: '5 minutes' },
    { tf: '1h', interval: '1 hour', trunc: '1 hour' },
    { tf: '1d', interval: '1 day', trunc: '1 day' },
  ];

  for (const { tf, trunc } of timeframes) {
    try {
      await query(`
        INSERT INTO price_candles (asset_id, timeframe, open_time, open_price, high, low, close, volume)
        SELECT
          asset_id,
          '${tf}',
          date_trunc('${trunc === '5 minutes' ? 'hour' : trunc.split(' ')[1]}', open_time) ${trunc === '5 minutes' ? `+ (EXTRACT(minute FROM open_time)::int / 5 * 5) * interval '1 minute'` : ''},
          (array_agg(open_price ORDER BY open_time ASC))[1],
          MAX(high),
          MIN(low),
          (array_agg(close ORDER BY open_time DESC))[1],
          SUM(volume)
        FROM price_candles
        WHERE timeframe = '1m'
          AND open_time >= now() - interval '2 ${trunc.split(' ')[1]}s'
        GROUP BY asset_id, 2, 3
        ON CONFLICT (asset_id, timeframe, open_time) DO UPDATE SET
          high = GREATEST(price_candles.high, EXCLUDED.high),
          low = LEAST(price_candles.low, EXCLUDED.low),
          close = EXCLUDED.close,
          volume = EXCLUDED.volume
      `);
    } catch (err) {
      console.error(`Roll-up ${tf} failed:`, err);
    }
  }
}

async function startIngestion() {
  console.log('🚀 Starting Ingestion Service...');

  const symbols = await getActiveSymbols();
  if (symbols.length === 0) {
    console.log('⚠️  No active symbols found. Run db:seed first.');
    return;
  }

  // Build symbol → assetId map
  const symbolToAssetId = new Map(symbols.map((s) => [s.symbol.toLowerCase(), s.id]));

  // Build combined stream URL
  // Binance combined streams: /stream?streams=btcusdt@trade/ethusdt@trade/...
  const streams = symbols.map((s) => `${s.symbol.toLowerCase()}@trade`).join('/');
  const wsUrl = `${BINANCE_WS_BASE}/stream?streams=${streams}`;

  console.log(`📡 Connecting to Binance for ${symbols.length} symbols...`);

  function connect() {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('✅ Connected to Binance WebSocket');
    });

    ws.on('message', async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        const trade = msg.data;
        if (!trade) return;

        const symbol = trade.s; // e.g. 'BTCUSDT'
        const price = parseFloat(trade.p);
        const qty = parseFloat(trade.q);
        const ts = trade.T || Date.now();

        const assetId = symbolToAssetId.get(symbol.toLowerCase());
        if (!assetId) return;

        // Calculate 24h change (rough — from first price we saw 24h ago)
        if (!price24hCache.has(symbol)) {
          price24hCache.set(symbol, price);
        }
        const price24hAgo = price24hCache.get(symbol)!;
        const change24h = ((price - price24hAgo) / price24hAgo) * 100;

        // 1. Write to Redis with 60s TTL
        const priceData = {
          symbol,
          price,
          change24h: parseFloat(change24h.toFixed(4)),
          volume: qty,
          ts,
        };
        await redis.set(
          REDIS_KEYS.price(symbol),
          JSON.stringify(priceData),
          'EX',
          60,
        );

        // 2. Publish to pub/sub channel
        await redisPub.publish(REDIS_KEYS.priceChannel, JSON.stringify(priceData));

        // 3. Buffer into 1-minute candle
        const minuteTs = getMinuteBoundary(ts);
        const bufferKey = `${symbol}:${minuteTs}`;
        const existing = candleBuffers.get(bufferKey);

        if (existing) {
          existing.high = Math.max(existing.high, price);
          existing.low = Math.min(existing.low, price);
          existing.close = price;
          existing.volume += qty;
          existing.tickCount++;
        } else {
          // Flush previous buffer for this symbol if exists
          for (const [key, buf] of candleBuffers) {
            if (key.startsWith(`${symbol}:`) && key !== bufferKey) {
              await flushCandle(buf);
              candleBuffers.delete(key);
            }
          }

          candleBuffers.set(bufferKey, {
            symbol,
            assetId,
            openTime: minuteTs,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: qty,
            tickCount: 1,
          });
        }
      } catch (err) {
        // Silently ignore parse errors on individual ticks
      }
    });

    ws.on('close', () => {
      console.log('⚠️  Binance WebSocket disconnected. Reconnecting in 5s...');
      setTimeout(connect, 5000);
    });

    ws.on('error', (err) => {
      console.error('Binance WebSocket error:', err.message);
      ws.close();
    });
  }

  connect();

  // Periodic flush: force-flush all candle buffers every 60s
  setInterval(async () => {
    for (const [key, buf] of candleBuffers) {
      const now = Date.now();
      const minuteEnd = buf.openTime + 60000;
      if (now >= minuteEnd) {
        await flushCandle(buf);
        candleBuffers.delete(key);
      }
    }
  }, 10_000);

  // Roll-up candles every 5 minutes
  setInterval(rollUpCandles, 5 * 60 * 1000);

  // Update 24h price reference every hour
  setInterval(() => {
    price24hCache.clear();
    console.log('🔄 Cleared 24h price cache');
  }, 3600_000);

  console.log('📊 Ingestion service running.');
}

startIngestion().catch((err) => {
  console.error('❌ Ingestion failed to start:', err);
  process.exit(1);
});

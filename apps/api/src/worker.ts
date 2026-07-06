/**
 * Alert Evaluation Worker (Node process #3)
 *
 * Runs every 10 seconds via BullMQ repeatable job.
 * Evaluates all active alerts against latest prices from Redis.
 * Fires notifications when conditions are met, respecting cooldown.
 */
import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { redis } from './lib/redis.js';
import { query } from './db/pool.js';
import { REDIS_KEYS, ALERT_EVAL_INTERVAL_MS } from '@pulsewatch/shared';
import { RSI, SMA } from 'technicalindicators';
import IORedis from 'ioredis';
import { config } from './config.js';

const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ── Queue setup ──────────────────────────────────────────────
const alertQueue = new Queue('alert-evaluation', { connection: connection as any });
const notificationQueue = new Queue('notifications', { connection: connection as any });

// ── Alert evaluation logic ───────────────────────────────────

async function evaluateAlert(alert: any, latestPrice: any): Promise<boolean> {
  const cfg = alert.condition_config;
  const price = latestPrice.price;

  switch (alert.alert_type) {
    case 'price_above':
      return price > cfg.threshold;

    case 'price_below':
      return price < cfg.threshold;

    case 'pct_change':
      return Math.abs(latestPrice.change24h) > Math.abs(cfg.threshold);

    case 'volume_spike': {
      // Compare current volume to 7-day average
      const avgResult = await query(
        `SELECT AVG(volume) as avg_vol
         FROM price_candles
         WHERE asset_id = $1 AND timeframe = '1h'
         AND open_time > now() - interval '7 days'`,
        [alert.asset_id],
      );
      const avgVol = parseFloat(avgResult.rows[0]?.avg_vol || '0');
      if (avgVol === 0) return false;
      const multiplier = cfg.multiplier || 2;
      return latestPrice.volume > avgVol * multiplier;
    }

    case 'rsi_cross': {
      const candles = await query(
        `SELECT close FROM price_candles
         WHERE asset_id = $1 AND timeframe = '1h'
         ORDER BY open_time DESC LIMIT 100`,
        [alert.asset_id],
      );
      if (candles.rows.length < (cfg.period || 14) + 1) return false;

      const closes = candles.rows.reverse().map((r: any) => parseFloat(r.close));
      const rsiValues = RSI.calculate({ values: closes, period: cfg.period || 14 });
      const currentRsi = rsiValues[rsiValues.length - 1];
      if (currentRsi === undefined) return false;

      if (cfg.direction === 'above') {
        return currentRsi > cfg.level;
      } else {
        return currentRsi < cfg.level;
      }
    }

    case 'ma_cross': {
      const candles = await query(
        `SELECT close FROM price_candles
         WHERE asset_id = $1 AND timeframe = '1h'
         ORDER BY open_time DESC LIMIT 200`,
        [alert.asset_id],
      );
      const fastPeriod = cfg.fast_period || 20;
      const slowPeriod = cfg.slow_period || 50;
      if (candles.rows.length < slowPeriod + 2) return false;

      const closes = candles.rows.reverse().map((r: any) => parseFloat(r.close));
      const fastSMA = SMA.calculate({ values: closes, period: fastPeriod });
      const slowSMA = SMA.calculate({ values: closes, period: slowPeriod });

      // Align arrays — fast has more values
      const offset = fastSMA.length - slowSMA.length;
      const currFast = fastSMA[fastSMA.length - 1];
      const prevFast = fastSMA[fastSMA.length - 2];
      const currSlow = slowSMA[slowSMA.length - 1];
      const prevSlow = slowSMA[slowSMA.length - 2];

      if (currFast === undefined || currSlow === undefined || prevFast === undefined || prevSlow === undefined) {
        return false;
      }

      if (cfg.direction === 'golden') {
        // Fast crosses above slow
        return prevFast <= prevSlow && currFast > currSlow;
      } else {
        // Fast crosses below slow (death cross)
        return prevFast >= prevSlow && currFast < currSlow;
      }
    }

    default:
      return false;
  }
}

// ── Alert evaluation worker ──────────────────────────────────

const alertWorker = new Worker(
  'alert-evaluation',
  async () => {
    try {
      // Fetch all active alerts with their symbol
      const alertsResult = await query(
        `SELECT al.*, a.symbol
         FROM alerts al
         JOIN assets a ON a.id = al.asset_id
         WHERE al.is_active = true`,
      );

      for (const alert of alertsResult.rows) {
        try {
          // Get latest price from Redis
          const cached = await redis.get(REDIS_KEYS.price(alert.symbol));
          if (!cached) continue;

          const latestPrice = JSON.parse(cached);

          // Check cooldown
          if (alert.last_triggered_at) {
            const lastTriggered = new Date(alert.last_triggered_at).getTime();
            const cooldownMs = (alert.cooldown_minutes || 30) * 60 * 1000;
            if (Date.now() - lastTriggered < cooldownMs) continue;
          }

          const triggered = await evaluateAlert(alert, latestPrice);

          if (triggered) {
            console.log(`🔔 Alert triggered: ${alert.alert_type} for ${alert.symbol} (alert ${alert.id})`);

            // Insert trigger record
            await query(
              `INSERT INTO alert_triggers (alert_id, trigger_price, context)
               VALUES ($1, $2, $3)`,
              [
                alert.id,
                latestPrice.price,
                JSON.stringify({
                  price: latestPrice.price,
                  change24h: latestPrice.change24h,
                  volume: latestPrice.volume,
                  alert_type: alert.alert_type,
                  condition: alert.condition_config,
                }),
              ],
            );

            // Update last_triggered_at
            await query(
              'UPDATE alerts SET last_triggered_at = now() WHERE id = $1',
              [alert.id],
            );

            // Enqueue notification
            await notificationQueue.add('send-notification', {
              userId: alert.user_id,
              alertId: alert.id,
              symbol: alert.symbol,
              alertType: alert.alert_type,
              price: latestPrice.price,
              conditionConfig: alert.condition_config,
            });
          }
        } catch (err) {
          console.error(`Error evaluating alert ${alert.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Alert evaluation cycle failed:', err);
    }
  },
  { connection: connection as any },
);

// ── Notification worker ──────────────────────────────────────

function formatAlertMessage(data: any): { title: string; body: string } {
  const { symbol, alertType, price, conditionConfig } = data;

  switch (alertType) {
    case 'price_above':
      return {
        title: `📈 ${symbol} Price Alert`,
        body: `${symbol} has risen above $${conditionConfig.threshold}. Current: $${price}`,
      };
    case 'price_below':
      return {
        title: `📉 ${symbol} Price Alert`,
        body: `${symbol} has fallen below $${conditionConfig.threshold}. Current: $${price}`,
      };
    case 'pct_change':
      return {
        title: `📊 ${symbol} % Change Alert`,
        body: `${symbol} has moved more than ${conditionConfig.threshold}% in 24h. Price: $${price}`,
      };
    case 'volume_spike':
      return {
        title: `🔊 ${symbol} Volume Spike`,
        body: `${symbol} volume exceeds ${conditionConfig.multiplier}x the 7-day average. Price: $${price}`,
      };
    case 'rsi_cross':
      return {
        title: `📐 ${symbol} RSI Alert`,
        body: `${symbol} RSI(${conditionConfig.period}) crossed ${conditionConfig.direction} ${conditionConfig.level}. Price: $${price}`,
      };
    case 'ma_cross':
      return {
        title: `✂️ ${symbol} MA Crossover`,
        body: `${symbol} SMA(${conditionConfig.fast_period}) ${conditionConfig.direction === 'golden' ? 'crossed above' : 'crossed below'} SMA(${conditionConfig.slow_period}). Price: $${price}`,
      };
    default:
      return {
        title: `🔔 ${symbol} Alert`,
        body: `Alert triggered for ${symbol} at $${price}`,
      };
  }
}

const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const data = job.data;
    const { title, body } = formatAlertMessage(data);

    // Store in-app notification
    const triggerResult = await query(
      `SELECT id FROM alert_triggers WHERE alert_id = $1 ORDER BY triggered_at DESC LIMIT 1`,
      [data.alertId],
    );

    const triggerId = triggerResult.rows[0]?.id;

    await query(
      `INSERT INTO notifications (user_id, alert_trigger_id, channel, title, body)
       VALUES ($1, $2, 'in_app', $3, $4)`,
      [data.userId, triggerId, title, body],
    );

    // Mark trigger as notified
    if (triggerId) {
      await query(
        'UPDATE alert_triggers SET notified = true WHERE id = $1',
        [triggerId],
      );
    }

    // Publish WebSocket event (will be picked up by the API server via Redis pub/sub)
    await redis.publish(`alert:user:${data.userId}`, JSON.stringify({
      type: 'alert:triggered',
      alert_id: data.alertId,
      symbol: data.symbol,
      message: body,
      trigger_price: data.price,
      triggered_at: new Date().toISOString(),
    }));

    console.log(`📬 Notification sent to user ${data.userId}: ${title}`);
  },
  { connection: connection as any },
);

// ── Schedule repeating alert evaluation job ──────────────────

async function start() {
  console.log('🚀 Starting Alert Worker...');

  // Clean old repeatable jobs
  const repeatableJobs = await alertQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await alertQueue.removeRepeatableByKey(job.key);
  }

  // Add repeating job every 10 seconds
  await alertQueue.add(
    'evaluate-alerts',
    {},
    {
      repeat: {
        every: ALERT_EVAL_INTERVAL_MS,
      },
    },
  );

  console.log(`⏱️  Alert evaluation scheduled every ${ALERT_EVAL_INTERVAL_MS / 1000}s`);
  console.log('📬 Notification worker ready');
}

alertWorker.on('failed', (job, err) => {
  console.error(`Alert evaluation job failed:`, err.message);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`Notification job failed:`, err?.message);
});

start().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});

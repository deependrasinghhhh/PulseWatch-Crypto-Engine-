import { pool } from './pool.js';

const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  asset_type VARCHAR(10) NOT NULL CHECK (asset_type IN ('crypto','stock')),
  is_active BOOLEAN DEFAULT true
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id INT NOT NULL REFERENCES assets(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, asset_id)
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id INT NOT NULL REFERENCES assets(id),
  alert_type VARCHAR(30) NOT NULL CHECK (
    alert_type IN ('price_above','price_below','pct_change','volume_spike','rsi_cross','ma_cross')
  ),
  condition_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  cooldown_minutes INT DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alert trigger history
CREATE TABLE IF NOT EXISTS alert_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  trigger_price NUMERIC(20,8),
  context JSONB,
  notified BOOLEAN DEFAULT false
);

-- Price candles (OHLCV)
CREATE TABLE IF NOT EXISTS price_candles (
  id BIGSERIAL PRIMARY KEY,
  asset_id INT NOT NULL REFERENCES assets(id),
  timeframe VARCHAR(5) NOT NULL,
  open_time TIMESTAMPTZ NOT NULL,
  open_price NUMERIC(20,8),
  high NUMERIC(20,8),
  low NUMERIC(20,8),
  close NUMERIC(20,8),
  volume NUMERIC(20,8),
  UNIQUE(asset_id, timeframe, open_time)
);
CREATE INDEX IF NOT EXISTS idx_candles_lookup ON price_candles(asset_id, timeframe, open_time DESC);

-- AI Insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id INT NOT NULL REFERENCES assets(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  signal VARCHAR(10) CHECK (signal IN ('bullish','bearish','neutral')),
  summary TEXT NOT NULL,
  indicators_snapshot JSONB
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_trigger_id UUID REFERENCES alert_triggers(id),
  channel VARCHAR(10) CHECK (channel IN ('in_app','email')),
  title VARCHAR(255),
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

async function migrate() {
  console.log('🔄 Running database migrations...');
  try {
    await pool.query(MIGRATION_SQL);
    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

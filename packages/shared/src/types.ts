// ── Database entity types ────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: number;
  symbol: string;
  display_name: string;
  asset_type: 'crypto' | 'stock';
  is_active: boolean;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  asset_id: number;
  added_at: string;
  asset?: Asset;
}

export interface Alert {
  id: string;
  user_id: string;
  asset_id: number;
  alert_type: string;
  condition_config: Record<string, unknown>;
  is_active: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
  asset?: Asset;
}

export interface AlertTrigger {
  id: string;
  alert_id: string;
  triggered_at: string;
  trigger_price: string | null;
  context: Record<string, unknown> | null;
  notified: boolean;
}

export interface PriceCandle {
  id: number;
  asset_id: number;
  timeframe: string;
  open_time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface AIInsight {
  id: string;
  asset_id: number;
  generated_at: string;
  expires_at: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  indicators_snapshot: Record<string, unknown> | null;
}

export interface Notification {
  id: string;
  user_id: string;
  alert_trigger_id: string | null;
  channel: 'in_app' | 'email';
  title: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

// ── WebSocket event types ────────────────────────────────────

export interface PriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  ts: number;
}

export interface AlertTriggeredEvent {
  alert_id: string;
  symbol: string;
  message: string;
  trigger_price: number;
  triggered_at: string;
}

// ── API response types ───────────────────────────────────────

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  access_token: string;
  refresh_token: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

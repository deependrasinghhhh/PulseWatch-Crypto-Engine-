import { z } from 'zod';

// ── Auth Schemas ─────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Name is required').max(255),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Asset Schemas ────────────────────────────────────────────

export const AssetTypeEnum = z.enum(['crypto', 'stock']);

export const AssetSearchSchema = z.object({
  search: z.string().optional(),
});

// ── Watchlist Schemas ────────────────────────────────────────

export const AddWatchlistSchema = z.object({
  asset_id: z.number().int().positive(),
});

// ── Alert Schemas ────────────────────────────────────────────

export const AlertTypeEnum = z.enum([
  'price_above',
  'price_below',
  'pct_change',
  'volume_spike',
  'rsi_cross',
  'ma_cross',
]);

export const PriceConditionConfig = z.object({
  threshold: z.number().positive(),
});

export const PctChangeConditionConfig = z.object({
  threshold: z.number(), // can be negative for drops
});

export const VolumeConditionConfig = z.object({
  multiplier: z.number().positive().default(2),
});

export const RsiConditionConfig = z.object({
  period: z.number().int().min(2).max(100).default(14),
  level: z.number().min(0).max(100),
  direction: z.enum(['above', 'below']),
});

export const MaCrossConditionConfig = z.object({
  fast_period: z.number().int().min(1).default(20),
  slow_period: z.number().int().min(1).default(50),
  direction: z.enum(['golden', 'death']), // golden = fast crosses above slow
});

export const CreateAlertSchema = z.object({
  asset_id: z.number().int().positive(),
  alert_type: AlertTypeEnum,
  condition_config: z.record(z.unknown()),
  cooldown_minutes: z.number().int().min(1).max(1440).default(30),
});

export const UpdateAlertSchema = z.object({
  is_active: z.boolean().optional(),
  condition_config: z.record(z.unknown()).optional(),
  cooldown_minutes: z.number().int().min(1).max(1440).optional(),
});

// ── AI Insight Schemas ───────────────────────────────────────

export const AIInsightResponseSchema = z.object({
  signal: z.enum(['bullish', 'bearish', 'neutral']),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string().min(10),
  key_level_to_watch: z.string().min(5),
  risk_note: z.string().min(5),
});

// ── Market Data Schemas ──────────────────────────────────────

export const CandleQuerySchema = z.object({
  timeframe: z.enum(['1m', '5m', '1h', '1d']).default('1h'),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

// ── Type exports ─────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type AssetType = z.infer<typeof AssetTypeEnum>;
export type AlertType = z.infer<typeof AlertTypeEnum>;
export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
export type UpdateAlertInput = z.infer<typeof UpdateAlertSchema>;
export type AIInsightResponse = z.infer<typeof AIInsightResponseSchema>;
export type CandleQuery = z.infer<typeof CandleQuerySchema>;

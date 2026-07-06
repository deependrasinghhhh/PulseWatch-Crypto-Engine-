// Default crypto assets to seed the database
export const DEFAULT_CRYPTO_ASSETS = [
  { symbol: 'BTCUSDT', display_name: 'Bitcoin' },
  { symbol: 'ETHUSDT', display_name: 'Ethereum' },
  { symbol: 'BNBUSDT', display_name: 'BNB' },
  { symbol: 'SOLUSDT', display_name: 'Solana' },
  { symbol: 'XRPUSDT', display_name: 'XRP' },
  { symbol: 'ADAUSDT', display_name: 'Cardano' },
  { symbol: 'DOGEUSDT', display_name: 'Dogecoin' },
  { symbol: 'AVAXUSDT', display_name: 'Avalanche' },
  { symbol: 'DOTUSDT', display_name: 'Polkadot' },
  { symbol: 'MATICUSDT', display_name: 'Polygon' },
  { symbol: 'LINKUSDT', display_name: 'Chainlink' },
  { symbol: 'UNIUSDT', display_name: 'Uniswap' },
  { symbol: 'LTCUSDT', display_name: 'Litecoin' },
  { symbol: 'ATOMUSDT', display_name: 'Cosmos' },
  { symbol: 'NEARUSDT', display_name: 'NEAR Protocol' },
  { symbol: 'AAVEUSDT', display_name: 'Aave' },
  { symbol: 'APTUSDT', display_name: 'Aptos' },
  { symbol: 'ARBUSDT', display_name: 'Arbitrum' },
  { symbol: 'OPUSDT', display_name: 'Optimism' },
  { symbol: 'SUIUSDT', display_name: 'Sui' },
] as const;

// Binance WebSocket base URL
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443';

// Redis key patterns
export const REDIS_KEYS = {
  price: (symbol: string) => `price:${symbol}`,
  priceChannel: 'prices',
  alertLock: (alertId: string) => `alert:lock:${alertId}`,
} as const;

// Alert cooldown / evaluation constants
export const ALERT_EVAL_INTERVAL_MS = 10_000; // 10 seconds
export const DEFAULT_COOLDOWN_MINUTES = 30;
export const AI_INSIGHT_TTL_MINUTES = 15;

// Price update batching for frontend
export const PRICE_UPDATE_BATCH_MS = 500;

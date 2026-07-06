import { pool } from './pool.js';
import { DEFAULT_CRYPTO_ASSETS } from '@pulsewatch/shared';

async function seed() {
  console.log('🌱 Seeding database...');
  try {
    for (const asset of DEFAULT_CRYPTO_ASSETS) {
      await pool.query(
        `INSERT INTO assets (symbol, display_name, asset_type, is_active)
         VALUES ($1, $2, 'crypto', true)
         ON CONFLICT (symbol) DO NOTHING`,
        [asset.symbol, asset.display_name],
      );
    }
    console.log(`✅ Seeded ${DEFAULT_CRYPTO_ASSETS.length} crypto assets.`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();

import { FastifyInstance } from 'fastify';
import { query } from '../db/pool.js';
import { redis } from '../lib/redis.js';
import { config } from '../config.js';
import { AIInsightResponseSchema, AI_INSIGHT_TTL_MINUTES, REDIS_KEYS } from '@pulsewatch/shared';
import { RSI, MACD, SMA } from 'technicalindicators';

export async function insightRoutes(app: FastifyInstance) {
  // ── Get or generate AI insight ───────────────────────────
  app.get('/api/insights/:symbol', async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const upperSymbol = symbol.toUpperCase();

    // Look up asset
    const assetResult = await query('SELECT id FROM assets WHERE symbol = $1', [upperSymbol]);
    if (assetResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Asset not found' });
    }
    const assetId = assetResult.rows[0].id;

    // Check for a non-expired cached insight
    const cached = await query(
      `SELECT * FROM ai_insights
       WHERE asset_id = $1 AND expires_at > now()
       ORDER BY generated_at DESC LIMIT 1`,
      [assetId],
    );

    if (cached.rows.length > 0) {
      return reply.send({
        data: cached.rows[0],
        cached: true,
        disclaimer: 'This is AI-generated analysis and is NOT financial advice. Always do your own research.',
      });
    }

    // Build indicator data from candles
    const candleResult = await query(
      `SELECT close, volume
       FROM price_candles
       WHERE asset_id = $1 AND timeframe = '1h'
       ORDER BY open_time DESC
       LIMIT 100`,
      [assetId],
    );

    if (candleResult.rows.length < 26) {
      return reply.status(503).send({
        error: 'Insufficient Data',
        message: 'Not enough historical data to generate insight. Please wait for candle data to accumulate.',
      });
    }

    const closes = candleResult.rows.reverse().map((r) => parseFloat(r.close));
    const volumes = candleResult.rows.map((r) => parseFloat(r.volume));

    // Calculate indicators
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const currentRsi = rsiValues[rsiValues.length - 1];

    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const currentMacd = macdResult[macdResult.length - 1];

    const sma20Values = SMA.calculate({ values: closes, period: 20 });
    const sma50Values = SMA.calculate({ values: closes, period: 50 });

    const currentPrice = closes[closes.length - 1];
    const price24hAgo = closes.length >= 24 ? closes[closes.length - 24] : closes[0];
    const change24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;

    const avgVolume = volumes.slice(-168).reduce((s, v) => s + v, 0) / Math.min(168, volumes.length);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

    // Check for API key
    if (!config.anthropic.apiKey) {
      // Return a computed insight without AI
      const signal =
        currentRsi > 70 ? 'bearish' : currentRsi < 30 ? 'bullish' : 'neutral';
      return reply.send({
        data: {
          asset_id: assetId,
          signal,
          summary: `${upperSymbol} is trading at $${currentPrice.toFixed(2)} with RSI at ${currentRsi?.toFixed(1)}. ANTHROPIC_API_KEY not configured — this is a computed fallback.`,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + AI_INSIGHT_TTL_MINUTES * 60000).toISOString(),
          indicators_snapshot: {
            price: currentPrice,
            rsi: currentRsi,
            macd_line: currentMacd?.MACD,
            macd_signal: currentMacd?.signal,
            sma20: sma20Values[sma20Values.length - 1],
            sma50: sma50Values[sma50Values.length - 1],
            volume_ratio: volumeRatio,
          },
        },
        cached: false,
        disclaimer: 'This is AI-generated analysis and is NOT financial advice. Always do your own research.',
      });
    }

    // Call Claude API
    const prompt = `Asset: ${upperSymbol}
Current Price: ${currentPrice}
24h Change: ${change24h.toFixed(2)}%
RSI(14): ${currentRsi?.toFixed(2)}
MACD: ${currentMacd?.MACD?.toFixed(4)} / Signal: ${currentMacd?.signal?.toFixed(4)} / Histogram: ${currentMacd?.histogram?.toFixed(4)}
SMA(20): ${sma20Values[sma20Values.length - 1]?.toFixed(2)}, SMA(50): ${sma50Values[sma50Values.length - 1]?.toFixed(2)}
Volume vs 7d avg: ${volumeRatio.toFixed(2)}x

Return exactly this JSON shape:
{
  "signal": "bullish" | "bearish" | "neutral",
  "confidence": "low" | "medium" | "high",
  "summary": "2-3 sentence plain-English read",
  "key_level_to_watch": "a specific price level and why",
  "risk_note": "one sentence on what would invalidate this read"
}`;

    let aiResponse: any = null;
    let retries = 0;

    while (retries < 2) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.anthropic.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            system: `You are a market analyst assistant embedded in a trading dashboard. You are given quantitative indicator data for one asset. Translate the numbers into a clear, honest, plain-English read of current momentum and risk. Do not tell the user to buy or sell. Return valid JSON only, no markdown, no preamble.`,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json() as any;
        const content = data.content?.[0]?.text;
        if (!content) throw new Error('Empty response from Claude');

        const parsed = JSON.parse(content);
        const validated = AIInsightResponseSchema.safeParse(parsed);

        if (!validated.success) {
          retries++;
          continue;
        }

        aiResponse = validated.data;
        break;
      } catch (err) {
        retries++;
        if (retries >= 2) {
          console.error('AI insight generation failed after retries:', err);
        }
      }
    }

    if (!aiResponse) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'AI insight generation is temporarily unavailable. Please try again later.',
      });
    }

    // Store in database
    const expiresAt = new Date(Date.now() + AI_INSIGHT_TTL_MINUTES * 60000);
    const insertResult = await query(
      `INSERT INTO ai_insights (asset_id, expires_at, signal, summary, indicators_snapshot)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        assetId,
        expiresAt,
        aiResponse.signal,
        aiResponse.summary,
        JSON.stringify({
          ...aiResponse,
          price: currentPrice,
          rsi: currentRsi,
          macd_line: currentMacd?.MACD,
          macd_signal: currentMacd?.signal,
          sma20: sma20Values[sma20Values.length - 1],
          sma50: sma50Values[sma50Values.length - 1],
          volume_ratio: volumeRatio,
        }),
      ],
    );

    return reply.send({
      data: insertResult.rows[0],
      cached: false,
      disclaimer: 'This is AI-generated analysis and is NOT financial advice. Always do your own research.',
    });
  });
}

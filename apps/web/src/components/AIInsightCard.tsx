import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, Shield } from 'lucide-react';

interface Props {
  symbol: string;
}

export default function AIInsightCard({ symbol }: Props) {
  const [insight, setInsight] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState('');

  const fetchInsight = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.insights.get(symbol);
      setInsight(res.data);
      setDisclaimer(res.disclaimer);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsight();
  }, [symbol]);

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'bullish': return <TrendingUp className="w-5 h-5 text-profit" />;
      case 'bearish': return <TrendingDown className="w-5 h-5 text-loss" />;
      default: return <Minus className="w-5 h-5 text-warning" />;
    }
  };

  const getSignalBadge = (signal: string) => {
    switch (signal) {
      case 'bullish': return 'badge-bullish';
      case 'bearish': return 'badge-bearish';
      default: return 'badge-neutral';
    }
  };

  if (loading) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-5 h-5 text-brand-400 animate-pulse" />
          <h3 className="font-semibold text-surface-200">AI Insight</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-surface-700/50 rounded-full shimmer w-3/4" />
          <div className="h-4 bg-surface-700/50 rounded-full shimmer w-full" />
          <div className="h-4 bg-surface-700/50 rounded-full shimmer w-2/3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-5 h-5 text-surface-500" />
          <h3 className="font-semibold text-surface-200">AI Insight</h3>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-loss/5 border border-loss/10">
          <AlertTriangle className="w-5 h-5 text-loss-light flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-loss-light font-medium">Unable to generate insight</p>
            <p className="text-xs text-surface-400 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchInsight}
          className="btn-secondary mt-4 flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!insight) return null;

  const snap = insight.indicators_snapshot || {};

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-brand-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-200">AI Insight</h3>
            <p className="text-xs text-surface-500">
              {insight.generated_at
                ? new Date(insight.generated_at).toLocaleTimeString()
                : 'Just now'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getSignalIcon(insight.signal)}
          <span className={getSignalBadge(insight.signal)}>
            {insight.signal?.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-surface-200 leading-relaxed mb-4">
        {insight.summary}
      </p>

      {/* Indicator Snapshots */}
      {snap && Object.keys(snap).length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {snap.rsi !== undefined && (
            <div className="p-2.5 rounded-lg bg-surface-900/50 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1">RSI(14)</div>
              <div className={`font-mono font-semibold text-sm ${
                snap.rsi > 70 ? 'text-loss-light' : snap.rsi < 30 ? 'text-profit-light' : 'text-surface-200'
              }`}>
                {typeof snap.rsi === 'number' ? snap.rsi.toFixed(1) : snap.rsi}
              </div>
            </div>
          )}
          {snap.sma20 !== undefined && (
            <div className="p-2.5 rounded-lg bg-surface-900/50 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1">SMA(20)</div>
              <div className="font-mono font-semibold text-sm text-surface-200">
                {typeof snap.sma20 === 'number' ? snap.sma20.toFixed(2) : snap.sma20}
              </div>
            </div>
          )}
          {snap.volume_ratio !== undefined && (
            <div className="p-2.5 rounded-lg bg-surface-900/50 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1">Vol Ratio</div>
              <div className={`font-mono font-semibold text-sm ${
                snap.volume_ratio > 1.5 ? 'text-warning-light' : 'text-surface-200'
              }`}>
                {typeof snap.volume_ratio === 'number' ? `${snap.volume_ratio.toFixed(2)}x` : snap.volume_ratio}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key level and risk */}
      {snap.key_level_to_watch && (
        <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/10 mb-3">
          <div className="text-xs font-medium text-brand-300 mb-1">📍 Key Level</div>
          <p className="text-xs text-surface-300">{snap.key_level_to_watch}</p>
        </div>
      )}

      {snap.risk_note && (
        <div className="p-3 rounded-lg bg-warning/5 border border-warning/10 mb-4">
          <div className="text-xs font-medium text-warning-light mb-1">⚠️ Risk</div>
          <p className="text-xs text-surface-300">{snap.risk_note}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 pt-3 border-t border-white/5">
        <Shield className="w-3.5 h-3.5 text-surface-600 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-surface-600 leading-relaxed">
          {disclaimer || 'This is AI-generated analysis and is NOT financial advice. Always do your own research.'}
        </p>
      </div>

      <button
        onClick={fetchInsight}
        className="mt-3 text-xs text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Refresh insight
      </button>
    </div>
  );
}

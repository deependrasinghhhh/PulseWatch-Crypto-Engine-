import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PriceChart from '../components/PriceChart';
import AIInsightCard from '../components/AIInsightCard';
import AlertModal from '../components/AlertModal';
import { useLivePriceStore } from '../store/useLivePriceStore';
import { usePriceStream } from '../hooks/usePriceStream';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Bell,
  Clock,
  BarChart3,
} from 'lucide-react';

const TIMEFRAMES = ['1m', '5m', '1h', '1d'] as const;

export default function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [showAlertModal, setShowAlertModal] = useState(false);

  const upperSymbol = symbol?.toUpperCase() || '';
  usePriceStream([upperSymbol]);
  const priceData = useLivePriceStore((s) => s.prices[upperSymbol]);

  // Fetch candle data
  const { data: candleData, isLoading: candleLoading } = useQuery({
    queryKey: ['candles', upperSymbol, timeframe],
    queryFn: () => api.market.candles(upperSymbol, timeframe, 200),
    enabled: !!upperSymbol,
    refetchInterval: timeframe === '1m' ? 30000 : 60000,
  });

  // Fetch asset info
  const { data: assetsData } = useQuery({
    queryKey: ['assets', upperSymbol],
    queryFn: () => api.assets.search(upperSymbol.replace('USDT', '')),
    enabled: !!upperSymbol,
  });

  const asset = assetsData?.data?.find((a: any) => a.symbol === upperSymbol);
  const candles = candleData?.data || [];
  const price = priceData?.price;
  const change = priceData?.change24h || 0;
  const isUp = change >= 0;

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/')}
            className="btn-ghost flex items-center gap-1.5 text-sm mb-3 -ml-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/20 flex items-center justify-center">
              <span className="text-lg font-bold text-brand-300">
                {upperSymbol.replace('USDT', '').slice(0, 3)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-100">
                {asset?.display_name || upperSymbol}
              </h1>
              <p className="text-sm text-surface-500 font-mono">{upperSymbol}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAlertModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Bell className="w-4 h-4" />
          Create Alert
        </button>
      </div>

      {/* Price Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Price */}
        <div className="glass-card">
          <div className="text-xs text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Current Price
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono text-surface-100">
              {price ? `$${price >= 1000 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price.toFixed(6)}` : '—'}
            </span>
          </div>
        </div>

        {/* 24h Change */}
        <div className="glass-card">
          <div className="text-xs text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            24h Change
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold font-mono ${isUp ? 'price-up' : 'price-down'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
            {isUp ? (
              <TrendingUp className="w-6 h-6 text-profit" />
            ) : (
              <TrendingDown className="w-6 h-6 text-loss" />
            )}
          </div>
        </div>

        {/* Volume */}
        <div className="glass-card">
          <div className="text-xs text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Last Updated
          </div>
          <div className="text-lg font-mono text-surface-200">
            {priceData?.ts ? new Date(priceData.ts).toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-surface-200 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-400" />
            Price Chart
          </h2>
          <div className="flex gap-1 bg-surface-900/50 rounded-lg p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  timeframe === tf
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-white/5'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {candleLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : candles.length > 0 ? (
          <PriceChart data={candles} symbol={upperSymbol} />
        ) : (
          <div className="h-[400px] flex items-center justify-center text-surface-500">
            <div className="text-center">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-surface-700" />
              <p className="text-sm">No chart data available yet</p>
              <p className="text-xs text-surface-600 mt-1">
                Candle data will appear once the ingestion service has been running
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Insight */}
      <AIInsightCard symbol={upperSymbol} />

      {/* Alert Modal */}
      {showAlertModal && asset && (
        <AlertModal
          assetId={asset.id}
          symbol={upperSymbol}
          onClose={() => setShowAlertModal(false)}
          onSubmit={async (data) => {
            try {
              await api.alerts.create(data);
              setShowAlertModal(false);
            } catch (err: any) {
              console.error(err);
            }
          }}
        />
      )}
    </div>
  );
}

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useLivePriceStore } from '../store/useLivePriceStore';
import { usePriceStream } from '../hooks/usePriceStream';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';

interface WatchlistItem {
  id: string;
  asset_id: number;
  asset: {
    id: number;
    symbol: string;
    display_name: string;
  };
}

interface Props {
  items: WatchlistItem[];
  onRemove: (id: string) => void;
}

// Format large numbers
function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export default function WatchlistTable({ items, onRemove }: Props) {
  const symbols = useMemo(() => items.map((i) => i.asset.symbol), [items]);
  usePriceStream(symbols);

  const prices = useLivePriceStore((s) => s.prices);
  const previousPrices = useLivePriceStore((s) => s.previousPrices);
  const [flashSymbols, setFlashSymbols] = useState<Record<string, 'up' | 'down'>>({});

  // Track price flash animations
  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down'> = {};
    for (const symbol of symbols) {
      const current = prices[symbol]?.price;
      const previous = previousPrices[symbol];
      if (current && previous && current !== previous) {
        newFlashes[symbol] = current > previous ? 'up' : 'down';
      }
    }
    if (Object.keys(newFlashes).length > 0) {
      setFlashSymbols(newFlashes);
      const timer = setTimeout(() => setFlashSymbols({}), 500);
      return () => clearTimeout(timer);
    }
  }, [prices, previousPrices, symbols]);

  if (items.length === 0) {
    return (
      <div className="glass-card text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-600/10 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-brand-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-200 mb-2">Your watchlist is empty</h3>
        <p className="text-surface-400 text-sm">Search and add crypto assets to start tracking live prices</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Asset</th>
              <th className="text-right px-5 py-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Price</th>
              <th className="text-right px-5 py-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">24h Change</th>
              <th className="text-right px-5 py-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Volume</th>
              <th className="text-right px-5 py-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const priceData = prices[item.asset.symbol];
              const price = priceData?.price;
              const change = priceData?.change24h || 0;
              const volume = priceData?.volume;
              const flash = flashSymbols[item.asset.symbol];
              const isUp = change >= 0;

              return (
                <tr
                  key={item.id}
                  className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-all duration-200 ${
                    flash === 'up'
                      ? 'animate-price-flash-green'
                      : flash === 'down'
                      ? 'animate-price-flash-red'
                      : ''
                  }`}
                >
                  <td className="px-5 py-4">
                    <Link
                      to={`/asset/${item.asset.symbol}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-brand-300">
                          {item.asset.symbol.replace('USDT', '').slice(0, 3)}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-surface-100 text-sm">{item.asset.display_name}</div>
                        <div className="text-xs text-surface-500 font-mono">{item.asset.symbol}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="font-mono font-semibold text-surface-100">
                      {price ? `$${formatPrice(price)}` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {priceData ? (
                      <span className={`inline-flex items-center gap-1 font-mono font-medium text-sm ${
                        isUp ? 'price-up' : 'price-down'
                      }`}>
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : change === 0 ? <Minus className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {formatChange(change)}
                      </span>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="font-mono text-sm text-surface-400">
                      {volume ? volume.toFixed(4) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1.5 rounded-lg hover:bg-loss/10 text-surface-500 hover:text-loss-light transition-all duration-200"
                      title="Remove from watchlist"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

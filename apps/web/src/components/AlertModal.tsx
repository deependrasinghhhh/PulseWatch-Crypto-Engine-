import { useState } from 'react';
import { X, Bell, TrendingUp, TrendingDown, BarChart3, Activity, GitBranch } from 'lucide-react';

interface Props {
  assetId: number;
  symbol: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const ALERT_TYPES = [
  { value: 'price_above', label: 'Price Above', icon: TrendingUp, description: 'Triggers when price rises above threshold' },
  { value: 'price_below', label: 'Price Below', icon: TrendingDown, description: 'Triggers when price falls below threshold' },
  { value: 'pct_change', label: '% Change (24h)', icon: BarChart3, description: 'Triggers on 24h percentage change' },
  { value: 'volume_spike', label: 'Volume Spike', icon: Activity, description: 'Triggers when volume exceeds average' },
  { value: 'rsi_cross', label: 'RSI Cross', icon: BarChart3, description: 'Triggers when RSI crosses a level' },
  { value: 'ma_cross', label: 'MA Crossover', icon: GitBranch, description: 'Triggers on moving average crossover' },
];

export default function AlertModal({ assetId, symbol, onClose, onSubmit }: Props) {
  const [alertType, setAlertType] = useState('price_above');
  const [cooldown, setCooldown] = useState(30);
  
  // Condition fields
  const [threshold, setThreshold] = useState('');
  const [multiplier, setMultiplier] = useState('2');
  const [rsiPeriod, setRsiPeriod] = useState('14');
  const [rsiLevel, setRsiLevel] = useState('70');
  const [rsiDirection, setRsiDirection] = useState<'above' | 'below'>('above');
  const [fastPeriod, setFastPeriod] = useState('20');
  const [slowPeriod, setSlowPeriod] = useState('50');
  const [maDirection, setMaDirection] = useState<'golden' | 'death'>('golden');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let condition_config: any = {};

    switch (alertType) {
      case 'price_above':
      case 'price_below':
        condition_config = { threshold: parseFloat(threshold) };
        break;
      case 'pct_change':
        condition_config = { threshold: parseFloat(threshold) };
        break;
      case 'volume_spike':
        condition_config = { multiplier: parseFloat(multiplier) };
        break;
      case 'rsi_cross':
        condition_config = {
          period: parseInt(rsiPeriod),
          level: parseFloat(rsiLevel),
          direction: rsiDirection,
        };
        break;
      case 'ma_cross':
        condition_config = {
          fast_period: parseInt(fastPeriod),
          slow_period: parseInt(slowPeriod),
          direction: maDirection,
        };
        break;
    }

    onSubmit({
      asset_id: assetId,
      alert_type: alertType,
      condition_config,
      cooldown_minutes: cooldown,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-100">Create Alert</h2>
              <p className="text-sm text-surface-400">{symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Alert Type Selector */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Alert Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ALERT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAlertType(type.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all duration-200 ${
                      alertType === type.value
                        ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                        : 'border-white/5 bg-surface-900/50 text-surface-400 hover:border-white/10 hover:text-surface-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Condition Config */}
          <div className="space-y-4">
            {(alertType === 'price_above' || alertType === 'price_below') && (
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Price Threshold (USD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="e.g. 45000"
                  className="input-field font-mono"
                  required
                />
              </div>
            )}

            {alertType === 'pct_change' && (
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Change Threshold (%)
                </label>
                <input
                  type="number"
                  step="any"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="e.g. 5"
                  className="input-field font-mono"
                  required
                />
              </div>
            )}

            {alertType === 'volume_spike' && (
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Volume Multiplier (vs 7d avg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  placeholder="e.g. 2"
                  className="input-field font-mono"
                  required
                />
              </div>
            )}

            {alertType === 'rsi_cross' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">RSI Period</label>
                    <input
                      type="number"
                      value={rsiPeriod}
                      onChange={(e) => setRsiPeriod(e.target.value)}
                      className="input-field font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">RSI Level</label>
                    <input
                      type="number"
                      value={rsiLevel}
                      onChange={(e) => setRsiLevel(e.target.value)}
                      className="input-field font-mono"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Direction</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRsiDirection('above')}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        rsiDirection === 'above'
                          ? 'border-profit/40 bg-profit/10 text-profit-light'
                          : 'border-white/5 bg-surface-900/50 text-surface-400'
                      }`}
                    >
                      Crosses Above
                    </button>
                    <button
                      type="button"
                      onClick={() => setRsiDirection('below')}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        rsiDirection === 'below'
                          ? 'border-loss/40 bg-loss/10 text-loss-light'
                          : 'border-white/5 bg-surface-900/50 text-surface-400'
                      }`}
                    >
                      Crosses Below
                    </button>
                  </div>
                </div>
              </>
            )}

            {alertType === 'ma_cross' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Fast SMA Period</label>
                    <input
                      type="number"
                      value={fastPeriod}
                      onChange={(e) => setFastPeriod(e.target.value)}
                      className="input-field font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Slow SMA Period</label>
                    <input
                      type="number"
                      value={slowPeriod}
                      onChange={(e) => setSlowPeriod(e.target.value)}
                      className="input-field font-mono"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Crossover Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMaDirection('golden')}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        maDirection === 'golden'
                          ? 'border-profit/40 bg-profit/10 text-profit-light'
                          : 'border-white/5 bg-surface-900/50 text-surface-400'
                      }`}
                    >
                      🌟 Golden Cross
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaDirection('death')}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        maDirection === 'death'
                          ? 'border-loss/40 bg-loss/10 text-loss-light'
                          : 'border-white/5 bg-surface-900/50 text-surface-400'
                      }`}
                    >
                      💀 Death Cross
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cooldown */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Cooldown (minutes)
            </label>
            <input
              type="number"
              value={cooldown}
              onChange={(e) => setCooldown(parseInt(e.target.value) || 30)}
              min={1}
              max={1440}
              className="input-field font-mono"
            />
            <p className="text-xs text-surface-500 mt-1">
              Prevents re-triggering for this duration after firing
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Create Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

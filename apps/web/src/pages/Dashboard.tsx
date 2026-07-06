import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import WatchlistTable from '../components/WatchlistTable';
import AlertModal from '../components/AlertModal';
import { Search, Plus, X, Bell, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedAssetForAlert, setSelectedAssetForAlert] = useState<any>(null);

  // Fetch watchlist
  const { data: watchlistData, isLoading: watchlistLoading } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => api.watchlist.list(),
  });

  // Fetch alerts
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.alerts.list(),
  });

  // Search assets
  const { data: searchResults } = useQuery({
    queryKey: ['assets', searchQuery],
    queryFn: () => api.assets.search(searchQuery),
    enabled: searchQuery.length > 0,
  });

  // Add to watchlist
  const addToWatchlist = useMutation({
    mutationFn: (assetId: number) => api.watchlist.add(assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success('Added to watchlist');
      setShowSearch(false);
      setSearchQuery('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Remove from watchlist
  const removeFromWatchlist = useMutation({
    mutationFn: (id: string) => api.watchlist.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success('Removed from watchlist');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Create alert
  const createAlert = useMutation({
    mutationFn: (data: any) => api.alerts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert created');
      setShowAlertModal(false);
      setSelectedAssetForAlert(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete alert
  const deleteAlert = useMutation({
    mutationFn: (id: string) => api.alerts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Toggle alert active
  const toggleAlert = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.alerts.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    onError: (err: any) => toast.error(err.message),
  });

  const watchlist = watchlistData?.data || [];
  const alerts = alertsData?.data || [];

  // Existing watchlist asset IDs for filtering search results
  const watchlistAssetIds = useMemo(
    () => new Set(watchlist.map((w: any) => w.asset_id)),
    [watchlist],
  );

  const filteredSearch = (searchResults?.data || []).filter(
    (a: any) => !watchlistAssetIds.has(a.id),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100 flex items-center gap-3">
            <Activity className="w-7 h-7 text-brand-400" />
            Dashboard
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            {watchlist.length} assets · {alerts.filter((a: any) => a.is_active).length} active alerts
          </p>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      {/* Asset Search Panel */}
      {showSearch && (
        <div className="glass-card animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-surface-200 text-sm">Add to Watchlist</h3>
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by symbol or name (e.g. BTC, Ethereum)"
              className="input-field pl-10"
              autoFocus
            />
          </div>
          {filteredSearch.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
              {filteredSearch.map((asset: any) => (
                <button
                  key={asset.id}
                  onClick={() => addToWatchlist.mutate(asset.id)}
                  disabled={addToWatchlist.isPending}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-300">
                        {asset.symbol.replace('USDT', '').slice(0, 3)}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-surface-200 text-sm">{asset.display_name}</div>
                      <div className="text-xs text-surface-500 font-mono">{asset.symbol}</div>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-surface-500 group-hover:text-brand-400 transition-colors" />
                </button>
              ))}
            </div>
          )}
          {searchQuery && filteredSearch.length === 0 && (
            <p className="text-center text-surface-500 text-sm py-4">
              No matching assets found
            </p>
          )}
        </div>
      )}

      {/* Watchlist Table */}
      {watchlistLoading ? (
        <div className="glass-card">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-surface-700/30 rounded-lg shimmer" />
            ))}
          </div>
        </div>
      ) : (
        <WatchlistTable items={watchlist} onRemove={(id) => removeFromWatchlist.mutate(id)} />
      )}

      {/* Alerts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-200 flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-400" />
            Active Alerts
          </h2>
        </div>

        {alerts.length === 0 ? (
          <div className="glass-card text-center py-8">
            <Bell className="w-8 h-8 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400 text-sm">No alerts yet. Click the bell icon on any asset to create one.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {alerts.map((alert: any) => (
              <div
                key={alert.id}
                className={`glass-card flex items-center justify-between ${
                  !alert.is_active ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${alert.is_active ? 'bg-profit animate-pulse' : 'bg-surface-600'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-surface-200">
                        {alert.asset?.symbol || 'Unknown'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-700/50 text-surface-400 font-medium">
                        {alert.alert_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {formatAlertCondition(alert)}
                      {' · '}Cooldown: {alert.cooldown_minutes}m
                      {alert.last_triggered_at && (
                        <> · Last: {new Date(alert.last_triggered_at).toLocaleString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert.mutate({ id: alert.id, is_active: !alert.is_active })}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                      alert.is_active
                        ? 'bg-profit/10 text-profit-light hover:bg-profit/20'
                        : 'bg-surface-700/50 text-surface-400 hover:bg-surface-700'
                    }`}
                  >
                    {alert.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => deleteAlert.mutate(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-loss/10 text-surface-500 hover:text-loss-light transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick alert creation from watchlist */}
        {watchlist.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {watchlist.map((item: any) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedAssetForAlert(item.asset);
                  setShowAlertModal(true);
                }}
                className="btn-ghost text-xs flex items-center gap-1.5 border border-white/5"
              >
                <Bell className="w-3 h-3" />
                Alert for {item.asset.symbol.replace('USDT', '')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Alert Modal */}
      {showAlertModal && selectedAssetForAlert && (
        <AlertModal
          assetId={selectedAssetForAlert.id}
          symbol={selectedAssetForAlert.symbol}
          onClose={() => {
            setShowAlertModal(false);
            setSelectedAssetForAlert(null);
          }}
          onSubmit={(data) => createAlert.mutate(data)}
        />
      )}
    </div>
  );
}

function formatAlertCondition(alert: any): string {
  const cfg = alert.condition_config;
  switch (alert.alert_type) {
    case 'price_above': return `Price > $${cfg.threshold}`;
    case 'price_below': return `Price < $${cfg.threshold}`;
    case 'pct_change': return `24h change > ${cfg.threshold}%`;
    case 'volume_spike': return `Volume > ${cfg.multiplier}x avg`;
    case 'rsi_cross': return `RSI(${cfg.period}) ${cfg.direction} ${cfg.level}`;
    case 'ma_cross': return `SMA(${cfg.fast_period}) ${cfg.direction === 'golden' ? '↑' : '↓'} SMA(${cfg.slow_period})`;
    default: return JSON.stringify(cfg);
  }
}

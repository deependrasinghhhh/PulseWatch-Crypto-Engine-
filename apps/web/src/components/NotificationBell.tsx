import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Bell, Check, CheckCheck, X } from 'lucide-react';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.notifications.list();
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen for new alert notifications via WebSocket
    const socket = getSocket();
    const handler = (data: any) => {
      setNotifications((prev) => [
        {
          id: crypto.randomUUID(),
          title: `🔔 ${data.symbol} Alert`,
          body: data.message,
          created_at: data.triggered_at,
          read_at: null,
        },
        ...prev,
      ]);
    };

    socket.on('alert:triggered', handler);
    return () => {
      socket.off('alert:triggered', handler);
    };
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })),
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative btn-ghost p-2"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-loss text-white text-[10px] font-bold flex items-center justify-center animate-pulse-slow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 glass-card p-0 shadow-2xl animate-slide-down z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="font-semibold text-surface-200 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-surface-500 hover:text-surface-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-surface-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                    !n.read_at ? 'bg-brand-500/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-200 truncate">
                        {n.title}
                      </p>
                      <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-surface-600 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.read_at && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1 rounded hover:bg-white/5 text-surface-500 hover:text-profit transition-colors flex-shrink-0"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

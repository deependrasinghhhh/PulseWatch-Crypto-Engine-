const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && token) {
    // Try refresh
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);

          // Retry original request
          headers['Authorization'] = `Bearer ${data.access_token}`;
          const retryRes = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
          });
          if (!retryRes.ok) {
            const err = await retryRes.json().catch(() => ({}));
            throw new Error(err.message || `Request failed: ${retryRes.status}`);
          }
          return retryRes.json();
        }
      } catch {
        // Refresh failed
      }
    }

    // Clear tokens and redirect
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (res.status === 204) {
    return {} as T;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (data: { email: string; password: string; full_name: string }) =>
      request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  },

  assets: {
    search: (search?: string) =>
      request<{ data: any[] }>(`/assets${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  },

  watchlist: {
    list: () => request<{ data: any[] }>('/watchlist'),
    add: (asset_id: number) =>
      request<{ data: any }>('/watchlist', { method: 'POST', body: JSON.stringify({ asset_id }) }),
    remove: (id: string) =>
      request<void>(`/watchlist/${id}`, { method: 'DELETE' }),
  },

  alerts: {
    list: () => request<{ data: any[] }>('/alerts'),
    create: (data: any) =>
      request<{ data: any }>('/alerts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<{ data: any }>(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/alerts/${id}`, { method: 'DELETE' }),
    history: (id: string) =>
      request<{ data: any[] }>(`/alerts/${id}/history`),
  },

  market: {
    candles: (symbol: string, timeframe = '1h', limit = 200) =>
      request<{ data: any[] }>(`/market/${symbol}/candles?timeframe=${timeframe}&limit=${limit}`),
    latest: (symbol: string) =>
      request<{ data: any }>(`/market/${symbol}/latest`),
  },

  insights: {
    get: (symbol: string) =>
      request<{ data: any; cached: boolean; disclaimer: string }>(`/insights/${symbol}`),
  },

  notifications: {
    list: (unreadOnly = false) =>
      request<{ data: any[] }>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
    markRead: (id: string) =>
      request<{ data: any }>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' }),
  },
};

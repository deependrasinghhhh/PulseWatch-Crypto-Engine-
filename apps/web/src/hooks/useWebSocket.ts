import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuthStore } from '../store/useAuthStore';
import { useLivePriceStore } from '../store/useLivePriceStore';
import type { PriceUpdate } from '@pulsewatch/shared';
import { PRICE_UPDATE_BATCH_MS } from '@pulsewatch/shared';

export function useWebSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const batchUpdatePrices = useLivePriceStore((s) => s.batchUpdatePrices);
  const batchRef = useRef<PriceUpdate[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = connectSocket();

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    // Batch price updates to avoid render thrashing
    socket.on('price:update', (data: PriceUpdate) => {
      // Deduplicate — keep only latest per symbol
      const idx = batchRef.current.findIndex((p) => p.symbol === data.symbol);
      if (idx >= 0) {
        batchRef.current[idx] = data;
      } else {
        batchRef.current.push(data);
      }
    });

    // Flush batch on interval
    timerRef.current = setInterval(() => {
      if (batchRef.current.length > 0) {
        batchUpdatePrices([...batchRef.current]);
        batchRef.current = [];
      }
    }, PRICE_UPDATE_BATCH_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      disconnectSocket();
    };
  }, [isAuthenticated, batchUpdatePrices]);
}

import { useEffect } from 'react';
import { subscribeToSymbol, unsubscribeFromSymbol } from '../lib/socket';

export function usePriceStream(symbols: string[]) {
  useEffect(() => {
    for (const symbol of symbols) {
      subscribeToSymbol(symbol);
    }

    return () => {
      for (const symbol of symbols) {
        unsubscribeFromSymbol(symbol);
      }
    };
  }, [symbols.join(',')]); // Re-subscribe only when list changes
}

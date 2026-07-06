import { create } from 'zustand';
import type { PriceUpdate } from '@pulsewatch/shared';

interface LivePriceState {
  prices: Record<string, PriceUpdate>;
  previousPrices: Record<string, number>;
  updatePrice: (update: PriceUpdate) => void;
  batchUpdatePrices: (updates: PriceUpdate[]) => void;
}

export const useLivePriceStore = create<LivePriceState>((set, get) => ({
  prices: {},
  previousPrices: {},

  updatePrice: (update) => {
    const current = get().prices[update.symbol];
    set((state) => ({
      prices: {
        ...state.prices,
        [update.symbol]: update,
      },
      previousPrices: current
        ? { ...state.previousPrices, [update.symbol]: current.price }
        : state.previousPrices,
    }));
  },

  batchUpdatePrices: (updates) => {
    set((state) => {
      const newPrices = { ...state.prices };
      const newPrevious = { ...state.previousPrices };

      for (const update of updates) {
        if (newPrices[update.symbol]) {
          newPrevious[update.symbol] = newPrices[update.symbol].price;
        }
        newPrices[update.symbol] = update;
      }

      return { prices: newPrices, previousPrices: newPrevious };
    });
  },
}));

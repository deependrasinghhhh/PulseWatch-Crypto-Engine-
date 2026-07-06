import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

interface CandleData {
  open_time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface Props {
  data: CandleData[];
  symbol: string;
}

export default function PriceChart({ data, symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // Dispose old chart if exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: 'rgba(92, 124, 250, 0.3)',
          style: 2,
          width: 1,
        },
        horzLine: {
          color: 'rgba(92, 124, 250, 0.3)',
          style: 2,
          width: 1,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });

    // Volume series (using HistogramSeries)
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Transform data
    const candleData = data.map((d) => ({
      time: (new Date(d.open_time).getTime() / 1000) as any,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
    }));

    const volumeData = data.map((d) => {
      const open = parseFloat(d.open);
      const close = parseFloat(d.close);
      return {
        time: (new Date(d.open_time).getTime() / 1000) as any,
        value: parseFloat(d.volume),
        color: close >= open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      };
    });

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Responsive
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, symbol]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] rounded-xl overflow-hidden"
    />
  );
}

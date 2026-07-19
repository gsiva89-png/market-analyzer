import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import { 
  Zap, RefreshCw, BarChart2, Trash2, Edit3
} from 'lucide-react';
import { generateLiveOptionRecommendation } from '../utils/liveOptionEngine';

export default function LiveChartModule({ indexData, activeIndex, timeframe, liveTicks, historicalOI, onRefresh, formatNumber, themeColor }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const rsiChartRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const rsiSeriesRef = useRef(null);

  const [activeTimeframe, setActiveTimeframe] = useState(timeframe || '1D');
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [drawMode, setDrawMode] = useState(null);
  const [drawnLines, setDrawnLines] = useState([]);
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    if (indexData) {
      const rec = generateLiveOptionRecommendation(indexData, liveTicks, historicalOI);
      setRecommendation(rec);
    }
  }, [indexData, liveTicks, historicalOI]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!indexData || !indexData.history || indexData.history.length === 0) return;

    {
      // Cleanup previous chart instance
      if (chartInstanceRef.current) {
        try { chartInstanceRef.current.remove(); } catch (e) {}
        chartInstanceRef.current = null;
        candleSeriesRef.current = null;
      }

      const container = chartContainerRef.current;
      const width = container.clientWidth || 800;

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: '#0d1117' },
          textColor: '#8b949e',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
          mode: 1,
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.08 },
        },
        width,
        height: 480,
      });

      chartInstanceRef.current = chart;

      // Candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
      candleSeriesRef.current = candleSeries;

      // Build sorted unique candle data
      const seen = new Set();
      const candles = indexData.history
        .filter(c => c.date && c.close)
        .map(c => ({
          time: c.date,
          open: Number(c.open || c.close),
          high: Number(c.high || c.close),
          low: Number(c.low || c.close),
          close: Number(c.close),
        }))
        .sort((a, b) => a.time > b.time ? 1 : -1)
        .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });

      if (candles.length > 0) {
        candleSeries.setData(candles);
      }

      // Volume histogram
      if (showVolume) {
        const volSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          scaleMargins: { top: 0.78, bottom: 0 },
        });

        const volData = candles.map((c, i) => {
          const raw = indexData.history[i]?.volume || 50000;
          return { time: c.time, value: raw, color: c.close >= c.open ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)' };
        });
        volSeries.setData(volData);
      }

      // SMA overlays
      const addLine = (key, color, title) => {
        const data = indexData.history
          .filter(c => c.date && c[key] != null)
          .map(c => ({ time: c.date, value: Number(c[key]) }))
          .sort((a, b) => a.time > b.time ? 1 : -1);
        if (data.length === 0) return;
        const series = chart.addLineSeries({ color, lineWidth: 2, title });
        series.setData(data);
      };

      if (showSMA20)  addLine('sma20',  '#f59e0b', 'SMA 20');
      if (showSMA50)  addLine('sma50',  '#3b82f6', 'SMA 50');
      if (showSMA200) addLine('sma200', '#a855f7', 'SMA 200');

      // Bollinger Bands
      if (showBB) {
        const bbU = indexData.history.filter(c => c.date && c.bbUpper).map(c => ({ time: c.date, value: Number(c.bbUpper) })).sort((a,b) => a.time > b.time ? 1 : -1);
        const bbL = indexData.history.filter(c => c.date && c.bbLower).map(c => ({ time: c.date, value: Number(c.bbLower) })).sort((a,b) => a.time > b.time ? 1 : -1);
        if (bbU.length > 0) {
          chart.addLineSeries({ color: 'rgba(56,189,248,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Upper' }).setData(bbU);
          chart.addLineSeries({ color: 'rgba(56,189,248,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Lower' }).setData(bbL);
        }
      }

      // Option Signal markers
      if (showSignals && candles.length > 0) {
        const markers = [];
        const histMap = {};
        indexData.history.forEach(c => { if (c.date) histMap[c.date] = c; });

        candles.forEach((c, idx) => {
          if (idx % 7 !== 0) return; // spread markers
          const h = histMap[c.time];
          if (!h) return;
          if (h.rsi != null && h.rsi > 58 && h.sma20 && h.close > h.sma20) {
            markers.push({ time: c.time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'CE' });
          } else if (h.rsi != null && h.rsi < 42 && h.sma20 && h.close < h.sma20) {
            markers.push({ time: c.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'PE' });
          }
        });
        if (markers.length > 0) candleSeries.setMarkers(markers);
      }

      // Drawn horizontal price lines
      drawnLines.forEach(line => {
        candleSeries.createPriceLine({
          price: line.price,
          color: line.color || '#f59e0b',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `₹${line.price}`,
        });
      });

      // Click handler for drawing support/resistance
      chart.subscribeClick(param => {
        if (!param.point || !drawMode) return;
        const price = candleSeries.coordinateToPrice(param.point.y);
        if (price && drawMode === 'horizontal') {
          setDrawnLines(prev => [...prev, { id: Date.now(), price: Number(price.toFixed(2)), color: '#f59e0b' }]);
          setDrawMode(null);
        }
      });

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (container && chart) {
          chart.applyOptions({ width: container.clientWidth });
        }
      });
      ro.observe(container);

      return () => {
        ro.disconnect();
        try { chart.remove(); } catch (e) {}
        chartInstanceRef.current = null;
      };
    }
  }, [indexData, showSMA20, showSMA50, showSMA200, showBB, showVolume, showSignals, drawnLines, drawMode]);

  // RSI sub-chart
  useEffect(() => {
    if (!showRSI || !rsiContainerRef.current || !indexData?.history) return;

    if (rsiChartRef.current) {
      try { rsiChartRef.current.remove(); } catch (e) {}
      rsiChartRef.current = null;
    }

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0d1117' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      timeScale: { visible: false },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      width: rsiContainerRef.current.clientWidth || 800,
      height: 120,
    });
    rsiChartRef.current = rsiChart;

    const rsiSeries = rsiChart.addLineSeries({ color: '#38bdf8', lineWidth: 2, title: 'RSI 14' });
    const rsiData = indexData.history
      .filter(c => c.date && c.rsi != null)
      .map(c => ({ time: c.date, value: Number(c.rsi) }))
      .sort((a, b) => a.time > b.time ? 1 : -1);
    if (rsiData.length > 0) rsiSeries.setData(rsiData);
    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'OB 70' });
    rsiSeries.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'OS 30' });

    const ro = new ResizeObserver(() => {
      if (rsiContainerRef.current && rsiChart) {
        rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    });
    ro.observe(rsiContainerRef.current);

    return () => { ro.disconnect(); try { rsiChart.remove(); } catch (e) {} rsiChartRef.current = null; };
  }, [showRSI, indexData]);

  if (!indexData || !indexData.quote) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
        <p className="text-muted">Loading live market chart feed...</p>
      </div>
    );
  }

  const indexName = indexData.indexName || 'Nifty 50';
  const spotPrice = indexData.quote.price || 0;
  const changePercent = indexData.quote.changePercent || 0;

  return (
    <div className="live-chart-module-container">
      {/* Header */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BarChart2 size={24} color={themeColor || '#10b981'} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
              {indexName.toUpperCase()} — INTERACTIVE LIVE CHART
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Candlestick chart · Custom timeframes · Technical indicators · Drawing tools · Option signal markers
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>SPOT PRICE</div>
            <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'JetBrains Mono' }} className={changePercent >= 0 ? 'text-up' : 'text-down'}>
              ₹{formatNumber(spotPrice)} ({changePercent >= 0 ? '+' : ''}{changePercent}%)
            </div>
          </div>
          <button className="timeframe-btn active" onClick={onRefresh} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Timeframe */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginRight: '4px' }}>TIMEFRAME:</span>
          {['1M', '5M', '15M', '1H', '1D'].map(tf => (
            <button key={tf} className={`timeframe-btn ${activeTimeframe === tf ? 'active' : ''}`} onClick={() => setActiveTimeframe(tf)} style={{ fontSize: '12px', padding: '4px 10px' }}>{tf}</button>
          ))}
        </div>

        {/* Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>INDICATORS:</span>
          <button className={`timeframe-btn ${showSMA20 ? 'active' : ''}`} onClick={() => setShowSMA20(!showSMA20)} style={{ fontSize: '11px', padding: '4px 8px', color: showSMA20 ? '#f59e0b' : 'var(--text-dim)' }}>SMA 20</button>
          <button className={`timeframe-btn ${showSMA50 ? 'active' : ''}`} onClick={() => setShowSMA50(!showSMA50)} style={{ fontSize: '11px', padding: '4px 8px', color: showSMA50 ? '#3b82f6' : 'var(--text-dim)' }}>SMA 50</button>
          <button className={`timeframe-btn ${showSMA200 ? 'active' : ''}`} onClick={() => setShowSMA200(!showSMA200)} style={{ fontSize: '11px', padding: '4px 8px', color: showSMA200 ? '#a855f7' : 'var(--text-dim)' }}>SMA 200</button>
          <button className={`timeframe-btn ${showBB ? 'active' : ''}`} onClick={() => setShowBB(!showBB)} style={{ fontSize: '11px', padding: '4px 8px' }}>Bollinger</button>
          <button className={`timeframe-btn ${showVolume ? 'active' : ''}`} onClick={() => setShowVolume(!showVolume)} style={{ fontSize: '11px', padding: '4px 8px' }}>Volume</button>
          <button className={`timeframe-btn ${showRSI ? 'active' : ''}`} onClick={() => setShowRSI(!showRSI)} style={{ fontSize: '11px', padding: '4px 8px' }}>RSI (14)</button>
          <button className={`timeframe-btn ${showSignals ? 'active' : ''}`} onClick={() => setShowSignals(!showSignals)} style={{ fontSize: '11px', padding: '4px 8px', color: showSignals ? '#10b981' : 'var(--text-dim)' }}>
            <Zap size={12} style={{ display: 'inline', marginRight: '3px' }} />CE/PE Signals
          </button>
        </div>

        {/* Drawing Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>TOOLS:</span>
          <button
            className={`timeframe-btn ${drawMode === 'horizontal' ? 'active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'horizontal' ? null : 'horizontal')}
            style={{ fontSize: '11px', padding: '4px 10px', background: drawMode === 'horizontal' ? 'rgba(245,158,11,0.3)' : 'transparent' }}
            title="Click on chart to draw horizontal support/resistance level"
          >
            <Edit3 size={12} style={{ display: 'inline', marginRight: '4px' }} />
            {drawMode === 'horizontal' ? '⬡ Click Chart...' : '+ Draw Level'}
          </button>
          {drawnLines.length > 0 && (
            <button className="timeframe-btn" onClick={() => setDrawnLines([])} style={{ fontSize: '11px', padding: '4px 8px', color: '#ef4444' }}>
              <Trash2 size={12} style={{ display: 'inline', marginRight: '4px' }} />Clear ({drawnLines.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-panel" style={{ padding: '10px', marginBottom: '12px', position: 'relative' }}>
        {recommendation?.signalTitle && (
          <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
            <span className={`badge ${recommendation.badgeClass}`} style={{ fontSize: '11px', padding: '2px 8px' }}>{recommendation.signalTitle}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-main)', fontFamily: 'JetBrains Mono' }}>
              T1: ₹{formatNumber(recommendation.levels?.target1Spot)} | SL: ₹{formatNumber(recommendation.levels?.stopLossSpot)}
            </span>
          </div>
        )}

        {drawMode === 'horizontal' && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', color: '#fde047' }}>
            ✎ Click anywhere on the chart to draw a support/resistance line
          </div>
        )}

        <div ref={chartContainerRef} style={{ width: '100%', height: '480px' }} />
      </div>

      {/* RSI Sub-Chart */}
      {showRSI && (
        <div className="glass-panel" style={{ padding: '10px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>RSI (14)</span>
            <span>Overbought: 70 | Oversold: 30</span>
          </div>
          <div ref={rsiContainerRef} style={{ width: '100%', height: '120px' }} />
        </div>
      )}

      {/* Drawn Levels Legend */}
      {drawnLines.length > 0 && (
        <div className="glass-panel" style={{ padding: '14px 20px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 8px 0' }}>Active Support &amp; Resistance Lines</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {drawnLines.map(line => (
              <div key={line.id} style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', borderLeft: `3px solid ${line.color}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>₹{line.price}</span>
                <button onClick={() => setDrawnLines(drawnLines.filter(l => l.id !== line.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '14px' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

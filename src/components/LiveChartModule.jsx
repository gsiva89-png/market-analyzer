import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import { Zap, RefreshCw, BarChart2, Trash2, Edit3, Loader } from 'lucide-react';
import { generateLiveOptionRecommendation } from '../utils/liveOptionEngine';

// Intraday TFs need separate API fetch; range TFs slice existing daily history
const INTRADAY_TFS  = new Set(['1M','5M','15M','1H','1D']);
const INTRADAY_MAP  = { '1M':'1m', '5M':'5m', '15M':'15m', '1H':'1h', '1D':'1d' };
const RANGE_TF_BARS = { '5D':5, '1W':5, '1MO':22, '3M':66, '6M':132, '1Y':252, 'MAX':99999 };

export default function LiveChartModule({ indexData, activeIndex, timeframe, liveTicks, historicalOI, onRefresh, formatNumber, themeColor }) {
  const chartContainerRef = useRef(null);
  const rsiContainerRef   = useRef(null);
  const chartInstanceRef  = useRef(null);
  const rsiChartRef       = useRef(null);

  const [activeTimeframe, setActiveTimeframe] = useState('3M');
  const [intradayCandles, setIntradayCandles] = useState(null);  // null = not fetched yet
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [intradayError,   setIntradayError]   = useState(null);
  const [showSMA20,    setShowSMA20]    = useState(true);
  const [showSMA50,    setShowSMA50]    = useState(true);
  const [showSMA200,   setShowSMA200]   = useState(false);
  const [showBB,       setShowBB]       = useState(false);
  const [showVolume,   setShowVolume]   = useState(true);
  const [showRSI,      setShowRSI]      = useState(true);
  const [showSignals,  setShowSignals]  = useState(true);
  const [drawMode,     setDrawMode]     = useState(null);
  const [drawnLines,   setDrawnLines]   = useState([]);
  const [recommendation, setRecommendation] = useState(null);

  // Compute recommendation
  useEffect(() => {
    if (indexData) {
      setRecommendation(generateLiveOptionRecommendation(indexData, liveTicks, historicalOI));
    }
  }, [indexData, liveTicks, historicalOI]);

  // ── Fetch intraday candles from server when an intraday TF is selected ───────
  useEffect(() => {
    if (!INTRADAY_TFS.has(activeTimeframe)) return;
    const yfInterval = INTRADAY_MAP[activeTimeframe];
    const idx = activeIndex || 'nifty50';
    const url = `/api/intraday?index=${idx}&interval=${yfInterval}`;

    setIntradayLoading(true);
    setIntradayError(null);
    setIntradayCandles(null);

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setIntradayCandles(data.candles || []);
      })
      .catch(err => setIntradayError(err.message))
      .finally(() => setIntradayLoading(false));
  }, [activeTimeframe, activeIndex]);

  // ── Build candle array based on active TF ────────────────────────────────
  const getFilteredCandles = useCallback((rawHistory) => {
    const seen = new Set();
    const all = rawHistory
      .filter(c => c.date && c.close)
      .map(c => ({
        time: c.date,
        open:  Number(c.open  || c.close),
        high:  Number(c.high  || c.close),
        low:   Number(c.low   || c.close),
        close: Number(c.close),
        _raw: c,
      }))
      .sort((a, b) => (a.time > b.time ? 1 : -1))
      .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });
    const limit = RANGE_TF_BARS[activeTimeframe] ?? 66;
    return all.slice(-limit);
  }, [activeTimeframe]);

  const isIntraday  = INTRADAY_TFS.has(activeTimeframe);
  // getChartCandles() returns the right candles for the active TF
  const getChartCandles = () => {
    if (isIntraday) return intradayCandles || [];
    return getFilteredCandles(indexData?.history || []);
  };

  // ── Main Candlestick Chart ──────────────────────────────────────────────────
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    // For intraday: wait until data fetched (no spinner block here — handled in JSX)
    if (isIntraday && intradayLoading) return;
    if (isIntraday && !intradayCandles) return;
    if (!isIntraday && !indexData?.history?.length) return;

    // destroy previous instance
    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.remove(); } catch (_) {}
      chartInstanceRef.current = null;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, secondsVisible: false },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.08 },
      },
      width: container.clientWidth || 800,
      height: 480,
    });
    chartInstanceRef.current = chart;

    // ── Candlestick ────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });

    const candles = getChartCandles();
    if (candles.length) candleSeries.setData(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));

    // ── Volume ─────────────────────────────────────────────
    if (showVolume) {
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
        scaleMargins: { top: 0.78, bottom: 0 },
      });
      const volData = candles.map(c => ({
        time: c.time,
        value: c._raw?.volume ?? c.volume ?? 50000,
        color: c.close >= c.open ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
      }));
      volSeries.setData(volData);
    }

    // ── SMA helper (only for range/daily data — skip for intraday) ────────────
    const addLine = (key, color, title) => {
      if (isIntraday) return; // no pre-computed SMAs in intraday data
      const times = new Set(candles.map(c => c.time));
      const data = (indexData?.history || [])
        .filter(c => c.date && c[key] != null && times.has(c.date))
        .map(c => ({ time: c.date, value: Number(c[key]) }))
        .sort((a, b) => (a.time > b.time ? 1 : -1));
      if (!data.length) return;
      chart.addLineSeries({ color, lineWidth: 2, title }).setData(data);
    };

    if (showSMA20)  addLine('sma20',  '#f59e0b', 'SMA 20');
    if (showSMA50)  addLine('sma50',  '#3b82f6', 'SMA 50');
    if (showSMA200) addLine('sma200', '#a855f7', 'SMA 200');

    // ── Bollinger Bands (daily only) ───────────────────────────────────────────
    if (showBB && !isIntraday) {
      const times = new Set(candles.map(c => c.time));
      const bbU = (indexData?.history||[]).filter(c => c.date && c.bbUpper && times.has(c.date)).map(c => ({ time: c.date, value: Number(c.bbUpper) })).sort((a,b) => a.time > b.time ? 1 : -1);
      const bbL = (indexData?.history||[]).filter(c => c.date && c.bbLower && times.has(c.date)).map(c => ({ time: c.date, value: Number(c.bbLower) })).sort((a,b) => a.time > b.time ? 1 : -1);
      if (bbU.length) {
        chart.addLineSeries({ color: 'rgba(56,189,248,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed }).setData(bbU);
        chart.addLineSeries({ color: 'rgba(56,189,248,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed }).setData(bbL);
      }
    }

    // ── Option Signal Markers ──────────────────────────────────────────────────
    if (showSignals && candles.length) {
      const spacing = Math.max(1, Math.floor(candles.length / 10)); // ~10 markers max
      const markers = [];
      candles.forEach((c, i) => {
        if (i % spacing !== 0) return;
        const h = c._raw;
        if (!h) return;
        if (h.rsi > 58 && h.sma20 && h.close > h.sma20)
          markers.push({ time: c.time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'CE' });
        else if (h.rsi < 42 && h.sma20 && h.close < h.sma20)
          markers.push({ time: c.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'PE' });
      });
      if (markers.length) candleSeries.setMarkers(markers);
    }

    // ── Drawn Price Lines ─────────────────────────────────
    drawnLines.forEach(line => {
      candleSeries.createPriceLine({
        price: line.price,
        color: '#f59e0b',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `₹${line.price}`,
      });
    });

    // ── Draw Mode Click ───────────────────────────────────
    chart.subscribeClick(param => {
      if (!param.point || !drawMode) return;
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (price && drawMode === 'horizontal') {
        setDrawnLines(prev => [...prev, { id: Date.now(), price: Number(price.toFixed(2)) }]);
        setDrawMode(null);
      }
    });

    // ── Resize ────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch (_) {}
      chartInstanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexData, activeTimeframe, intradayCandles, intradayLoading, showSMA20, showSMA50, showSMA200, showBB, showVolume, showSignals, drawnLines, drawMode]);

  // ── RSI Sub-Chart (daily data only — intraday RSI not pre-computed) ─────────
  useEffect(() => {
    const container = rsiContainerRef.current;
    if (!showRSI || !container || isIntraday || !indexData?.history?.length) return;
    const times = new Set(getFilteredCandles(indexData.history).map(c => c.time));

    if (rsiChartRef.current) {
      try { rsiChartRef.current.remove(); } catch (_) {}
      rsiChartRef.current = null;
    }

    const rsiChart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: '#0d1117' }, textColor: '#8b949e' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      timeScale: { visible: false },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      width: container.clientWidth || 800,
      height: 120,
    });
    rsiChartRef.current = rsiChart;

    const rsiSeries = rsiChart.addLineSeries({ color: '#38bdf8', lineWidth: 2 });
    const rsiData = indexData.history
      .filter(c => c.date && c.rsi != null && times.has(c.date))
      .map(c => ({ time: c.date, value: Number(c.rsi) }))
      .sort((a, b) => (a.time > b.time ? 1 : -1));
    if (rsiData.length) rsiSeries.setData(rsiData);
    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, title: '70' });
    rsiSeries.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, title: '30' });

    const ro = new ResizeObserver(() => {
      if (container && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      try { rsiChart.remove(); } catch (_) {}
      rsiChartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRSI, indexData, activeTimeframe]);

  // ── Guard: no data yet ─────────────────────────────────────────────────────
  if (!indexData?.quote) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px auto' }} />
        <p className="text-muted">Loading live market chart…</p>
      </div>
    );
  }

  const indexName     = indexData.indexName  || 'Nifty 50';
  const spotPrice     = indexData.quote.price || 0;
  const changePercent = indexData.quote.changePercent || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── Header ── */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BarChart2 size={22} color={themeColor || '#10b981'} />
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '800', margin: 0 }}>
              {indexName.toUpperCase()} — INTERACTIVE LIVE CHART
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Candlestick · Indicators · Drawing tools · CE/PE signal markers
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>SPOT</div>
            <div style={{ fontSize: '17px', fontWeight: '800', fontFamily: 'JetBrains Mono' }}
                 className={changePercent >= 0 ? 'text-up' : 'text-down'}>
              ₹{formatNumber(spotPrice)} ({changePercent >= 0 ? '+' : ''}{changePercent}%)
            </div>
          </div>
          <button className="timeframe-btn active" onClick={onRefresh}
                  style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="glass-panel" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Row 1: Timeframes */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

          {/* Intraday buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>INTRADAY:</span>
            {[
              { label: '1M',  desc: 'Last 6 hours · 1-min candles' },
              { label: '5M',  desc: 'Last 5 days · 5-min candles' },
              { label: '15M', desc: 'Last 10 days · 15-min candles' },
              { label: '1H',  desc: 'Last 30 days · 1-hour candles' },
              { label: '1D',  desc: 'Last 90 days · 1-day candles' },
            ].map(({ label, desc }) => (
              <button key={label}
                      className={`timeframe-btn ${activeTimeframe === label ? 'active' : ''}`}
                      onClick={() => setActiveTimeframe(label)}
                      title={desc}
                      style={{ fontSize: '11px', padding: '3px 9px',
                               background: activeTimeframe === label ? 'rgba(245,158,11,0.3)' : 'transparent',
                               borderColor: activeTimeframe === label ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                               color: activeTimeframe === label ? '#fde047' : 'var(--text-dim)' }}>{label}</button>
            ))}
            {intradayLoading && <span style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Fetching…</span>}
            {intradayError  && <span style={{ fontSize: '11px', color: '#ef4444' }}>⚠ {intradayError}</span>}
          </div>

          <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)' }} />

          {/* Historical range buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '700' }}>RANGE:</span>
            {[
              { label: '5D',  desc: 'Last 5 days' },
              { label: '1MO', desc: 'Last 1 month' },
              { label: '3M',  desc: 'Last 3 months' },
              { label: '6M',  desc: 'Last 6 months' },
              { label: '1Y',  desc: 'Last 1 year' },
              { label: 'MAX', desc: 'All historical data' },
            ].map(({ label, desc }) => (
              <button key={label}
                      className={`timeframe-btn ${activeTimeframe === label ? 'active' : ''}`}
                      onClick={() => setActiveTimeframe(label)}
                      title={desc}
                      style={{ fontSize: '11px', padding: '3px 9px',
                               background: activeTimeframe === label ? 'rgba(59,130,246,0.3)' : 'transparent',
                               borderColor: activeTimeframe === label ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                               color: activeTimeframe === label ? '#93c5fd' : 'var(--text-dim)' }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: '1px', background: 'var(--glass-border)' }} />

        {/* Row 2: Indicators + Drawing tools */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

        {/* Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>INDICATORS:</span>
          {[
            { label: 'SMA 20',  state: showSMA20,   fn: setShowSMA20,   color: '#f59e0b' },
            { label: 'SMA 50',  state: showSMA50,   fn: setShowSMA50,   color: '#3b82f6' },
            { label: 'SMA 200', state: showSMA200,  fn: setShowSMA200,  color: '#a855f7' },
            { label: 'BB',      state: showBB,      fn: setShowBB,      color: '#38bdf8' },
            { label: 'Volume',  state: showVolume,  fn: setShowVolume,  color: '#10b981' },
            { label: 'RSI',     state: showRSI,     fn: setShowRSI,     color: '#38bdf8' },
          ].map(({ label, state, fn, color }) => (
            <button key={label}
                    className={`timeframe-btn ${state ? 'active' : ''}`}
                    onClick={() => fn(!state)}
                    style={{ fontSize: '11px', padding: '3px 8px', color: state ? color : 'var(--text-dim)' }}>
              {label}
            </button>
          ))}
          <button className={`timeframe-btn ${showSignals ? 'active' : ''}`}
                  onClick={() => setShowSignals(!showSignals)}
                  style={{ fontSize: '11px', padding: '3px 8px', color: showSignals ? '#10b981' : 'var(--text-dim)' }}>
            <Zap size={11} style={{ display: 'inline', marginRight: '3px' }} />CE/PE
          </button>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)' }} />

        {/* Drawing Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button className={`timeframe-btn ${drawMode === 'horizontal' ? 'active' : ''}`}
                  onClick={() => setDrawMode(drawMode === 'horizontal' ? null : 'horizontal')}
                  style={{ fontSize: '11px', padding: '3px 9px', background: drawMode === 'horizontal' ? 'rgba(245,158,11,0.25)' : 'transparent' }}>
            <Edit3 size={11} style={{ display: 'inline', marginRight: '3px' }} />
            {drawMode === 'horizontal' ? '↕ Click chart…' : '+ Draw Level'}
          </button>
          {drawnLines.length > 0 && (
            <button className="timeframe-btn" onClick={() => setDrawnLines([])}
                    style={{ fontSize: '11px', padding: '3px 8px', color: '#ef4444' }}>
              <Trash2 size={11} style={{ display: 'inline', marginRight: '3px' }} />Clear ({drawnLines.length})
            </button>
          )}
          </div>
        </div>
      </div>

      {/* ── Main Chart Canvas ── */}
      <div className="glass-panel" style={{ padding: '8px', position: 'relative' }}>
        {recommendation?.signalTitle && (
          <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 10,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)',
                        padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
            <span className={`badge ${recommendation.badgeClass}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
              {recommendation.signalTitle}
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: 'var(--text-main)' }}>
              T1: ₹{formatNumber(recommendation.levels?.target1Spot)} | SL: ₹{formatNumber(recommendation.levels?.stopLossSpot)}
            </span>
          </div>
        )}
        {drawMode === 'horizontal' && (
          <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 10,
                        background: 'rgba(245,158,11,0.18)', border: '1px solid #f59e0b',
                        padding: '4px 12px', borderRadius: '6px', fontSize: '11px', color: '#fde047' }}>
            ✎ Click chart to place level
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height: '480px' }} />
      </div>

      {/* ── RSI Sub-Chart ── */}
      {showRSI && (
        <div className="glass-panel" style={{ padding: '8px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
            <span>RSI (14)</span><span>70 = Overbought · 30 = Oversold</span>
          </div>
          <div ref={rsiContainerRef} style={{ width: '100%', height: '120px' }} />
        </div>
      )}

      {/* ── Drawn Levels ── */}
      {drawnLines.length > 0 && (
        <div className="glass-panel" style={{ padding: '12px 18px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: '700', margin: '0 0 8px 0' }}>Support &amp; Resistance Lines</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {drawnLines.map(line => (
              <div key={line.id} style={{ fontSize: '12px', padding: '3px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', borderLeft: '3px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>₹{line.price}</span>
                <button onClick={() => setDrawnLines(drawnLines.filter(l => l.id !== line.id))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

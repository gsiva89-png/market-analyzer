import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import { 
  Zap, RefreshCw, Layers, TrendingUp, BarChart2, Eye, EyeOff, Trash2, Edit3, Compass, Sliders, Maximize2
} from 'lucide-react';
import { generateLiveOptionRecommendation } from '../utils/liveOptionEngine';

export default function LiveChartModule({ indexData, activeIndex, timeframe, liveTicks, historicalOI, onRefresh, formatNumber, themeColor }) {
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  
  const [activeTimeframe, setActiveTimeframe] = useState(timeframe || '15M');
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showSignals, setShowSignals] = useState(true);

  // Drawing state
  const [drawMode, setDrawMode] = useState(null); // 'horizontal' | 'trendline' | null
  const [drawnLines, setDrawnLines] = useState([]);
  const [drawingPoints, setDrawingPoints] = useState([]);

  // Recommendation engine state
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    if (indexData) {
      const rec = generateLiveOptionRecommendation(indexData, liveTicks, historicalOI);
      setRecommendation(rec);
    }
  }, [indexData, liveTicks, historicalOI]);

  useEffect(() => {
    if (!chartContainerRef.current || !indexData || !indexData.history || indexData.history.length === 0) return;

    // 1. Initialize Main Lightweight Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(56, 189, 248, 0.5)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(56, 189, 248, 0.5)', width: 1, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: 480,
    });

    // 2. Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Format candle history data for Lightweight Charts
    const formattedCandles = indexData.history.map(c => {
      // time can be timestamp string 'YYYY-MM-DD' or unix timestamp in seconds
      const timeVal = c.date ? c.date : (c.timestamp ? c.timestamp.split('T')[0] : Math.floor(Date.now() / 1000));
      return {
        time: timeVal,
        open: Number(c.open || c.close),
        high: Number(c.high || c.close),
        low: Number(c.low || c.close),
        close: Number(c.close),
      };
    }).sort((a, b) => (a.time > b.time ? 1 : -1));

    // Remove duplicate times
    const uniqueCandles = [];
    const seenTimes = new Set();
    formattedCandles.forEach(c => {
      if (!seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        uniqueCandles.push(c);
      }
    });

    candleSeries.setData(uniqueCandles);

    // 3. Add Volume Series
    let volumeSeries = null;
    if (showVolume) {
      volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: {
          top: 0.75,
          bottom: 0,
        },
      });

      const volumeData = uniqueCandles.map((c, i) => {
        const rawVol = indexData.history[i]?.volume || 1000;
        const color = c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
        return { time: c.time, value: rawVol, color };
      });
      volumeSeries.setData(volumeData);
    }

    // 4. Add SMA Indicators
    let sma20Series = null;
    let sma50Series = null;
    let sma200Series = null;

    if (showSMA20) {
      sma20Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, title: 'SMA 20' });
      const data20 = indexData.history
        .filter(c => c.sma20 !== undefined && c.sma20 !== null)
        .map(c => ({ time: c.date, value: Number(c.sma20) }));
      if (data20.length > 0) sma20Series.setData(data20);
    }

    if (showSMA50) {
      sma50Series = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, title: 'SMA 50' });
      const data50 = indexData.history
        .filter(c => c.sma50 !== undefined && c.sma50 !== null)
        .map(c => ({ time: c.date, value: Number(c.sma50) }));
      if (data50.length > 0) sma50Series.setData(data50);
    }

    if (showSMA200) {
      sma200Series = chart.addLineSeries({ color: '#a855f7', lineWidth: 2, title: 'SMA 200' });
      const data200 = indexData.history
        .filter(c => c.sma200 !== undefined && c.sma200 !== null)
        .map(c => ({ time: c.date, value: Number(c.sma200) }));
      if (data200.length > 0) sma200Series.setData(data200);
    }

    // 5. Add Bollinger Bands
    if (showBB) {
      const bbUpper = chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Upper' });
      const bbLower = chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'BB Lower' });

      const dataUpper = indexData.history.filter(c => c.bbUpper).map(c => ({ time: c.date, value: Number(c.bbUpper) }));
      const dataLower = indexData.history.filter(c => c.bbLower).map(c => ({ time: c.date, value: Number(c.bbLower) }));

      if (dataUpper.length > 0) bbUpper.setData(dataUpper);
      if (dataLower.length > 0) bbLower.setData(dataLower);
    }

    // 6. Render Signal Markers directly on Candlesticks
    if (showSignals) {
      const markers = [];
      uniqueCandles.forEach((c, idx) => {
        const histItem = indexData.history[idx];
        if (!histItem) return;

        // Buy CE Condition (RSI breakout or bullish SMA alignment)
        if (histItem.rsi && histItem.rsi > 58 && histItem.sma20 && histItem.close > histItem.sma20) {
          if (idx % 8 === 0) { // Space out markers for visual clarity
            markers.push({
              time: c.time,
              position: 'belowBar',
              color: '#10b981',
              shape: 'arrowUp',
              text: 'BUY CE',
            });
          }
        } else if (histItem.rsi && histItem.rsi < 42 && histItem.sma20 && histItem.close < histItem.sma20) {
          if (idx % 8 === 0) {
            markers.push({
              time: c.time,
              position: 'aboveBar',
              color: '#ef4444',
              shape: 'arrowDown',
              text: 'BUY PE',
            });
          }
        }
      });

      if (markers.length > 0) {
        candleSeries.setMarkers(markers);
      }
    }

    // 7. Render Drawn Lines (Horizontal Support / Resistance)
    drawnLines.forEach(line => {
      if (line.type === 'horizontal') {
        candleSeries.createPriceLine({
          price: line.price,
          color: line.color || '#f59e0b',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: line.title || 'Support/Resistance',
        });
      }
    });

    // Handle Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    // 8. Handle Chart Click for Drawing Tools
    chart.subscribeClick((param) => {
      if (!param.point || !param.time || !drawMode) return;
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (price) {
        if (drawMode === 'horizontal') {
          const newLine = {
            id: Date.now(),
            type: 'horizontal',
            price: Number(price.toFixed(2)),
            color: '#f59e0b',
            title: `Level ₹${price.toFixed(2)}`,
          };
          setDrawnLines(prev => [...prev, newLine]);
          setDrawMode(null);
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [indexData, showSMA20, showSMA50, showSMA200, showBB, showVolume, showSignals, drawnLines, drawMode]);

  // Separate Effect for RSI Sub-Chart Panel
  useEffect(() => {
    if (!showRSI || !rsiContainerRef.current || !indexData || !indexData.history) return;

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      timeScale: { visible: false },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      width: rsiContainerRef.current.clientWidth,
      height: 120,
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: '#38bdf8',
      lineWidth: 2,
      title: 'RSI (14)',
    });

    const rsiData = indexData.history
      .filter(c => c.rsi !== undefined && c.rsi !== null)
      .map(c => ({ time: c.date, value: Number(c.rsi) }));

    if (rsiData.length > 0) rsiSeries.setData(rsiData);

    // Overbought (70) and Oversold (30) Reference Lines
    rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Overbought (70)' });
    rsiSeries.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Oversold (30)' });

    const handleRsiResize = () => {
      if (rsiContainerRef.current) {
        rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleRsiResize);

    return () => {
      window.removeEventListener('resize', handleRsiResize);
      rsiChart.remove();
    };
  }, [showRSI, indexData]);

  if (!indexData || !indexData.quote) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <p className="text-muted">Loading live market chart feed...</p>
      </div>
    );
  }

  const indexName = indexData.indexName || 'Nifty 50';
  const spotPrice = indexData.quote.price || 0;
  const changePercent = indexData.quote.changePercent || 0;

  return (
    <div className="live-chart-module-container">
      {/* 1. Header Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BarChart2 size={24} color={themeColor || 'var(--nifty-color)'} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
              {indexName.toUpperCase()} INTERACTIVE LIVE CHART
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Real-time candlestick charts with customizable indicators, drawing tools, and Buy/Sell signal markers.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>SPOT PRICE</span>
            <div style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'JetBrains Mono' }} className={changePercent >= 0 ? 'text-up' : 'text-down'}>
              ₹{formatNumber(spotPrice)} ({changePercent >= 0 ? '+' : ''}{changePercent}%)
            </div>
          </div>

          <button className="timeframe-btn active" onClick={onRefresh} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh Chart
          </button>
        </div>
      </div>

      {/* 2. Interactive Control Bar (Timeframe & Indicator Toggles & Drawing Tools) */}
      <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        {/* Timeframe Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginRight: '4px' }}>TIMEFRAME:</span>
          {['1M', '5M', '15M', '1H', '1D'].map((tf) => (
            <button
              key={tf}
              className={`timeframe-btn ${activeTimeframe === tf ? 'active' : ''}`}
              onClick={() => setActiveTimeframe(tf)}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Indicators Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>INDICATORS:</span>
          
          <button 
            className={`timeframe-btn ${showSMA20 ? 'active' : ''}`} 
            onClick={() => setShowSMA20(!showSMA20)}
            style={{ fontSize: '11px', padding: '4px 8px', color: showSMA20 ? '#f59e0b' : 'var(--text-dim)' }}
          >
            SMA 20
          </button>

          <button 
            className={`timeframe-btn ${showSMA50 ? 'active' : ''}`} 
            onClick={() => setShowSMA50(!showSMA50)}
            style={{ fontSize: '11px', padding: '4px 8px', color: showSMA50 ? '#3b82f6' : 'var(--text-dim)' }}
          >
            SMA 50
          </button>

          <button 
            className={`timeframe-btn ${showSMA200 ? 'active' : ''}`} 
            onClick={() => setShowSMA200(!showSMA200)}
            style={{ fontSize: '11px', padding: '4px 8px', color: showSMA200 ? '#a855f7' : 'var(--text-dim)' }}
          >
            SMA 200
          </button>

          <button 
            className={`timeframe-btn ${showBB ? 'active' : ''}`} 
            onClick={() => setShowBB(!showBB)}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            Bollinger
          </button>

          <button 
            className={`timeframe-btn ${showRSI ? 'active' : ''}`} 
            onClick={() => setShowRSI(!showRSI)}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            RSI (14)
          </button>

          <button 
            className={`timeframe-btn ${showSignals ? 'active' : ''}`} 
            onClick={() => setShowSignals(!showSignals)}
            style={{ fontSize: '11px', padding: '4px 8px', color: showSignals ? '#10b981' : 'var(--text-dim)' }}
          >
            <Zap size={12} style={{ display: 'inline', marginRight: '3px' }} />
            Option Signals
          </button>
        </div>

        {/* Drawing Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>TOOLS:</span>
          
          <button 
            className={`timeframe-btn ${drawMode === 'horizontal' ? 'active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'horizontal' ? null : 'horizontal')}
            title="Click on chart to draw a horizontal Support/Resistance line"
            style={{ fontSize: '11px', padding: '4px 10px', background: drawMode === 'horizontal' ? 'rgba(245, 158, 11, 0.3)' : 'transparent' }}
          >
            <Edit3 size={12} style={{ display: 'inline', marginRight: '4px' }} />
            {drawMode === 'horizontal' ? 'Click Chart...' : '+ Draw Level'}
          </button>

          {drawnLines.length > 0 && (
            <button 
              className="timeframe-btn"
              onClick={() => setDrawnLines([])}
              title="Clear all drawn lines"
              style={{ fontSize: '11px', padding: '4px 8px', color: '#ef4444' }}
            >
              <Trash2 size={12} /> Clear ({drawnLines.length})
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Chart Canvas Viewport */}
      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', position: 'relative' }}>
        {recommendation && recommendation.signalTitle && (
          <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
            <span className={`badge ${recommendation.badgeClass}`} style={{ fontSize: '11px', padding: '3px 8px' }}>
              {recommendation.signalTitle}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-main)', fontFamily: 'JetBrains Mono' }}>
              Target: ₹{formatNumber(recommendation.levels.target1Spot)} | SL: ₹{formatNumber(recommendation.levels.stopLossSpot)}
            </span>
          </div>
        )}

        <div ref={chartContainerRef} style={{ width: '100%', height: '480px' }} />
      </div>

      {/* 4. RSI Sub-Chart Panel */}
      {showRSI && (
        <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>RELATIVE STRENGTH INDEX (RSI 14)</span>
            <span>Overbought: 70 | Oversold: 30</span>
          </div>
          <div ref={rsiContainerRef} style={{ width: '100%', height: '120px' }} />
        </div>
      )}

      {/* 5. Active Drawn Lines Legend */}
      {drawnLines.length > 0 && (
        <div className="glass-panel" style={{ padding: '14px 20px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 8px 0', color: 'var(--text-main)' }}>
            Active Support &amp; Resistance Drawn Lines
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {drawnLines.map((line) => (
              <div key={line.id} style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', borderLeft: `3px solid ${line.color}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{line.title}</span>
                <button 
                  onClick={() => setDrawnLines(drawnLines.filter(l => l.id !== line.id))}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

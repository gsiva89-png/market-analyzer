import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Zap,
  RefreshCw,
  Sliders,
  ExternalLink,
  Minimize2,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon,
  Sunset
} from 'lucide-react';

export default function OutOfBrowserWidget({
  data,
  activeIndex,
  setActiveIndex,
  onRefresh,
  theme,
  toggleTheme,
  isPiP = false,
  onDock
}) {
  const [activeWidgetTab, setActiveWidgetTab] = useState('premiums'); // 'premiums' | 'ticker' | 'strategy'

  if (!data) {
    return (
      <div className="pip-widget-empty glass-panel">
        <Activity className="animate-spin" size={24} style={{ color: '#00f2fe' }} />
        <span>Syncing Out-of-Browser Market Feed...</span>
      </div>
    );
  }

  const { quote, indexName, history, weekendAnalysis } = data;
  const price = quote?.price || 0;
  const change = quote?.change || 0;
  const changePercent = quote?.changePercent || 0;
  const isPositive = changePercent >= 0;

  // Latest weekend pair sample
  const latestPair = weekendAnalysis?.pairs?.[0] || {
    fridayClose: 24206.90,
    fridayVIX: '12.3%',
    mondayOpenClose: '24839.48 / 24211.00',
    tuesdayOpenClose: '24868.00 / 24052.05',
    sellCall: 24550,
    buyCall: 24800,
    sellPut: 24300,
    buyPut: 24050,
    netPremium: 20.04,
    netExit: 0.00,
    result: 'PROFIT (+20.04 pts)',
    lotReturn: 1303,
    roc: 3.43
  };

  const indexThemeColor =
    activeIndex === 'nifty50'
      ? '#00f2fe'
      : activeIndex === 'banknifty'
      ? '#a855f7'
      : '#f97316';

  return (
    <div className={`pip-widget-container ${theme === 'light' ? 'light-theme' : theme === 'nightshift' ? 'nightshift-theme' : ''}`}>
      {/* Top Drag & Control Bar */}
      <div className="pip-header glass-panel">
        <div className="pip-brand">
          <Activity size={16} style={{ color: indexThemeColor }} />
          <span className="pip-title">MARKET DESK HUD</span>
          {isPiP && <span className="pip-badge">ALWAYS-ON-TOP</span>}
        </div>
        <div className="pip-controls">
          <button className="pip-btn" onClick={onRefresh} title="Sync Market Data">
            <RefreshCw size={13} />
          </button>
          <button className="pip-btn" onClick={toggleTheme} title={`Theme: ${theme === 'dark' ? 'Dark Mode' : theme === 'light' ? 'Light Mode' : 'Night Shift'} (Click to cycle)`}>
            {theme === 'dark' && <Moon size={13} style={{ color: '#38bdf8' }} />}
            {theme === 'light' && <Sun size={13} style={{ color: '#f59e0b' }} />}
            {theme === 'nightshift' && <Sunset size={13} style={{ color: '#fb923c' }} />}
          </button>
          {onDock && (
            <button className="pip-btn" onClick={onDock} title="Dock back to main browser window">
              <Minimize2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Index Selector Bar */}
      <div className="pip-index-tabs">
        {[
          { id: 'nifty50', label: 'NIFTY 50', color: '#00f2fe' },
          { id: 'banknifty', label: 'BANK NIFTY', color: '#a855f7' },
          { id: 'sensex', label: 'SENSEX', color: '#f97316' }
        ].map(idx => (
          <button
            key={idx.id}
            className={`pip-tab ${activeIndex === idx.id ? 'active' : ''}`}
            style={{
              borderColor: activeIndex === idx.id ? idx.color : 'transparent',
              color: activeIndex === idx.id ? idx.color : 'inherit'
            }}
            onClick={() => setActiveIndex(idx.id)}
          >
            {idx.label}
          </button>
        ))}
      </div>

      {/* Spot Price Live Card */}
      <div className="pip-spot-card glass-panel" style={{ borderLeft: `3px solid ${indexThemeColor}` }}>
        <div className="pip-spot-left">
          <span className="pip-index-name">{indexName || 'NIFTY 50'}</span>
          <div className="pip-price-row">
            <span className="pip-price">{price ? price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</span>
            <span className={`pip-change-badge ${isPositive ? 'pos' : 'neg'}`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="pip-spot-right">
          <div className="pip-stat-mini">
            <span className="pip-stat-lbl">HIGH</span>
            <span className="pip-stat-val">{quote?.dayHigh ? quote.dayHigh.toFixed(2) : '-'}</span>
          </div>
          <div className="pip-stat-mini">
            <span className="pip-stat-lbl">LOW</span>
            <span className="pip-stat-val">{quote?.dayLow ? quote.dayLow.toFixed(2) : '-'}</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation inside Widget */}
      <div className="pip-subtabs">
        <button
          className={`pip-subtab ${activeWidgetTab === 'premiums' ? 'active' : ''}`}
          onClick={() => setActiveWidgetTab('premiums')}
        >
          Leg Premiums
        </button>
        <button
          className={`pip-subtab ${activeWidgetTab === 'strategy' ? 'active' : ''}`}
          onClick={() => setActiveWidgetTab('strategy')}
        >
          Hedging & Margin
        </button>
        <button
          className={`pip-subtab ${activeWidgetTab === 'ticker' ? 'active' : ''}`}
          onClick={() => setActiveWidgetTab('ticker')}
        >
          Market Stats
        </button>
      </div>

      {/* Tab Content 1: Leg Premium Breakdown */}
      {activeWidgetTab === 'premiums' && (
        <div className="pip-tab-content">
          <div className="pip-card glass-panel">
            <div className="pip-card-title">
              <Zap size={14} style={{ color: '#00f2fe' }} />
              <span>Leg Premium Breakdown</span>
              <span className="pip-tag-vix">HISTORICAL VIX</span>
            </div>

            <div className="pip-leg-grid">
              <div className="pip-leg-col">
                <span className="pip-leg-day">📅 FRI ENTRY</span>
                <span className="pip-leg-sub">Spot: 24206.90 &bull; VIX 12.3%</span>
                <div className="pip-leg-prices">
                  <div><span>SELL CALL (24550):</span> <span className="pos">+24.22</span></div>
                  <div><span>BUY CALL (24800):</span> <span className="neg">-4.18</span></div>
                  <div className="pip-net-highlight"><span>NET PREMIUM:</span> <span className="pos">+20.04</span></div>
                </div>
              </div>

              <div className="pip-leg-col">
                <span className="pip-leg-day">🔔 MON CLOSE</span>
                <span className="pip-leg-sub">Spot: 24211.00 &bull; VIX 13.3%</span>
                <div className="pip-leg-prices">
                  <div><span>SELL CALL:</span> 7.98</div>
                  <div><span>BUY CALL:</span> 1.02</div>
                  <div className="pip-net-highlight"><span>NET VALUE:</span> 6.95</div>
                </div>
              </div>

              <div className="pip-leg-col">
                <span className="pip-leg-day">⚡ TUE CLOSE</span>
                <span className="pip-leg-sub">Spot: 24052.05 &bull; VIX 13.0%</span>
                <div className="pip-leg-prices">
                  <div><span>SELL CALL:</span> 0.00</div>
                  <div><span>BUY CALL:</span> 0.00</div>
                  <div className="pip-net-highlight"><span>EXIT VALUE:</span> 0.00</div>
                </div>
              </div>
            </div>

            <div className="pip-result-banner pos">
              <CheckCircle2 size={16} />
              <div className="pip-result-info">
                <strong>Result: PROFIT (+20.04 pts)</strong>
                <span>Margin: ₹37,972 &bull; Lot Return: ₹1,303 &bull; Weekly ROC: +3.43%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Hedging & Margin Parameters */}
      {activeWidgetTab === 'strategy' && (
        <div className="pip-tab-content">
          <div className="pip-card glass-panel">
            <div className="pip-card-title">
              <Shield size={14} style={{ color: '#a855f7' }} />
              <span>Defensive Hedging Engine</span>
            </div>

            <div className="pip-hedge-status-box">
              <div className="pip-hedge-row">
                <span>Dynamic Margin Model:</span>
                <span className="badge-active">Auto (Dynamic)</span>
              </div>
              <div className="pip-hedge-row">
                <span>VIX Source:</span>
                <span className="pip-val-highlight">Historical Index VIX</span>
              </div>
              <div className="pip-hedge-row">
                <span>Delta Neutral Adjustments:</span>
                <span className="badge-inactive">Disabled</span>
              </div>
              <div className="pip-hedge-row">
                <span>Estimated Margin (Straddle/Spread):</span>
                <span className="pip-val-bold">₹37,972</span>
              </div>
            </div>

            <div className="pip-info-box">
              <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span>Friday Entry spot pricing modeled at ST = 6/365$. Tuesday exit remaining premium modeled at ST = 2/365$.</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 3: Market Stats */}
      {activeWidgetTab === 'ticker' && (
        <div className="pip-tab-content">
          <div className="pip-card glass-panel">
            <div className="pip-card-title">
              <Activity size={14} style={{ color: '#f97316' }} />
              <span>Technical Indicators Overview</span>
            </div>

            <div className="pip-stats-grid">
              <div className="pip-stat-card">
                <span>RSI (14)</span>
                <strong>{history?.[history.length - 1]?.rsi?.toFixed(1) || '54.2'}</strong>
              </div>
              <div className="pip-stat-card">
                <span>SMA (20)</span>
                <strong>{history?.[history.length - 1]?.sma20?.toFixed(1) || '24,180'}</strong>
              </div>
              <div className="pip-stat-card">
                <span>SMA (200)</span>
                <strong>{history?.[history.length - 1]?.sma200?.toFixed(1) || '23,410'}</strong>
              </div>
              <div className="pip-stat-card">
                <span>52W High</span>
                <strong>{quote?.fiftyTwoWeekHigh ? quote.fiftyTwoWeekHigh.toLocaleString('en-IN') : '-'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mini Footer */}
      <div className="pip-footer">
        <span>Stock Index Analyzer &bull; Out-of-Browser View</span>
      </div>
    </div>
  );
}

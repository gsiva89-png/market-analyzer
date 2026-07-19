import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { 
  TrendingUp, Activity, Layers, Calendar, Clock
} from 'lucide-react';
import { runBacktest } from '../../analysis.js';

export default function BacktesterModule({ indexData, activeIndex, timeframe, formatNumber, themeColor }) {
  // Strategy & Parameter State
  const [strategy, setStrategy] = useState('EXPIRY_CYCLE');
  const [entryDaysBeforeExpiry, setEntryDaysBeforeExpiry] = useState(2);
  const [exitDaysBeforeExpiry, setExitDaysBeforeExpiry] = useState(0);
  const [direction, setDirection] = useState('LONG');
  const [priceType, setPriceType] = useState('close');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [stopLossPct, setStopLossPct] = useState(1.5);
  const [targetProfitPct, setTargetProfitPct] = useState(3.0);
  const [slippagePct, setSlippagePct] = useState(0.05);

  // Indicator parameters
  const [fastPeriod, setFastPeriod] = useState(20);
  const [slowPeriod, setSlowPeriod] = useState(50);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStdDev, setBbStdDev] = useState(2);

  // Table filter state
  const [tradeFilter, setTradeFilter] = useState('ALL'); // 'ALL' | 'WIN' | 'LOSS'

  // Run backtest computation
  const backtestResult = useMemo(() => {
    if (!indexData || !indexData.history || indexData.history.length < 20) {
      return null;
    }

    const config = {
      strategy,
      entryDaysBeforeExpiry: Number(entryDaysBeforeExpiry),
      exitDaysBeforeExpiry: Number(exitDaysBeforeExpiry),
      direction,
      priceType,
      initialCapital: Number(initialCapital) || 100000,
      stopLossPct: Number(stopLossPct) || 0,
      targetProfitPct: Number(targetProfitPct) || 0,
      slippagePct: Number(slippagePct) || 0.05,
      fastPeriod: Number(fastPeriod),
      slowPeriod: Number(slowPeriod),
      rsiPeriod: Number(rsiPeriod),
      rsiOversold: Number(rsiOversold),
      rsiOverbought: Number(rsiOverbought),
      bbPeriod: Number(bbPeriod),
      bbStdDev: Number(bbStdDev),
    };

    return runBacktest(indexData.history, config);
  }, [
    indexData,
    strategy,
    entryDaysBeforeExpiry,
    exitDaysBeforeExpiry,
    direction,
    priceType,
    initialCapital,
    stopLossPct,
    targetProfitPct,
    slippagePct,
    fastPeriod,
    slowPeriod,
    rsiPeriod,
    rsiOversold,
    rsiOverbought,
    bbPeriod,
    bbStdDev,
  ]);

  if (!indexData || !indexData.history) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <p className="text-muted">Loading market historical candles for backtesting...</p>
      </div>
    );
  }

  if (!backtestResult || backtestResult.error || !backtestResult.summary) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-down)' }}>
        <p>{backtestResult?.error || 'Insufficient historical data available for backtesting.'}</p>
      </div>
    );
  }

  const { summary, equityCurve, trades } = backtestResult;

  const filteredTrades = trades.filter(t => {
    if (tradeFilter === 'WIN') return t.status === 'WIN';
    if (tradeFilter === 'LOSS') return t.status === 'LOSS';
    return true;
  });

  return (
    <div className="backtester-container">
      {/* 1. Header & Strategy Controls Panel */}
      <div className="glass-panel backtester-controls-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={22} color={themeColor || 'var(--nifty-color)'} />
              Algorithmic Strategy Backtester
            </h2>
            <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
              Test trading strategies against {indexData.indexName} historical data ({timeframe} timeframe, {indexData.history.length} candles).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--glass-border)' }}>
              {indexData.indexName} ({timeframe})
            </span>
          </div>
        </div>

        {/* Strategy Selector Tabs */}
        <div className="tabs-nav" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
          <button 
            className={`tab-btn ${strategy === 'EXPIRY_CYCLE' ? 'active' : ''}`}
            onClick={() => setStrategy('EXPIRY_CYCLE')}
          >
            <Calendar size={14} style={{ marginRight: '6px' }} />
            Expiry Cycle (N-Days)
          </button>
          <button 
            className={`tab-btn ${strategy === 'MA_CROSSOVER' ? 'active' : ''}`}
            onClick={() => setStrategy('MA_CROSSOVER')}
          >
            <TrendingUp size={14} style={{ marginRight: '6px' }} />
            MA Crossover
          </button>
          <button 
            className={`tab-btn ${strategy === 'RSI_REVERSION' ? 'active' : ''}`}
            onClick={() => setStrategy('RSI_REVERSION')}
          >
            <Activity size={14} style={{ marginRight: '6px' }} />
            RSI Reversal
          </button>
          <button 
            className={`tab-btn ${strategy === 'BOLLINGER_BANDS' ? 'active' : ''}`}
            onClick={() => setStrategy('BOLLINGER_BANDS')}
          >
            <Layers size={14} style={{ marginRight: '6px' }} />
            Bollinger Bands
          </button>
          <button 
            className={`tab-btn ${strategy === 'WEEKEND_HOLD' ? 'active' : ''}`}
            onClick={() => setStrategy('WEEKEND_HOLD')}
          >
            <Clock size={14} style={{ marginRight: '6px' }} />
            Weekend Hold
          </button>
        </div>

        {/* Parameters Form Grid */}
        <div className="backtester-form-grid">
          {/* Strategy-Specific Inputs */}
          {strategy === 'EXPIRY_CYCLE' && (
            <>
              <div className="form-group">
                <label className="form-label">
                  Entry Days Before Expiry: <strong style={{ color: themeColor }}>{entryDaysBeforeExpiry} Trading Days</strong>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="0" 
                    max="4" 
                    step="1"
                    value={entryDaysBeforeExpiry}
                    onChange={(e) => setEntryDaysBeforeExpiry(e.target.value)}
                    className="slider-input"
                  />
                  <span className="slider-value">{entryDaysBeforeExpiry}D</span>
                </div>
                <span className="form-hint">0 = Expiry Day (Thu), 1 = Wed, 2 = Tue, 3 = Mon, 4 = Fri</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Exit Days Before Expiry: <strong style={{ color: themeColor }}>{exitDaysBeforeExpiry === 0 ? 'On Expiry Day (0D)' : `${exitDaysBeforeExpiry}D Before`}</strong>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="1"
                    value={exitDaysBeforeExpiry}
                    onChange={(e) => setExitDaysBeforeExpiry(e.target.value)}
                    className="slider-input"
                  />
                  <span className="slider-value">{exitDaysBeforeExpiry}D</span>
                </div>
                <span className="form-hint">0 = Hold until Expiry Close, 1 = Exit Wednesday Close</span>
              </div>
            </>
          )}

          {strategy === 'MA_CROSSOVER' && (
            <>
              <div className="form-group">
                <label className="form-label">Fast Moving Average (Period):</label>
                <input 
                  type="number" 
                  value={fastPeriod} 
                  onChange={(e) => setFastPeriod(e.target.value)} 
                  className="num-input"
                  min="5" max="100"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slow Moving Average (Period):</label>
                <input 
                  type="number" 
                  value={slowPeriod} 
                  onChange={(e) => setSlowPeriod(e.target.value)} 
                  className="num-input"
                  min="10" max="200"
                />
              </div>
            </>
          )}

          {strategy === 'RSI_REVERSION' && (
            <>
              <div className="form-group">
                <label className="form-label">RSI Oversold (Entry Buy):</label>
                <input 
                  type="number" 
                  value={rsiOversold} 
                  onChange={(e) => setRsiOversold(e.target.value)} 
                  className="num-input"
                  min="10" max="45"
                />
              </div>
              <div className="form-group">
                <label className="form-label">RSI Overbought (Entry Sell):</label>
                <input 
                  type="number" 
                  value={rsiOverbought} 
                  onChange={(e) => setRsiOverbought(e.target.value)} 
                  className="num-input"
                  min="55" max="90"
                />
              </div>
            </>
          )}

          {strategy === 'BOLLINGER_BANDS' && (
            <>
              <div className="form-group">
                <label className="form-label">BB Period:</label>
                <input 
                  type="number" 
                  value={bbPeriod} 
                  onChange={(e) => setBbPeriod(e.target.value)} 
                  className="num-input"
                  min="5" max="50"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Std Dev Multiplier:</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={bbStdDev} 
                  onChange={(e) => setBbStdDev(e.target.value)} 
                  className="num-input"
                  min="1" max="4"
                />
              </div>
            </>
          )}

          {/* Common Risk & Execution Parameters */}
          <div className="form-group">
            <label className="form-label">Trade Direction:</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} className="select-input">
              <option value="LONG">LONG (Bullish)</option>
              <option value="SHORT">SHORT (Bearish)</option>
              <option value="BOTH">BOTH (Long & Short)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Initial Capital (₹):</label>
            <input 
              type="number" 
              value={initialCapital} 
              onChange={(e) => setInitialCapital(e.target.value)} 
              className="num-input"
              step="10000"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Stop Loss (%):</label>
            <input 
              type="number" 
              step="0.25"
              value={stopLossPct} 
              onChange={(e) => setStopLossPct(e.target.value)} 
              className="num-input"
              placeholder="0 = No Stop Loss"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target Profit (%):</label>
            <input 
              type="number" 
              step="0.5"
              value={targetProfitPct} 
              onChange={(e) => setTargetProfitPct(e.target.value)} 
              className="num-input"
              placeholder="0 = No Target Limit"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Price Execution:</label>
            <select value={priceType} onChange={(e) => setPriceType(e.target.value)} className="select-input">
              <option value="close">Daily Close Price</option>
              <option value="open">Daily Open Price</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. KPI Performance Summary Cards Grid */}
      <div className="backtester-kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Total Strategy Return</div>
          <div className={`stat-val ${summary.netProfit >= 0 ? 'text-up' : 'text-down'}`} style={{ fontSize: '24px', fontWeight: '800' }}>
            {summary.netProfit >= 0 ? '+' : ''}₹{formatNumber(summary.netProfit, 0)}
          </div>
          <div style={{ fontSize: '13px', display: 'flex', gap: '8px', marginTop: '4px' }}>
            <span className={summary.totalReturnPct >= 0 ? 'text-up' : 'text-down'} style={{ fontWeight: '700' }}>
              {summary.totalReturnPct >= 0 ? '+' : ''}{summary.totalReturnPct}% ROI
            </span>
            <span className="text-dim">vs Benchmark: {summary.benchmarkReturnPct >= 0 ? '+' : ''}{summary.benchmarkReturnPct}%</span>
          </div>
        </div>

        <div className="glass-panel stat-group-card">
          <div className="stat-label">Win Rate & Trades</div>
          <div className="stat-val text-main" style={{ fontSize: '24px', fontWeight: '800' }}>
            {summary.winRate}%
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span style={{ color: 'var(--color-up)', fontWeight: '600' }}>{summary.winCount} W</span> / <span style={{ color: 'var(--color-down)', fontWeight: '600' }}>{summary.lossCount} L</span> (Total: {summary.totalTrades})
          </div>
        </div>

        <div className="glass-panel stat-group-card">
          <div className="stat-label">Profit Factor</div>
          <div className="stat-val text-main" style={{ fontSize: '24px', fontWeight: '800' }}>
            {summary.profitFactor}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Gross Profit / Gross Loss Ratio
          </div>
        </div>

        <div className="glass-panel stat-group-card">
          <div className="stat-label">Max Drawdown</div>
          <div className="stat-val text-down" style={{ fontSize: '24px', fontWeight: '800' }}>
            -{summary.maxDrawdownPct}%
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Peak-to-Trough Portfolio Risk
          </div>
        </div>

        <div className="glass-panel stat-group-card">
          <div className="stat-label">Avg Trade Return</div>
          <div className={`stat-val ${summary.avgTradeReturn >= 0 ? 'text-up' : 'text-down'}`} style={{ fontSize: '24px', fontWeight: '800' }}>
            {summary.avgTradeReturn >= 0 ? '+' : ''}{summary.avgTradeReturn}%
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Avg Win: +{summary.avgWinPct}% | Avg Loss: {summary.avgLossPct}%
          </div>
        </div>

        <div className="glass-panel stat-group-card">
          <div className="stat-label">Best / Worst Trade</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>BEST</div>
              <div className="text-up" style={{ fontWeight: '700', fontSize: '16px' }}>
                {summary.bestTrade ? `+${summary.bestTrade.returnPct}%` : '-'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>WORST</div>
              <div className="text-down" style={{ fontWeight: '700', fontSize: '16px' }}>
                {summary.worstTrade ? `${summary.worstTrade.returnPct}%` : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Equity Curve & Drawdown Charts */}
      <div className="glass-panel chart-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
              Strategy Equity Curve vs Buy & Hold Benchmark
            </h3>
            <span className="text-muted" style={{ fontSize: '12px' }}>
              Starting Capital: ₹{formatNumber(summary.initialCapital, 0)} → Ending Capital: ₹{formatNumber(summary.finalCapital, 0)}
            </span>
          </div>
        </div>

        <div className="chart-container" style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis 
                yAxisId="left"
                stroke="#6b7280" 
                fontSize={11} 
                domain={['auto', 'auto']}
                tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(val, name) => [
                  name === 'equity' ? `₹${formatNumber(val, 0)}` : formatNumber(val, 2),
                  name === 'equity' ? 'Strategy Portfolio (₹)' : 'Benchmark Index'
                ]}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="equity" 
                stroke={themeColor || '#00f2fe'} 
                strokeWidth={2.5}
                dot={false}
                name="equity"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drawdown Area Chart */}
      <div className="glass-panel chart-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 12px 0' }}>Strategy Drawdown Timeline (%)</h3>
        <div style={{ height: '160px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} domain={[0, 'auto']} tickFormatter={(v) => `-${v}%`} />
              <Tooltip 
                contentStyle={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(val) => [`-${val}%`, 'Drawdown']}
              />
              <Area type="monotone" dataKey="drawdownPct" stroke="#ef4444" fill="rgba(239, 68, 68, 0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Detailed Trade Execution Log Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
            Trade Execution Log ({summary.totalTrades} Total Trades)
          </h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`tab-btn ${tradeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setTradeFilter('ALL')}
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              All ({trades.length})
            </button>
            <button 
              className={`tab-btn ${tradeFilter === 'WIN' ? 'active' : ''}`}
              onClick={() => setTradeFilter('WIN')}
              style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--color-up)' }}
            >
              Wins ({summary.winCount})
            </button>
            <button 
              className={`tab-btn ${tradeFilter === 'LOSS' ? 'active' : ''}`}
              onClick={() => setTradeFilter('LOSS')}
              style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--color-down)' }}
            >
              Losses ({summary.lossCount})
            </button>
          </div>
        </div>

        {filteredTrades.length === 0 ? (
          <p className="text-muted" style={{ padding: '20px 0', textAlign: 'center' }}>No trades match the current filter.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pivots-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Entry Date</th>
                  <th>Entry Price</th>
                  <th>Direction</th>
                  <th>Exit Date</th>
                  <th>Exit Price</th>
                  <th>Days Held</th>
                  <th>Exit Reason</th>
                  <th>P&L (₹)</th>
                  <th>Return (%)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t) => (
                  <tr key={t.tradeNo}>
                    <td style={{ fontWeight: '600', color: 'var(--text-dim)' }}>{t.tradeNo}</td>
                    <td>{t.entryDate}</td>
                    <td>₹{formatNumber(t.entryPrice, 2)}</td>
                    <td>
                      <span className={`badge ${t.direction === 'LONG' ? 'badge-long' : 'badge-short'}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td>{t.exitDate}</td>
                    <td>₹{formatNumber(t.exitPrice, 2)}</td>
                    <td>{t.daysHeld}d</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t.exitReason}</td>
                    <td className={t.pnlAmount >= 0 ? 'text-up' : 'text-down'} style={{ fontWeight: '700' }}>
                      {t.pnlAmount >= 0 ? '+' : ''}₹{formatNumber(t.pnlAmount, 2)}
                    </td>
                    <td className={t.returnPct >= 0 ? 'text-up' : 'text-down'} style={{ fontWeight: '700' }}>
                      {t.returnPct >= 0 ? '+' : ''}{t.returnPct}%
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'WIN' ? 'badge-win' : 'badge-loss'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

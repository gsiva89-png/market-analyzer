import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, ShieldAlert, Target, RefreshCw, Info, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, Zap, Award, Layers, Compass, History, AlertTriangle
} from 'lucide-react';
import { generateLiveOptionRecommendation } from '../utils/liveOptionEngine';

export default function LiveOptionSignalsModule({ indexData, liveTicks, historicalOI, onRefresh, formatNumber, themeColor }) {
  const [recommendation, setRecommendation] = useState(null);
  const [signalHistory, setSignalHistory] = useState([]);
  const [lastShiftAlert, setLastShiftAlert] = useState(null);

  useEffect(() => {
    if (indexData) {
      const rec = generateLiveOptionRecommendation(indexData, liveTicks, historicalOI);
      setRecommendation(rec);

      if (rec && rec.signalType) {
        setSignalHistory(prev => {
          if (prev.length === 0) {
            return [{ ...rec, time: rec.timestamp || new Date().toLocaleTimeString() }];
          }
          const lastRec = prev[prev.length - 1];
          if (lastRec.signalType !== rec.signalType || lastRec.indexName !== rec.indexName) {
            const shiftEvent = {
              indexName: rec.indexName || 'Nifty 50',
              fromSignal: lastRec.signalTitle,
              toSignal: rec.signalTitle,
              fromType: lastRec.signalType,
              toType: rec.signalType,
              fromBadge: lastRec.badgeClass,
              toBadge: rec.badgeClass,
              fromPrice: lastRec.spotPrice,
              toPrice: rec.spotPrice,
              fromTime: lastRec.timestamp || lastRec.time,
              toTime: rec.timestamp || new Date().toLocaleTimeString(),
              fromScore: lastRec.consensusScore,
              toScore: rec.consensusScore,
              fromAction: lastRec.suggestedAction,
              toAction: rec.suggestedAction,
            };
            setLastShiftAlert(shiftEvent);
            return [...prev, { ...rec, time: rec.timestamp || new Date().toLocaleTimeString() }];
          }
          return prev;
        });
      }
    }
  }, [indexData, liveTicks, historicalOI]);

  if (!indexData || !indexData.quote) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <p className="text-muted">Loading live market data feed for Option Signals...</p>
      </div>
    );
  }

  if (!recommendation || recommendation.status === 'LOADING') {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
        <p className="text-muted">Analyzing live technical indicators and OI build-up...</p>
      </div>
    );
  }

  const {
    spotPrice,
    changePercent,
    consensusScore,
    confidencePct,
    signalTitle,
    badgeClass,
    suggestedAction,
    suggestedStrike,
    estimatedPremium,
    levels,
    oiDetails,
    reasonsList,
    oiSignal,
    timestamp,
  } = recommendation;

  const isBullishSignal = consensusScore > 0;
  const isBearishSignal = consensusScore < 0;

  return (
    <div className="live-signals-container">
      {/* 1. Header & Live Ticker Control Card */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="status-dot"></span>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={22} color={themeColor || 'var(--nifty-color)'} />
              LIVE {(recommendation?.indexName || indexData?.indexName || 'Nifty 50').toUpperCase()} OPTION SIGNAL ADVISORY
            </h2>
          </div>
          <p className="text-muted" style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
            Real-time trade recommendations computed from live price action, RSI, OI dynamics, and Camarilla pivots.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{(recommendation?.indexName || indexData?.indexName || 'Nifty 50').toUpperCase()} SPOT</div>
            <div style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'JetBrains Mono' }} className={changePercent >= 0 ? 'text-up' : 'text-down'}>
              ₹{formatNumber(spotPrice)} ({changePercent >= 0 ? '+' : ''}{changePercent}%)
            </div>
          </div>

          <button 
            className="timeframe-btn active"
            onClick={onRefresh}
            title="Refresh Live Signals"
            style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} />
            Refresh Signals
          </button>
        </div>
      </div>

      {/* 2. Primary Recommendation Banner */}
      <div className="glass-panel signal-hero-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span className={`badge ${badgeClass}`} style={{ fontSize: '16px', padding: '6px 16px', borderRadius: '8px', letterSpacing: '0.5px' }}>
                {signalTitle}
              </span>
              <span className="text-dim" style={{ fontSize: '12px' }}>Updated at {timestamp}</span>
            </div>

            <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '8px 0 12px 0', letterSpacing: '-0.5px' }}>
              RECOMMENDED TRADE: <span style={{ color: isBullishSignal ? 'var(--color-up)' : isBearishSignal ? 'var(--color-down)' : 'var(--color-neutral)' }}>
                {recommendation?.indexShortName || 'NIFTY'} {suggestedStrike}
              </span>
            </h1>

            <div style={{ fontSize: '15px', color: 'var(--text-main)', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', borderLeft: `4px solid ${isBullishSignal ? 'var(--color-up)' : isBearishSignal ? 'var(--color-down)' : 'var(--color-neutral)'}` }}>
              <strong>Suggested Setup:</strong> {suggestedAction} (Estimated Premium ~₹{estimatedPremium})
            </div>
          </div>

          {/* Confidence Meter Box */}
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', minWidth: '220px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>SIGNAL CONFIDENCE</div>
            <div style={{ fontSize: '36px', fontWeight: '900', fontFamily: 'JetBrains Mono', color: isBullishSignal ? 'var(--color-up)' : isBearishSignal ? 'var(--color-down)' : 'var(--text-main)' }}>
              {confidencePct}%
            </div>
            
            {/* Progress bar */}
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', margin: '10px 0 8px 0' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${confidencePct}%`, 
                  background: isBullishSignal ? 'var(--color-up)' : isBearishSignal ? 'var(--color-down)' : 'var(--color-neutral)'
                }} 
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Consensus Score: {consensusScore > 0 ? `+${consensusScore}` : consensusScore} / 100
            </div>
          </div>
        </div>
      </div>

      {/* 3. INTRADAY SIGNAL HISTORY & SHIFT TRACKER (ALWAYS VISIBLE CARD) */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', borderLeft: lastShiftAlert ? '5px solid #f59e0b' : '5px solid #10b981' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={20} color={lastShiftAlert ? '#f59e0b' : '#10b981'} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
              INTRADAY SIGNAL HISTORY &amp; SHIFT TRACKER
            </h3>
          </div>
          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: lastShiftAlert ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: lastShiftAlert ? '#fde047' : '#34d399', fontWeight: '700' }}>
            {lastShiftAlert ? '⚠️ REVERSAL RECORDED' : '🟢 STABLE SIGNAL'}
          </span>
        </div>

        {lastShiftAlert ? (
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 12px 0', lineHeight: '1.5' }}>
              <strong>Recent Directional Shift:</strong> Signal for <strong>{lastShiftAlert.indexName}</strong> flipped from <span className={`badge ${lastShiftAlert.fromBadge}`} style={{ fontSize: '11px', padding: '2px 8px' }}>{lastShiftAlert.fromSignal}</span> at {lastShiftAlert.fromTime} ➔ <span className={`badge ${lastShiftAlert.toBadge}`} style={{ fontSize: '11px', padding: '2px 8px' }}>{lastShiftAlert.toSignal}</span> at {lastShiftAlert.toTime}.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>SPOT PRICE SHIFT</div>
                <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                  ₹{formatNumber(lastShiftAlert.fromPrice)} ➔ ₹{formatNumber(lastShiftAlert.toPrice)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>SCORE SHIFT</div>
                <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                  {lastShiftAlert.fromScore > 0 ? `+${lastShiftAlert.fromScore}` : lastShiftAlert.fromScore} ➔ {lastShiftAlert.toScore > 0 ? `+${lastShiftAlert.toScore}` : lastShiftAlert.toScore} / 100
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            No directional signal reversals recorded in the current session. The algorithm maintains consistent <strong>{signalTitle}</strong> alignment for {recommendation?.indexName || 'Nifty 50'}.
          </p>
        )}

        {/* Signal History Audit Trail Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="correlation-matrix-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 14px' }}>Time</th>
                <th style={{ padding: '10px 14px' }}>Index</th>
                <th style={{ padding: '10px 14px' }}>Advisory Signal</th>
                <th style={{ padding: '10px 14px' }}>Spot Price</th>
                <th style={{ padding: '10px 14px' }}>Score</th>
                <th style={{ padding: '10px 14px' }}>Suggested Setup</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '12px' }}>
              {signalHistory && signalHistory.length > 0 ? (
                signalHistory.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>{item.time || timestamp}</td>
                    <td style={{ padding: '10px 14px', fontWeight: '600' }}>{item.indexName || 'Nifty 50'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${item.badgeClass}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}>
                        {item.signalTitle}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono', fontWeight: '700' }}>₹{formatNumber(item.spotPrice)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono' }}>{item.consensusScore > 0 ? `+${item.consensusScore}` : item.consensusScore} / 100</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{item.suggestedAction}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Signal history log active. Session updates recorded in real-time.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. "WHY THIS CALL WAS TAKEN" — Detailed Rationale Panel */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', borderLeft: `5px solid ${themeColor || 'var(--nifty-color)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Info size={20} color={themeColor || 'var(--nifty-color)'} />
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
            WHY THIS CALL WAS TAKEN (Trade Rationale &amp; Key Triggers)
          </h3>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
          The algorithm analyzed live technical indicators, Open Interest build-up, and pivot levels to determine this setup based on the following verified market triggers:
        </p>

        {reasonsList && reasonsList.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {reasonsList.map((reason, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '12px', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--glass-border)' 
                }}
              >
                <CheckCircle2 size={16} color={isBullishSignal ? '#10b981' : isBearishSignal ? '#ef4444' : '#eab308'} style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                  {reason}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No specific breakout triggers fired. Market is currently consolidating in a neutral range.</p>
        )}
      </div>

      {/* 5. Trade Execution Blueprint Cards (4 Grid Cards) */}
      <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
        Trade Execution Blueprint &amp; Price Levels
      </h3>

      <div className="backtester-kpi-grid" style={{ marginBottom: '24px' }}>
        {/* Card 1: Entry Spot */}
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Entry Spot Level</div>
          <div className="stat-val text-main" style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono' }}>
            ₹{formatNumber(levels.entrySpot)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Current {recommendation?.indexName || indexData?.indexName || 'Nifty 50'} Spot Trigger
          </div>
        </div>

        {/* Card 2: Target 1 */}
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Target 1 (T1)</div>
          <div className="stat-val text-up" style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono' }}>
            ₹{formatNumber(levels.target1Spot)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isBullishSignal ? 'Resistance 1 / Pivot Target' : 'Support 1 / Target Level'}
          </div>
        </div>

        {/* Card 3: Target 2 */}
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Target 2 (T2)</div>
          <div className="stat-val text-up" style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono' }}>
            ₹{formatNumber(levels.target2Spot)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Extended Stretch Target
          </div>
        </div>

        {/* Card 4: Stop Loss & R:R */}
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Stop Loss &amp; Risk / Reward</div>
          <div className="stat-val text-down" style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'JetBrains Mono' }}>
            ₹{formatNumber(levels.stopLossSpot)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Spot Invalidations</span>
            <strong style={{ color: 'var(--text-main)' }}>R:R {levels.riskRewardRatio}</strong>
          </div>
        </div>
      </div>

      {/* 6. Live Technical Drivers Grid */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
          Live Technical Indicators Summary
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>FUTURES OI &amp; OI CHANGE</div>
            <div style={{ fontSize: '15px', fontWeight: '700', marginTop: '4px', color: (oiSignal || '').includes('LONG') ? 'var(--color-up)' : (oiSignal || '').includes('SHORT') ? 'var(--color-down)' : 'var(--text-main)' }}>
              {(oiSignal || 'NEUTRAL').replace(/_/g, ' ')}
            </div>
            {oiDetails && oiDetails.totalOI !== null && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>
                OI: {formatNumber(oiDetails.totalOI, 0)} ({oiDetails.netOIChange >= 0 ? '+' : ''}{formatNumber(oiDetails.netOIChange, 0)}{oiDetails.oiChangePct !== null ? ` / ${oiDetails.oiChangePct >= 0 ? '+' : ''}${oiDetails.oiChangePct}%` : ''})
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>RSI (14-PERIOD)</div>
            <div style={{ fontSize: '15px', fontWeight: '700', marginTop: '4px' }}>
              {indexData.history[indexData.history.length - 1]?.rsi ? indexData.history[indexData.history.length - 1].rsi.toFixed(1) : '-'}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>MOVING AVERAGES</div>
            <div style={{ fontSize: '13px', fontWeight: '600', marginTop: '4px', color: 'var(--text-muted)' }}>
              SMA 20: ₹{formatNumber(indexData.history[indexData.history.length - 1]?.sma20, 0)}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>CAMARILLA PIVOTS</div>
            <div style={{ fontSize: '13px', fontWeight: '600', marginTop: '4px', color: 'var(--text-muted)' }}>
              S3: ₹{formatNumber(indexData.stats?.pivots?.camarilla?.s3, 0)} | R3: ₹{formatNumber(indexData.stats?.pivots?.camarilla?.r3, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Quick Cheat Sheet for Open Interest (OI) Build-Up */}
      <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Compass size={20} color={themeColor || 'var(--nifty-color)'} />
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
            QUICK CHEAT SHEET FOR OPEN INTEREST (OI) BUILD-UP
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="correlation-matrix-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Price Action</th>
                <th style={{ padding: '12px 16px' }}>Open Interest (OI)</th>
                <th style={{ padding: '12px 16px' }}>Market Interpretation</th>
                <th style={{ padding: '12px 16px' }}>Option Strategy</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '13px' }}>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', background: oiSignal === 'LONG_BUILDUP' ? 'rgba(16, 185, 129, 0.15)' : 'transparent' }}>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-up)' }}>Price UP 📈</td>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-up)' }}>OI UP ⬆️</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-up)' }}>Long Build-Up</span> (Fresh Buyers)
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge badge-strong-buy" style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '11px' }}>BUY CALL (CE)</span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', background: oiSignal === 'SHORT_COVERING' ? 'rgba(16, 185, 129, 0.15)' : 'transparent' }}>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-up)' }}>Price UP 📈</td>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-down)' }}>OI DOWN ⬇️</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: '700', color: '#10b981' }}>Short Covering</span> (Sellers Exiting)
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge badge-buy" style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '11px' }}>BUY CALL (CE)</span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', background: oiSignal === 'SHORT_BUILDUP' ? 'rgba(239, 68, 68, 0.15)' : 'transparent' }}>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-down)' }}>Price DOWN 📉</td>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-up)' }}>OI UP ⬆️</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--color-down)' }}>Short Build-Up</span> (Fresh Sellers)
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge badge-strong-sell" style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '11px' }}>BUY PUT (PE)</span>
                </td>
              </tr>
              <tr style={{ background: oiSignal === 'LONG_UNWINDING' ? 'rgba(239, 68, 68, 0.15)' : 'transparent' }}>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-down)' }}>Price DOWN 📉</td>
                <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-down)' }}>OI DOWN ⬇️</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: '700', color: '#ef4444' }}>Long Unwinding</span> (Buyers Exiting)
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge badge-sell" style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '11px' }}>BUY PUT (PE)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

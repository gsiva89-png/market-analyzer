import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw, Info, CheckCircle2, Zap, Compass, History, Clock,
  TrendingUp, TrendingDown, Activity, Shield, AlertTriangle
} from "lucide-react";
import { generateLiveOptionRecommendation } from "../utils/liveOptionEngine";

// ── CSS injection (once) ────────────────────────────────────────────────────
const _SID = "los-styles-v2";
if (!document.getElementById(_SID)) {
  const s = document.createElement("style");
  s.id = _SID;
  s.textContent = [
    "@keyframes flipIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes oiRowIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}",
    "@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.25}}",
    "@keyframes pressureFill{from{width:0}to{width:var(--pw)}}",
    ".los-flip-in{animation:flipIn 0.45s ease-out;}",
    ".los-oi-row{animation:oiRowIn 0.3s ease-out;}",
    ".los-live-dot{animation:pulseDot 1.3s infinite;}",
  ].join(" ");
  document.head.appendChild(s);
}

// ── Constants ────────────────────────────────────────────────────────────────
const CONFIRM_TICKS   = 20;  // requires 20 consecutive seconds of opposite signal before flip
const OI_SPIKE_PCT    = 1.0; // single-tick OI change % that counts as spike
const MAX_OI_TRACK    = 60;  // rolling OI display entries
const MAX_HISTORY     = 50;  // max decision history rows

// ── Helpers ──────────────────────────────────────────────────────────────────
const signalDirectionLabel = (st) => {
  if (!st) return "";
  if (st.includes("CE")) return "BULLISH (CE)";
  if (st.includes("PE")) return "BEARISH (PE)";
  return "NEUTRAL";
};

export default function LiveOptionSignalsModule({
  indexData, liveTicks, historicalOI, onRefresh, formatNumber, themeColor
}) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [lockedRec,       setLockedRec]       = useState(null);  // stable confirmed signal
  const [rawRec,          setRawRec]           = useState(null);  // latest engine output (for OI display)
  const [signalHistory,   setSignalHistory]   = useState([]);    // significant events only
  const [lastShiftAlert,  setLastShiftAlert]  = useState(null);
  const [oiLiveTrack,     setOiLiveTrack]     = useState([]);    // rolling OI readings
  const [pendingTicks,    setPendingTicks]    = useState(0);     // confirmation progress
  const [pendingType,     setPendingType]     = useState(null);  // pending signal type
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState(null); // detailed shift modal
  const [remainingLockSeconds, setRemainingLockSeconds] = useState(900); // 15-min lock countdown
  const [is15MinLocked, setIs15MinLocked]               = useState(true);
  const [liveTime,        setLiveTime]        = useState(new Date().toLocaleTimeString());
  const [engineTick,      setEngineTick]      = useState(0);

  // ── Refs (signal-lock hysteresis) ─────────────────────────────────────────
  const latestIndexData    = useRef(indexData);
  const latestLiveTicks    = useRef(liveTicks);
  const latestHistoricalOI = useRef(historicalOI);
  const lockedSignalRef    = useRef(null);
  const lockedRecRef       = useRef(null);
  const pendingSignalRef   = useRef(null);
  const pendingTicksRef    = useRef(0);
  const stableTicksRef     = useRef(0);

  useEffect(() => { latestIndexData.current    = indexData;    }, [indexData]);
  useEffect(() => { latestLiveTicks.current    = liveTicks;    }, [liveTicks]);
  useEffect(() => { latestHistoricalOI.current = historicalOI; }, [historicalOI]);

  // ── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setLiveTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Engine — runs every second ────────────────────────────────────────────
  const runEngine = useCallback(() => {
    const iData = latestIndexData.current;
    if (!iData?.quote) return;
    const rec = generateLiveOptionRecommendation(
      iData, latestLiveTicks.current, latestHistoricalOI.current
    );
    if (!rec || rec.status === "LOADING") return;

    const now = new Date().toLocaleTimeString();
    setEngineTick(c => c + 1);
    setRawRec(rec);

    // ── Always update rolling OI display ─────────────────────────────────
    setOiLiveTrack(prev => {
      const entry = {
        time:         now,
        oiSignal:     rec.oiSignal || "NEUTRAL",
        totalOI:      rec.oiDetails?.totalOI,
        netOIChange:  rec.oiDetails?.netOIChange,
        oiChangePct:  rec.oiDetails?.oiChangePct,
        spotPrice:    rec.spotPrice,
        consec:       rec.oiMomentumData?.consecutiveConfirm || 0,
        singlePct:    rec.oiMomentumData?.singleTickOIPct    || 0,
        score:        rec.consensusScore,
      };
      return [...prev.slice(-(MAX_OI_TRACK - 1)), entry];
    });

    // ── OI spike detection (log to history, does NOT change locked signal) ─
    const spikePct = rec.oiMomentumData?.singleTickOIPct || 0;
    if (spikePct >= OI_SPIKE_PCT) {
      setSignalHistory(prev => {
        const last = prev[prev.length - 1];
        if (last?.eventType === "OI_SPIKE" && last?.time === now) return prev;
        const spike = {
          ...rec, time: now,
          eventType:  "OI_SPIKE",
          eventLabel: `OI Spike: +${spikePct.toFixed(2)}% single-tick surge`,
        };
        return [...prev.slice(-(MAX_HISTORY - 1)), spike];
      });
    }

    // ── Signal lock / hysteresis logic ────────────────────────────────────
    if (!lockedSignalRef.current) {
      // First valid signal — lock immediately
      lockedSignalRef.current  = rec.signalType;
      lockedRecRef.current     = rec;
      stableTicksRef.current   = 1;
      setLockedRec(rec);
      setSignalHistory([{
        ...rec, time: now,
        eventType:  "INITIAL",
        eventLabel: "Session Start — Initial Signal",
      }]);
      return;
    }

    if (rec.signalType === lockedSignalRef.current) {
      // Same direction — stable signal lock
      stableTicksRef.current++;
      if (pendingSignalRef.current !== null) {
        pendingSignalRef.current = null;
        pendingTicksRef.current  = 0;
        setPendingTicks(0);
        setPendingType(null);
      }
      // Update live spotPrice, confidencePct, consensusScore, levels, and timestamp every second
      // while keeping the trade recommendation direction and strike locked
      const updatedLocked = {
        ...rec,
        signalType:      lockedRecRef.current?.signalType      || rec.signalType,
        signalTitle:     lockedRecRef.current?.signalTitle     || rec.signalTitle,
        badgeClass:      lockedRecRef.current?.badgeClass      || rec.badgeClass,
        suggestedAction: lockedRecRef.current?.suggestedAction || rec.suggestedAction,
        suggestedStrike: lockedRecRef.current?.suggestedStrike || rec.suggestedStrike,
      };
      lockedRecRef.current = updatedLocked;
      setLockedRec(updatedLocked);
      return;
    }

    // Different signal direction — accumulate confirmation ticks
    if (pendingSignalRef.current !== rec.signalType) {
      pendingSignalRef.current = rec.signalType;
      pendingTicksRef.current  = 1;
    } else {
      pendingTicksRef.current++;
    }
    setPendingTicks(pendingTicksRef.current);
    setPendingType(pendingSignalRef.current);

    // Keep live spot price, confidence, and levels fresh on lockedRec
    // while pending opposite signal is accumulating confirmation ticks
    const updatedLockedPending = {
      ...rec,
      signalType:      lockedRecRef.current?.signalType      || rec.signalType,
      signalTitle:     lockedRecRef.current?.signalTitle     || rec.signalTitle,
      badgeClass:      lockedRecRef.current?.badgeClass      || rec.badgeClass,
      suggestedAction: lockedRecRef.current?.suggestedAction || rec.suggestedAction,
      suggestedStrike: lockedRecRef.current?.suggestedStrike || rec.suggestedStrike,
    };
    setLockedRec(updatedLockedPending);

    // ── Confirmed flip? ───────────────────────────────────────────────────
    if (pendingTicksRef.current >= CONFIRM_TICKS) {
      const prevRec = lockedRecRef.current || {};
      const flipEvent = {
        ...rec, time: now,
        eventType:       "SIGNAL_FLIP",
        eventLabel:      "Trade Signal Shifted",
        fromSignalTitle: prevRec.signalTitle,
        fromBadge:       prevRec.badgeClass,
        fromPrice:       prevRec.spotPrice,
        fromScore:       prevRec.consensusScore,
        fromStrike:      prevRec.suggestedStrike,
        fromAction:      prevRec.suggestedAction,
      };
      lockedSignalRef.current  = rec.signalType;
      lockedRecRef.current     = rec;
      stableTicksRef.current   = 0;
      pendingSignalRef.current = null;
      pendingTicksRef.current  = 0;
      setLockedRec(rec);
      setLastShiftAlert(flipEvent);
      setSignalHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), flipEvent]);
      setPendingTicks(0);
      setPendingType(null);
    }
  }, []);

  useEffect(() => {
    runEngine();
    const id = setInterval(runEngine, 1000);
    return () => clearInterval(id);
  }, [runEngine]);

  // ── Sync 15-Minute Background Signal State & History ─────────────────────
  useEffect(() => {
    const fetchSignalState = async () => {
      try {
        const idxKey = (indexData?.indexName || 'nifty50').toLowerCase().includes('bank') ? 'banknifty'
          : (indexData?.indexName || 'nifty50').toLowerCase().includes('sensex') ? 'sensex' : 'nifty50';
        const res = await fetch(`/api/futures-oi/signal-state?index=${idxKey}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data) {
          if (Array.isArray(data.signalHistory) && data.signalHistory.length > 0) {
            setSignalHistory(data.signalHistory);
          }
          if (data.lastShiftAlert) {
            setLastShiftAlert(data.lastShiftAlert);
          }
          if (data.lockedRec) {
            setLockedRec(data.lockedRec);
            lockedRecRef.current = data.lockedRec;
            lockedSignalRef.current = data.lockedRec.signalType;
          }
          setRemainingLockSeconds(data.remainingLockSeconds || 0);
          setIs15MinLocked(data.is15MinLocked);
        }
      } catch (e) {
        // Silent catch
      }
    };

    fetchSignalState();
    const interval = setInterval(fetchSignalState, 1000);
    return () => clearInterval(interval);
  }, [indexData?.indexName]);

  const formatLockTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (!indexData?.quote) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
        <p className="text-muted">Loading live market data feed for Option Signals...</p>
      </div>
    );
  }
  if (!lockedRec) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 16px auto" }}></div>
        <p className="text-muted">Initializing live signal engine — analyzing OI momentum...</p>
      </div>
    );
  }

  // ── Derive display values from LOCKED rec ────────────────────────────────
  const {
    spotPrice, changePercent, consensusScore, confidencePct,
    signalTitle, badgeClass, suggestedAction, suggestedStrike,
    estimatedPremium, levels, oiDetails, reasonsList, oiSignal, timestamp,
  } = lockedRec;

  const isBull = consensusScore > 0;
  const isBear = consensusScore < 0;
  const themeC = themeColor || "var(--nifty-color)";
  const indexLabel = lockedRec?.indexName || indexData?.indexName || "Nifty 50";

  // OI live (from rawRec — updates every second)
  const liveOI      = rawRec?.oiDetails?.totalOI;
  const liveOISig   = rawRec?.oiSignal || "NEUTRAL";
  const liveConsec  = rawRec?.oiMomentumData?.consecutiveConfirm || 0;
  const liveScore   = rawRec?.consensusScore ?? 0;
  const liveSingle  = rawRec?.oiMomentumData?.singleTickOIPct || 0;

  // Pressure gauge
  const pressurePct   = Math.round((pendingTicks / CONFIRM_TICKS) * 100);
  const pendingLabel  = signalDirectionLabel(pendingType);
  const isUnderPressure = pendingTicks > 0;

  // Last 10 OI rows (newest first) for live table
  const oiDisplay = [...oiLiveTrack].reverse().slice(0, 10);

  const oiColor = (sig) => {
    if (!sig) return "var(--text-dim)";
    if (sig.includes("LONG_BUILDUP") || sig.includes("SHORT_COVERING")) return "var(--color-up)";
    if (sig.includes("SHORT_BUILDUP") || sig.includes("LONG_UNWINDING"))  return "var(--color-down)";
    return "var(--text-muted)";
  };

  return (
    <div className="live-signals-container">

      {/* ── 1. Header ────────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: "18px 24px", marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="status-dot los-live-dot"></span>
            <h2 style={{ fontSize: "19px", fontWeight: "800", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Zap size={20} color={themeC} />
              LIVE {indexLabel.toUpperCase()} OPTION SIGNAL ADVISORY
            </h2>
          </div>
          <p className="text-muted" style={{ fontSize: "11px", margin: "3px 0 0 0" }}>
            Signal locked until sustained OI + multi-factor confluence confirms a true directional shift.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "3px", justifyContent: "flex-end" }}>
              <Clock size={10} />{liveTime}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "1px" }}>
              OI ticks: <strong style={{ color: themeC }}>#{engineTick}</strong>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>{indexLabel.toUpperCase()} SPOT</div>
            <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "JetBrains Mono" }} className={changePercent >= 0 ? "text-up" : "text-down"}>
              &#8377;{formatNumber(spotPrice)} <span style={{ fontSize: "13px" }}>({changePercent >= 0 ? "+" : ""}{changePercent}%)</span>
            </div>
          </div>
          <button className="timeframe-btn active" onClick={onRefresh} style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={13} />Refresh
          </button>
        </div>
      </div>

      {/* ── 2. Locked Recommended Trade ──────────────────────────────────────── */}
      <div className="glass-panel signal-hero-card" style={{ padding: "24px 28px", marginBottom: "18px", borderTop: `3px solid ${isBull ? "var(--color-up)" : isBear ? "var(--color-down)" : "var(--color-neutral)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <span className={`badge ${badgeClass}`} style={{ fontSize: "15px", padding: "5px 16px", borderRadius: "8px" }}>{signalTitle}</span>
              <span style={{
                fontSize: "11px",
                background: is15MinLocked ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)",
                color: is15MinLocked ? "#34d399" : "#fde047",
                border: `1px solid ${is15MinLocked ? "rgba(16,185,129,0.4)" : "rgba(245,158,11,0.4)"}`,
                padding: "4px 12px",
                borderRadius: "6px",
                fontWeight: "700",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}>
                &#128274; {is15MinLocked ? `15-MIN TRADE LOCK ACTIVE (${formatLockTimer(remainingLockSeconds)} hold remaining)` : `15-MIN HOLD COMPLETE — Watching Reversal Triggers`}
              </span>
              <span className="text-dim" style={{ fontSize: "11px" }}>since {timestamp}</span>
            </div>
            <h1 style={{ fontSize: "26px", fontWeight: "900", margin: "6px 0 10px 0", letterSpacing: "-0.5px" }}>
              RECOMMENDED TRADE:{" "}
              <span style={{ color: isBull ? "var(--color-up)" : isBear ? "var(--color-down)" : "var(--color-neutral)" }}>
                {lockedRec?.indexShortName || "NIFTY"} {suggestedStrike}
              </span>
            </h1>
            <div style={{ fontSize: "14px", color: "var(--text-main)", background: "rgba(255,255,255,0.03)", padding: "9px 14px", borderRadius: "8px", borderLeft: `4px solid ${isBull ? "var(--color-up)" : isBear ? "var(--color-down)" : "var(--color-neutral)"}` }}>
              <strong>Suggested Setup:</strong> {suggestedAction} &nbsp;(Est. Premium ~&#8377;{estimatedPremium})
            </div>
          </div>

          {/* Confidence */}
          <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--glass-border)", borderRadius: "12px", padding: "18px", minWidth: "210px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "5px" }}>SIGNAL CONFIDENCE</div>
            <div style={{ fontSize: "34px", fontWeight: "900", fontFamily: "JetBrains Mono", color: isBull ? "var(--color-up)" : isBear ? "var(--color-down)" : "var(--text-main)" }}>
              {confidencePct}%
            </div>
            <div style={{ height: "5px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden", margin: "8px 0 6px" }}>
              <div style={{ height: "100%", width: `${confidencePct}%`, background: isBull ? "var(--color-up)" : isBear ? "var(--color-down)" : "var(--color-neutral)", transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Consensus: {consensusScore > 0 ? "+" : ""}{consensusScore} / 100</div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px", fontFamily: "JetBrains Mono" }}>
              Locked &middot; changes only on confirmed shift
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Signal Pressure Gauge (replaces the ticking history) ─────────── */}
      <div className="glass-panel" style={{ padding: "20px 24px", marginBottom: "18px", borderLeft: isUnderPressure ? "5px solid #f59e0b" : "5px solid #10b981" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity size={18} color={isUnderPressure ? "#f59e0b" : "#10b981"} />
            <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>SIGNAL MOMENTUM PRESSURE</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", padding: "3px 9px", borderRadius: "4px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontWeight: "700", fontFamily: "JetBrains Mono" }}>
              OI tick #{engineTick}
            </span>
            <span style={{ fontSize: "10px", padding: "3px 9px", borderRadius: "4px", background: isUnderPressure ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)", color: isUnderPressure ? "#fde047" : "#34d399", fontWeight: "700" }}>
              {isUnderPressure ? `BUILDING \u2192 ${pendingLabel}` : "SIGNAL STABLE"}
            </span>
          </div>
        </div>

        {/* Live OI state row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "14px" }}>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>LIVE OI SIGNAL (20-tick window)</div>
            <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "3px", color: oiColor(liveOISig) }}>
              {liveOISig.replace(/_/g, " ")}
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>CONSEC. CONFIRMING TICKS</div>
            <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "3px", color: liveConsec >= 3 ? "var(--color-up)" : liveConsec > 0 ? "#f59e0b" : "var(--text-muted)" }}>
              {liveConsec} / 5
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>RAW ENGINE SCORE</div>
            <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "3px", color: liveScore > 0 ? "var(--color-up)" : liveScore < 0 ? "var(--color-down)" : "var(--text-muted)" }}>
              {liveScore > 0 ? "+" : ""}{liveScore} / 100
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>SINGLE-TICK OI CHANGE</div>
            <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "3px", color: liveSingle >= OI_SPIKE_PCT ? "#f59e0b" : "var(--text-muted)" }}>
              {liveSingle.toFixed(3)}%{liveSingle >= OI_SPIKE_PCT ? " ⚡ SPIKE" : ""}
            </div>
          </div>
        </div>

        {/* Flip confirmation progress */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: isUnderPressure ? "#fde047" : "var(--text-muted)", fontWeight: "600" }}>
              {isUnderPressure
                ? `FLIP CONFIRMATION: ${pendingTicks} / ${CONFIRM_TICKS} ticks \u2192 ${pendingLabel}`
                : `Stable — no directional challenge. Needs ${CONFIRM_TICKS} sustained ticks to flip.`}
            </span>
            <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono", color: isUnderPressure ? "#fde047" : "var(--text-dim)", fontWeight: "700" }}>{pressurePct}%</span>
          </div>
          <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "6px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${pressurePct}%`,
              background: pressurePct >= 100 ? "#ef4444" : pressurePct >= 66 ? "#f59e0b" : "#6366f1",
              transition: "width 0.4s ease, background 0.3s",
              borderRadius: "6px",
            }} />
          </div>
        </div>
      </div>

      {/* ── 4. Live OI Rolling Tracker (updates every second — pure data) ─────── */}
      <div className="glass-panel" style={{ padding: "20px 24px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <Activity size={18} color={themeC} />
          <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>LIVE OI ROLLING TRACKER</h3>
          <span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "auto" }}>Updates every 1s &middot; last 10 of {oiLiveTrack.length} ticks</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="correlation-matrix-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase" }}>
                <th style={{ padding: "8px 12px" }}>Time</th>
                <th style={{ padding: "8px 12px" }}>OI Signal</th>
                <th style={{ padding: "8px 12px" }}>Total OI</th>
                <th style={{ padding: "8px 12px" }}>Net OI Change</th>
                <th style={{ padding: "8px 12px" }}>OI Chg %</th>
                <th style={{ padding: "8px 12px" }}>Consec</th>
                <th style={{ padding: "8px 12px" }}>Single-Tick %</th>
                <th style={{ padding: "8px 12px" }}>Spot</th>
                <th style={{ padding: "8px 12px" }}>Score</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: "11px" }}>
              {oiDisplay.length > 0 ? oiDisplay.map((row, idx) => (
                <tr key={`${row.time}-${idx}`} className={idx === 0 ? "los-oi-row" : ""} style={{ borderBottom: "1px solid var(--glass-border)", background: row.singlePct >= OI_SPIKE_PCT ? "rgba(245,158,11,0.08)" : idx === 0 ? "rgba(99,102,241,0.06)" : "transparent" }}>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{row.time}</td>
                  <td style={{ padding: "7px 12px", fontWeight: "700", color: oiColor(row.oiSignal) }}>{row.oiSignal.replace(/_/g, " ")}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: "var(--text-muted)" }}>{row.totalOI ? formatNumber(row.totalOI, 0) : "-"}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: row.netOIChange >= 0 ? "var(--color-up)" : "var(--color-down)" }}>
                    {row.netOIChange != null ? (row.netOIChange >= 0 ? "+" : "") + formatNumber(row.netOIChange, 0) : "-"}
                  </td>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: row.oiChangePct >= 0 ? "var(--color-up)" : "var(--color-down)" }}>
                    {row.oiChangePct != null ? (row.oiChangePct >= 0 ? "+" : "") + row.oiChangePct + "%" : "-"}
                  </td>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: row.consec >= 3 ? "var(--color-up)" : row.consec > 0 ? "#f59e0b" : "var(--text-dim)" }}>
                    {row.consec}
                  </td>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: row.singlePct >= OI_SPIKE_PCT ? "#f59e0b" : "var(--text-dim)" }}>
                    {row.singlePct.toFixed(3)}%{row.singlePct >= OI_SPIKE_PCT ? " ⚡" : ""}
                  </td>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: "var(--text-main)" }}>&#8377;{formatNumber(row.spotPrice)}</td>
                  <td style={{ padding: "7px 12px", fontFamily: "JetBrains Mono", color: row.score > 0 ? "var(--color-up)" : row.score < 0 ? "var(--color-down)" : "var(--text-muted)" }}>
                    {row.score > 0 ? "+" : ""}{row.score}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="9" style={{ padding: "12px", textAlign: "center", color: "var(--text-dim)" }}>Waiting for live OI ticks...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--text-dim)", textAlign: "right" }}>
          OI data rolls every second. Spike threshold: &gt;{OI_SPIKE_PCT}% single-tick change &#9889;
        </div>
      </div>

      {/* ── 5. INTRADAY SIGNAL HISTORY (significant events only) ─────────────── */}
      <div className="glass-panel" style={{ padding: "20px 24px", marginBottom: "18px", borderLeft: lastShiftAlert ? "5px solid #f59e0b" : "5px solid #10b981" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <History size={18} color={lastShiftAlert ? "#f59e0b" : "#10b981"} />
            <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>INTRADAY SIGNAL HISTORY &amp; SHIFT TRACKER</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", padding: "3px 9px", borderRadius: "4px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontWeight: "700" }}>
              {signalHistory.filter(e => e.eventType === "SIGNAL_FLIP").length} trade shifts
            </span>
            <span style={{ fontSize: "10px", padding: "3px 9px", borderRadius: "4px", background: lastShiftAlert ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)", color: lastShiftAlert ? "#fde047" : "#34d399", fontWeight: "700" }}>
              {lastShiftAlert ? "REVERSAL RECORDED" : "STABLE"}
            </span>
          </div>
        </div>

        {/* Most recent shift detail */}
        {lastShiftAlert && (
          <div className="los-flip-in" style={{ background: "rgba(245,158,11,0.07)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(245,158,11,0.3)", marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-main)", lineHeight: "1.6" }}>
              <strong>Last Confirmed Shift</strong> at {lastShiftAlert.time} &mdash; from{" "}
              <span className={`badge ${lastShiftAlert.fromBadge}`} style={{ fontSize: "10px", padding: "2px 7px" }}>{lastShiftAlert.fromSignalTitle}</span>
              {" "}&#8594;{" "}
              <span className={`badge ${lastShiftAlert.badgeClass}`} style={{ fontSize: "10px", padding: "2px 7px" }}>{lastShiftAlert.signalTitle}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: "8px", marginTop: "10px" }}>
              <div><div style={{ fontSize: "10px", color: "var(--text-dim)" }}>SPOT SHIFT</div><div style={{ fontSize: "13px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px" }}>&#8377;{formatNumber(lastShiftAlert.fromPrice)} &#8594; &#8377;{formatNumber(lastShiftAlert.spotPrice)}</div></div>
              <div><div style={{ fontSize: "10px", color: "var(--text-dim)" }}>SCORE SHIFT</div><div style={{ fontSize: "13px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px" }}>{lastShiftAlert.fromScore > 0 ? "+" : ""}{lastShiftAlert.fromScore} &#8594; {lastShiftAlert.consensusScore > 0 ? "+" : ""}{lastShiftAlert.consensusScore}</div></div>
              <div><div style={{ fontSize: "10px", color: "var(--text-dim)" }}>STRIKE SHIFT</div><div style={{ fontSize: "12px", fontWeight: "600", marginTop: "2px" }}>{lastShiftAlert.fromStrike} &#8594; <span style={{ color: "var(--text-main)" }}>{lastShiftAlert.suggestedStrike}</span></div></div>
            </div>
          </div>
        )}

        {/* Decision log table */}
        <div style={{ overflowX: "auto" }}>
          <table className="correlation-matrix-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase" }}>
                <th style={{ padding: "9px 12px" }}>Time</th>
                <th style={{ padding: "9px 12px" }}>Event</th>
                <th style={{ padding: "9px 12px" }}>Signal</th>
                <th style={{ padding: "9px 12px" }}>Strike</th>
                <th style={{ padding: "9px 12px" }}>Spot</th>
                <th style={{ padding: "9px 12px" }}>Score</th>
                <th style={{ padding: "9px 12px" }}>Confidence</th>
                <th style={{ padding: "9px 12px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: "11px" }}>
              {[...signalHistory].reverse().map((ev, idx) => {
                const isFlip = ev.eventType === "SIGNAL_FLIP";
                const isSpike = ev.eventType === "OI_SPIKE";
                return (
                  <tr
                    key={`${ev.time}-${idx}`}
                    className={idx === 0 ? "los-flip-in" : ""}
                    onClick={() => setSelectedHistoryEvent(ev)}
                    title="Click to view detailed trade shift rationale and execution breakdown"
                    style={{
                      borderBottom: "1px solid var(--glass-border)",
                      background: isFlip ? "rgba(245,158,11,0.12)" : isSpike ? "rgba(245,158,11,0.06)" : "transparent",
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                  >
                    <td style={{ padding: "8px 12px", fontFamily: "JetBrains Mono", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{ev.time}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {isFlip  && <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", background: "rgba(245,158,11,0.25)", color: "#fde047", fontWeight: "700" }}>TRADE SHIFT</span>}
                      {isSpike && <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: "700" }}>OI SPIKE &#9889;</span>}
                      {!isFlip && !isSpike && <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>{ev.eventLabel || ev.eventType}</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}><span className={`badge ${ev.badgeClass}`} style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px" }}>{ev.signalTitle}</span></td>
                    <td style={{ padding: "8px 12px", fontFamily: "JetBrains Mono", fontSize: "11px", color: "var(--text-main)" }}>{ev.suggestedStrike || "-"}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "JetBrains Mono", fontWeight: "700", color: (ev.changePercent || 0) >= 0 ? "var(--color-up)" : "var(--color-down)" }}>&#8377;{formatNumber(ev.spotPrice)}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "JetBrains Mono", color: ev.consensusScore > 0 ? "var(--color-up)" : ev.consensusScore < 0 ? "var(--color-down)" : "var(--text-muted)" }}>{ev.consensusScore > 0 ? "+" : ""}{ev.consensusScore}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "JetBrains Mono" }}><span style={{ color: ev.confidencePct >= 70 ? "var(--color-up)" : ev.confidencePct >= 50 ? "#f59e0b" : "var(--color-down)" }}>{ev.confidencePct}%</span></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: "10px", color: "#a5b4fc", fontWeight: "600", textDecoration: "underline" }}>View Details &rarr;</span>
                    </td>
                  </tr>
                );
              })}
              {signalHistory.length === 0 && (
                <tr><td colSpan="8" style={{ padding: "12px", textAlign: "center", color: "var(--text-dim)" }}>Waiting for initial signal lock...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--text-dim)", textAlign: "right" }}>
          💡 Click any row to view detailed trade shift rationale, spot/score delta &amp; execution blueprint.
        </div>
      </div>

      {/* ── 6. WHY THIS CALL WAS TAKEN ───────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: "20px 24px", marginBottom: "18px", borderLeft: `5px solid ${themeC}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Info size={18} color={themeC} />
          <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>WHY THIS CALL WAS TAKEN (Trade Rationale &amp; Key Triggers)</h3>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Multi-factor analysis at the time this signal was locked. OI momentum uses 20-tick rolling window; score reflects sustained directional pressure:
        </p>
        {reasonsList && reasonsList.length > 0 ? (
          <div style={{ display: "grid", gap: "8px" }}>
            {reasonsList.map((reason, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                <CheckCircle2 size={14} color={isBull ? "#10b981" : isBear ? "#ef4444" : "#eab308"} style={{ marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "var(--text-main)", lineHeight: "1.5" }}>{reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No specific breakout triggers fired. Neutral consolidation zone.</p>
        )}
      </div>

      {/* ── 7. Trade Execution Blueprint ────────────────────────────────────────*/}
      <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 14px 0" }}>Trade Execution Blueprint &amp; Price Levels</h3>
      <div className="backtester-kpi-grid" style={{ marginBottom: "20px" }}>
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Entry Spot Level</div>
          <div className="stat-val text-main" style={{ fontSize: "22px", fontWeight: "800", fontFamily: "JetBrains Mono" }}>&#8377;{formatNumber(levels.entrySpot)}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Current {indexLabel} Spot</div>
        </div>
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Target 1 (T1)</div>
          <div className="stat-val text-up" style={{ fontSize: "22px", fontWeight: "800", fontFamily: "JetBrains Mono" }}>&#8377;{formatNumber(levels.target1Spot)}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{isBull ? "Resistance 1 / Pivot" : "Support 1 / Target"}</div>
        </div>
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Target 2 (T2)</div>
          <div className="stat-val text-up" style={{ fontSize: "22px", fontWeight: "800", fontFamily: "JetBrains Mono" }}>&#8377;{formatNumber(levels.target2Spot)}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Extended Stretch Target</div>
        </div>
        <div className="glass-panel stat-group-card">
          <div className="stat-label">Stop Loss &amp; R:R</div>
          <div className="stat-val text-down" style={{ fontSize: "22px", fontWeight: "800", fontFamily: "JetBrains Mono" }}>&#8377;{formatNumber(levels.stopLossSpot)}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "flex", justifyContent: "space-between" }}>
            <span>Invalidation Level</span>
            <strong style={{ color: "var(--text-main)" }}>R:R {levels.riskRewardRatio}</strong>
          </div>
        </div>
      </div>

      {/* ── 8. Technical Indicators ──────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 14px 0" }}>Live Technical Indicators Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>FUTURES OI SIGNAL (LOCKED)</div>
            <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "3px", color: oiColor(oiSignal) }}>{(oiSignal || "NEUTRAL").replace(/_/g, " ")}</div>
            {oiDetails && oiDetails.totalOI !== null && (
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", fontFamily: "JetBrains Mono" }}>
                OI: {formatNumber(oiDetails.totalOI, 0)} ({oiDetails.netOIChange >= 0 ? "+" : ""}{formatNumber(oiDetails.netOIChange, 0)}{oiDetails.oiChangePct != null ? ` / ${oiDetails.oiChangePct >= 0 ? "+" : ""}${oiDetails.oiChangePct}%` : ""})
              </div>
            )}
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>RSI (14-PERIOD)</div>
            <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "3px" }}>
              {indexData.history[indexData.history.length - 1]?.rsi
                ? indexData.history[indexData.history.length - 1].rsi.toFixed(1)
                : "-"}
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>MOVING AVERAGES</div>
            <div style={{ fontSize: "12px", fontWeight: "600", marginTop: "3px", color: "var(--text-muted)" }}>
              SMA 20: &#8377;{formatNumber(indexData.history[indexData.history.length - 1]?.sma20, 0)}
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>CAMARILLA PIVOTS</div>
            <div style={{ fontSize: "12px", fontWeight: "600", marginTop: "3px", color: "var(--text-muted)" }}>
              S3: &#8377;{formatNumber(indexData.stats?.pivots?.camarilla?.s3, 0)} | R3: &#8377;{formatNumber(indexData.stats?.pivots?.camarilla?.r3, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* ── 9. OI Cheat Sheet ─────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: "20px 24px", marginTop: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <Compass size={18} color={themeC} />
          <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>OI BUILD-UP INTERPRETATION GUIDE</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="correlation-matrix-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
                <th style={{ padding: "10px 14px" }}>Price</th>
                <th style={{ padding: "10px 14px" }}>OI (Rolling 20-tick)</th>
                <th style={{ padding: "10px 14px" }}>Interpretation</th>
                <th style={{ padding: "10px 14px" }}>Strategy</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: "12px" }}>
              {[
                { price: "UP", oi: "UP", interp: "Long Build-Up", sub: "Fresh Buyers", color: "var(--color-up)", badge: "badge-strong-buy", strategy: "BUY CALL (CE)", sig: "LONG_BUILDUP" },
                { price: "UP", oi: "DOWN", interp: "Short Covering", sub: "Sellers Exiting", color: "#10b981", badge: "badge-buy", strategy: "BUY CALL (CE)", sig: "SHORT_COVERING" },
                { price: "DOWN", oi: "UP", interp: "Short Build-Up", sub: "Fresh Sellers", color: "var(--color-down)", badge: "badge-strong-sell", strategy: "BUY PUT (PE)", sig: "SHORT_BUILDUP" },
                { price: "DOWN", oi: "DOWN", interp: "Long Unwinding", sub: "Buyers Exiting", color: "#ef4444", badge: "badge-sell", strategy: "BUY PUT (PE)", sig: "LONG_UNWINDING" },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: i < 3 ? "1px solid var(--glass-border)" : "none", background: liveOISig === row.sig ? "rgba(99,102,241,0.12)" : "transparent" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "700", color: row.price === "UP" ? "var(--color-up)" : "var(--color-down)" }}>Price {row.price}</td>
                  <td style={{ padding: "10px 14px", fontWeight: "700", color: row.oi === "UP" ? "var(--color-up)" : "var(--color-down)" }}>OI {row.oi}</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ fontWeight: "700", color: row.color }}>{row.interp}</span> ({row.sub}){liveOISig === row.sig ? " \u2b50 LIVE" : ""}</td>
                  <td style={{ padding: "10px 14px" }}><span className={`badge ${row.badge}`} style={{ padding: "3px 10px", borderRadius: "4px", fontSize: "10px" }}>{row.strategy}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 10. Detailed Signal Shift Breakdown Modal ──────────────────────────── */}
      {selectedHistoryEvent && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }} onClick={() => setSelectedHistoryEvent(null)}>
          <div className="glass-panel los-flip-in" style={{
            maxWidth: "680px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "28px",
            border: "1px solid rgba(245,158,11,0.4)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            background: "rgba(18, 20, 29, 0.98)"
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "14px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "4px", background: "rgba(245,158,11,0.25)", color: "#fde047", fontWeight: "700" }}>
                    {selectedHistoryEvent.eventType === "SIGNAL_FLIP" ? "TRADE SHIFT DETAILED ANALYSIS" : selectedHistoryEvent.eventType === "OI_SPIKE" ? "OI SPIKE EVENT DETAILED BREAKDOWN" : "INITIAL LOCK SNAPSHOT"}
                  </span>
                  <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono", color: "var(--text-dim)" }}>
                    Time: {selectedHistoryEvent.time}
                  </span>
                </div>
                <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, color: "var(--text-main)" }}>
                  {selectedHistoryEvent.signalTitle}
                </h2>
              </div>
              <button onClick={() => setSelectedHistoryEvent(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "var(--text-main)", borderRadius: "6px", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px", fontWeight: "700" }}>
                &times;
              </button>
            </div>

            {/* Shift Comparison Grid (for SIGNAL_FLIP) */}
            {selectedHistoryEvent.eventType === "SIGNAL_FLIP" && (
              <div style={{ background: "rgba(245,158,11,0.08)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(245,158,11,0.25)", marginBottom: "18px" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
                  <strong>CONFIRMED DIRECTIONAL REVERSAL:</strong>{" "}
                  <span className={`badge ${selectedHistoryEvent.fromBadge}`} style={{ fontSize: "10px", padding: "2px 7px" }}>{selectedHistoryEvent.fromSignalTitle}</span>
                  {" "}&#8594;{" "}
                  <span className={`badge ${selectedHistoryEvent.badgeClass}`} style={{ fontSize: "10px", padding: "2px 7px" }}>{selectedHistoryEvent.signalTitle}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>SPOT SHIFT</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px" }}>
                      &#8377;{formatNumber(selectedHistoryEvent.fromPrice)} &#8594; &#8377;{formatNumber(selectedHistoryEvent.spotPrice)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>SCORE SHIFT</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px" }}>
                      {selectedHistoryEvent.fromScore > 0 ? "+" : ""}{selectedHistoryEvent.fromScore} &#8594; {selectedHistoryEvent.consensusScore > 0 ? "+" : ""}{selectedHistoryEvent.consensusScore}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>RECOMMENDED STRIKE</div>
                    <div style={{ fontSize: "13px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px", color: "var(--text-main)" }}>
                      {selectedHistoryEvent.fromStrike || "-"} &#8594; {selectedHistoryEvent.suggestedStrike}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Why This Signal Was Triggered */}
            <div style={{ marginBottom: "18px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#a5b4fc", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Why Signal Changed — Verified Triggers at {selectedHistoryEvent.time}
              </h4>
              <div style={{ display: "grid", gap: "8px" }}>
                {selectedHistoryEvent.reasonsList && selectedHistoryEvent.reasonsList.length > 0 ? (
                  selectedHistoryEvent.reasonsList.map((reason, rIdx) => (
                    <div key={rIdx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                      <CheckCircle2 size={14} color="#10b981" style={{ marginTop: "2px", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", color: "var(--text-main)", lineHeight: "1.5" }}>{reason}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{selectedHistoryEvent.eventLabel || "Market consolidation zone."}</div>
                )}
              </div>
            </div>

            {/* Execution Levels Snapshot at Event Time */}
            {selectedHistoryEvent.levels && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#a5b4fc", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Execution Blueprint Snapshot
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                  <div style={{ background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>ENTRY SPOT</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px" }}>&#8377;{formatNumber(selectedHistoryEvent.spotPrice)}</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>TARGET 1</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px", color: "var(--color-up)" }}>&#8377;{formatNumber(selectedHistoryEvent.levels.target1Spot)}</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>STOP LOSS</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px", color: "var(--color-down)" }}>&#8377;{formatNumber(selectedHistoryEvent.levels.stopLossSpot)}</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>RISK : REWARD</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", fontFamily: "JetBrains Mono", marginTop: "2px", color: "#f59e0b" }}>{selectedHistoryEvent.levels.riskRewardRatio}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--glass-border)", paddingTop: "14px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                Verified shift log entry &bull; 20-second confirmation shield active
              </span>
              <button onClick={() => setSelectedHistoryEvent(null)} className="timeframe-btn active" style={{ padding: "8px 18px", fontSize: "12px", cursor: "pointer" }}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

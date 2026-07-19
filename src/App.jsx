import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import OutOfBrowserWidget from './components/OutOfBrowserWidget';
import BacktesterModule from './components/BacktesterModule';
import LiveOptionSignalsModule from './components/LiveOptionSignalsModule';
import LiveChartModule from './components/LiveChartModule';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Layers,
  Percent,
  AlertTriangle,
  RefreshCw,
  Sliders,
  BarChart2,
  Info,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Sunset,
  ExternalLink,
  Monitor,
  ChevronDown,
  Layout,
  Pin,
  Zap
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeIndex, setActiveIndex] = useState('nifty50');
  const [timeframe, setTimeframe] = useState('1Y');
  const [activeTab, setActiveTab] = useState('charts');

  // Out-of-Browser states & window handles
  const [pipWindow, setPipWindow] = useState(null);
  const [popoutWin, setPopoutWin] = useState(null);
  const [isOobMenuOpen, setIsOobMenuOpen] = useState(false);

  useEffect(() => {
    const bodyClass = theme === 'light' ? 'light-theme' : theme === 'nightshift' ? 'nightshift-theme' : '';
    document.body.className = bodyClass;
    if (pipWindow && pipWindow.document) {
      pipWindow.document.body.className = bodyClass;
    }
    if (popoutWin && !popoutWin.closed && popoutWin.document) {
      popoutWin.document.body.className = bodyClass;
    }
    localStorage.setItem('theme', theme);
  }, [theme, pipWindow, popoutWin]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'nightshift';
      return 'dark';
    });
  };

  // BroadcastChannel for cross-window state sync
  useEffect(() => {
    let channel;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('market_analyzer_oob_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'CHANGE_INDEX') {
          setActiveIndex(event.data.index);
        } else if (event.data?.type === 'TOGGLE_THEME') {
          setTheme(prev => {
            if (prev === 'dark') return 'light';
            if (prev === 'light') return 'nightshift';
            return 'dark';
          });
        } else if (event.data?.type === 'SET_THEME') {
          if (event.data.theme) setTheme(event.data.theme);
        }
      };
    }
    return () => {
      if (channel) channel.close();
    };
  }, []);

  // Helper to copy styles into new pop-out/PiP window document
  const copyStylesToSubwindow = (subDoc) => {
    Array.from(document.styleSheets).forEach(styleSheet => {
      try {
        if (styleSheet.cssRules) {
          const newStyleEl = subDoc.createElement('style');
          Array.from(styleSheet.cssRules).forEach(rule => {
            newStyleEl.appendChild(subDoc.createTextNode(rule.cssText));
          });
          subDoc.head.appendChild(newStyleEl);
        } else if (styleSheet.href) {
          const newLinkEl = subDoc.createElement('link');
          newLinkEl.rel = 'stylesheet';
          newLinkEl.href = styleSheet.href;
          subDoc.head.appendChild(newLinkEl);
        }
      } catch (e) {
        console.warn('Style copy warning:', e);
      }
    });

    // Copy Google Fonts & Link elements
    Array.from(document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')).forEach(link => {
      subDoc.head.appendChild(link.cloneNode(true));
    });
  };

  // 1. Launch / Toggle Document Picture-in-Picture (Always-On-Top Floating Widget)
  const handleTogglePiP = async () => {
    setIsOobMenuOpen(false);

    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    if (!('documentPictureInPicture' in window)) {
      alert('Document Picture-in-Picture API is not supported in this browser version. Opening portable Pop-Out Window instead.');
      handleOpenPopout();
      return;
    }

    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 440,
        height: 680,
      });

      pipWin.document.title = 'Market Desk Floating HUD | Stock Index Analyzer';
      copyStylesToSubwindow(pipWin.document);

      pipWin.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(pipWin);
    } catch (err) {
      console.error('Error launching Document Picture-in-Picture:', err);
      alert('Could not open Picture-in-Picture window: ' + err.message);
    }
  };

  // 2. Launch Standalone Detached Pop-Out Window
  const handleOpenPopout = () => {
    setIsOobMenuOpen(false);

    if (popoutWin && !popoutWin.closed) {
      popoutWin.focus();
      return;
    }

    const popWin = window.open(
      '',
      'MarketAnalyzerPopout',
      'width=460,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );

    if (!popWin) {
      alert('Pop-up window was blocked by browser. Please allow popups for localhost.');
      return;
    }

    popWin.document.title = 'Stock Index Analyzer — Pop-Out Display';
    copyStylesToSubwindow(popWin.document);

    popWin.addEventListener('unload', () => {
      setPopoutWin(null);
    });

    setPopoutWin(popWin);
  };

  
  // Chart configurations
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showSMA200, setShowSMA200] = useState(false);
  const [showBB, setShowBB] = useState(false);
  
  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexData, setIndexData] = useState(null);
  const [correlationData, setCorrelationData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [fridayTuesdayReport, setFridayTuesdayReport] = useState(null);
  const [tuesdayThursdayReport, setTuesdayThursdayReport] = useState(null);
  

  const calculateModeledOutcome = (pct) => {
    const sorted = [...thresholds].sort((a, b) => a.val - b.val);
    const t1 = sorted[0];
    const t2 = sorted[1];
    const t3 = sorted[2];
    const t4 = sorted[3];
    const t5 = sorted[4];
    const t6 = sorted[5];

    if (pct < t1.val) {
      return t1.outcome;
    } else if (pct >= t1.val && pct < t2.val) {
      const ratio = (pct - t1.val) / (t2.val - t1.val);
      return t1.outcome + ratio * (t2.outcome - t1.outcome);
    } else if (pct >= t2.val && pct < t3.val) {
      const ratio = (pct - t2.val) / (t3.val - t2.val);
      return t2.outcome + ratio * (t3.outcome - t2.outcome);
    } else if (pct >= t3.val && pct < t4.val) {
      const ratio = (pct - t3.val) / (t4.val - t3.val);
      return t3.outcome + ratio * (t4.outcome - t3.outcome);
    } else if (pct >= t4.val && pct < t5.val) {
      const ratio = (pct - t4.val) / (t5.val - t4.val);
      return t4.outcome + ratio * (t5.outcome - t4.outcome);
    } else if (pct >= t5.val && pct < t6.val) {
      const ratio = (pct - t5.val) / (t6.val - t5.val);
      return t5.outcome + ratio * (t6.outcome - t5.outcome);
    } else {
      return t6.outcome;
    }
  };

  const [ftIndex, setFtIndex] = useState('nifty50');
  const [ttIndex, setTtIndex] = useState('sensex');
  const [ftSubTab, setFtSubTab] = useState('overview');
  const [ttSubTab, setTtSubTab] = useState('overview');

  // Nifty Futures OI Tracker States
  const [liveTicks, setLiveTicks] = useState([]);
  const [liveWindowSize, setLiveWindowSize] = useState(60);
  const [liveConnected, setLiveConnected] = useState(false);

  const [historicalOI, setHistoricalOI] = useState([]);
  const [histStartDate, setHistStartDate] = useState('');
  const [histEndDate, setHistEndDate] = useState('');
  const [histBuildupFilter, setHistBuildupFilter] = useState('ALL');
  const [histThreshold, setHistThreshold] = useState(0);

  const getOneYearAgoDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [ftStartDate, setFtStartDate] = useState(getOneYearAgoDate());
  const [ftEndDate, setFtEndDate] = useState(getTodayDate());
  const [ttStartDate, setTtStartDate] = useState(getOneYearAgoDate());
  const [ttEndDate, setTtEndDate] = useState(getTodayDate());

  // Custom Threshold Modeler States
  const [thresholdIndex, setThresholdIndex] = useState('nifty50');
  const [thresholdReport, setThresholdReport] = useState(null);
  const [threshStartDate, setThreshStartDate] = useState(getOneYearAgoDate());
  const [threshEndDate, setThreshEndDate] = useState(getTodayDate());
  const [thresholds, setThresholds] = useState([
    { val: 0.27, outcome: -2.7 },
    { val: 0.40, outcome: 0.0 },
    { val: 0.88, outcome: 10.0 },
    { val: 1.10, outcome: 10.0 },
    { val: 1.60, outcome: 0.0 },
    { val: 1.90, outcome: -8.0 }
  ]);

  const [threshSortKey, setThreshSortKey] = useState('fridayDate');
  const [threshSortOrder, setThreshSortOrder] = useState('desc');
  const [threshSearchText, setThreshSearchText] = useState('');
  const [selectedThreshWeek, setSelectedThreshWeek] = useState(null);

  // Black-Scholes pricing helper functions
  const normalCDF = (x) => {
    const p = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;

    const t = 1.0 / (1.0 + p * Math.abs(x));
    const sigma = 1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x) * 
                  ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;

    return x >= 0 ? sigma : 1.0 - sigma;
  };

  const blackScholes = (S, K, T, r, sigma, optionType) => {
    if (T <= 0) {
      if (optionType === 'call') return Math.max(0, S - K);
      return Math.max(0, K - S);
    }
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    if (optionType === 'call') {
      return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
    } else {
      return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
    }
  };

  // Option Simulator States
  const [optStrategy, setOptStrategy] = useState('condor'); 
  const [customLegs, setCustomLegs] = useState([
    { action: 'sell', type: 'put', offset: -1.5 },
    { action: 'sell', type: 'call', offset: 1.5 }
  ]);
  const [optSellDist, setOptSellDist] = useState(1.5);
  const [optBuyDist, setOptBuyDist] = useState(2.5);
  const [optVIX, setOptVIX] = useState(15.0);
  const [useHistVIX, setUseHistVIX] = useState(true); // true = use historical India VIX per pair
  const [useAutoMargin, setUseAutoMargin] = useState(true); // true = dynamically calculate margins
  const [enableAdj, setEnableAdj] = useState(false);
  const [adjTriggerType, setAdjTriggerType] = useState('breach'); // 'breach', 'distance'
  const [adjTriggerDist, setAdjTriggerDist] = useState(0.5); // % distance
  const [adjAction, setAdjAction] = useState('roll_untested_atm'); // 'roll_untested_atm', 'roll_untested_halfway', 'close_position'
  const [optAdjFilter, setOptAdjFilter] = useState('all'); // 'all', 'static', 'adjusted', 'rolled', 'closed'
  const [optNetPremFilter, setOptNetPremFilter] = useState('all'); // 'all', 'positiveEntry', 'debitEntry', 'decayed50', 'decayed80', 'profitableExit', 'unprofitableExit'
  const [optActiveAdjModal, setOptActiveAdjModal] = useState(null); // week pair details for the popup modal
  const [optMarginStraddle, setOptMarginStraddle] = useState(150000);
  const [optMarginStrangle, setOptMarginStrangle] = useState(120000);
  const [optMarginCondor, setOptMarginCondor] = useState(45000);
  const [optStartDate, setOptStartDate] = useState('2025-09-01');
  const [optEndDate, setOptEndDate] = useState(getTodayDate());
  const [optSearchText, setOptSearchText] = useState('');
  const [optSortKey, setOptSortKey] = useState('fridayDate');
  const [optSortOrder, setOptSortOrder] = useState('desc');
  const [optReport, setOptReport] = useState(null);
  const [selectedOptWeek, setSelectedOptWeek] = useState(null);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [optColumnMode, setOptColumnMode] = useState('all'); // 'all', 'premiums', 'strikes', 'spots'






  const processReportData = (report, startDate, endDate, dateKey) => {
    if (!report || !report.pairs) return null;

    const filteredPairs = report.pairs.filter(p => {
      const d = p[dateKey];
      return d >= startDate && d <= endDate;
    });

    if (filteredPairs.length === 0) {
      return {
        pairs: [],
        summary: {
          totalWeeks: 0,
          upWeeks: 0,
          downWeeks: 0,
          winRate: 0,
          avgPoints: 0,
          avgAbsPoints: 0,
          avgPct: 0,
          maxGain: { pointsMoved: 0, fridayDate: '-', tuesdayDate: '-' },
          maxLoss: { pointsMoved: 0, fridayDate: '-', tuesdayDate: '-' },
          currentStreak: 0,
          streakDirection: 'UP'
        },
        distribution: { absolute: [], signed: [] },
        yearlySeasonality: [],
        monthlySeasonality: [],
        streaks: []
      };
    }

    // 1. Calculate Summary Stats
    const totalWeeks = filteredPairs.length;
    const upWeeks = filteredPairs.filter(p => p.direction === 'UP').length;
    const downWeeks = totalWeeks - upWeeks;
    const winRate = Number(((upWeeks / totalWeeks) * 100).toFixed(2));

    const sumPoints = filteredPairs.reduce((s, p) => s + p.pointsMoved, 0);
    const sumPct = filteredPairs.reduce((s, p) => s + p.pctMoved, 0);
    const avgPoints = sumPoints / totalWeeks;
    const avgPct = sumPct / totalWeeks;

    const absPoints = filteredPairs.map(p => Math.abs(p.pointsMoved));
    const avgAbsPoints = absPoints.reduce((s, v) => s + v, 0) / totalWeeks;

    const maxGain = filteredPairs.reduce((best, p) => p.pointsMoved > best.pointsMoved ? p : best, filteredPairs[0]);
    const maxLoss = filteredPairs.reduce((worst, p) => p.pointsMoved < worst.pointsMoved ? p : worst, filteredPairs[0]);

    // Streak tracking
    let currentStreak = 0;
    let streakDirection = filteredPairs[filteredPairs.length - 1].direction;
    for (let i = filteredPairs.length - 1; i >= 0; i--) {
      if (filteredPairs[i].direction === streakDirection) currentStreak++;
      else break;
    }

    const summary = {
      totalWeeks,
      upWeeks,
      downWeeks,
      winRate,
      avgPoints,
      avgAbsPoints,
      avgPct,
      maxGain,
      maxLoss,
      currentStreak,
      streakDirection
    };

    // 2. Absolute distribution (7 buckets)
    const absBuckets = [
      { label: '0.00% - 0.20%', min: 0.0, max: 0.20 },
      { label: '0.20% - 0.30%', min: 0.20, max: 0.30 },
      { label: '0.30% - 0.40%', min: 0.30, max: 0.40 },
      { label: '0.40% - 0.50%', min: 0.40, max: 0.50 },
      { label: '0.50% - 1.00%', min: 0.50, max: 1.00 },
      { label: '1.00% - 2.00%', min: 1.00, max: 2.00 },
      { label: 'Above 2.00%', min: 2.00, max: Infinity }
    ];

    const absoluteDist = absBuckets.map(b => {
      const count = filteredPairs.filter(p => {
        const absVal = Math.abs(p.pctMoved);
        return absVal >= b.min && absVal < b.max;
      }).length;
      return {
        label: b.label,
        count,
        percentage: Number(((count / totalWeeks) * 100).toFixed(2))
      };
    });

    // 3. Signed distribution (10 buckets)
    const signedBuckets = [
      { label: 'Extreme Bullish (> +2.00%)', min: 2.00, max: Infinity },
      { label: 'Strong Bullish (+1.00% to +2.00%)', min: 1.00, max: 2.00 },
      { label: 'Moderate Bullish (+0.50% to +1.00%)', min: 0.50, max: 1.00 },
      { label: 'Mild Bullish (+0.20% to +0.50%)', min: 0.20, max: 0.50 },
      { label: 'Flat Bullish (0.00% to +0.20%)', min: 0.00, max: 0.20 },
      { label: 'Flat Bearish (-0.20% to 0.00%)', min: -0.20, max: 0.00 },
      { label: 'Mild Bearish (-0.50% to -0.20%)', min: -0.50, max: -0.20 },
      { label: 'Moderate Bearish (-1.00% to -0.50%)', min: -1.00, max: -0.50 },
      { label: 'Strong Bearish (-2.00% to -1.00%)', min: -2.00, max: -1.00 },
      { label: 'Extreme Bearish (< -2.00%)', min: -Infinity, max: -2.00 }
    ];

    const signedDist = signedBuckets.map(b => {
      const count = filteredPairs.filter(p => p.pctMoved >= b.min && p.pctMoved < b.max).length;
      return {
        label: b.label,
        count,
        percentage: Number(((count / totalWeeks) * 100).toFixed(2))
      };
    });

    // 4. Yearly seasonality breakdown
    const yearlyGroup = {};
    filteredPairs.forEach(p => {
      const year = p[dateKey].slice(0, 4);
      if (!yearlyGroup[year]) yearlyGroup[year] = [];
      yearlyGroup[year].push(p);
    });

    const yearlySeasonality = Object.keys(yearlyGroup)
      .sort((a, b) => b - a)
      .map(year => {
        const yrPairs = yearlyGroup[year];
        const total = yrPairs.length;
        const up = yrPairs.filter(p => p.direction === 'UP').length;
        const wRate = Number(((up / total) * 100).toFixed(2));
        const avgP = Number((yrPairs.reduce((sum, p) => sum + p.pctMoved, 0) / total).toFixed(3));
        const avgAbs = Number((yrPairs.reduce((sum, p) => sum + Math.abs(p.pctMoved), 0) / total).toFixed(3));
        return {
          year,
          totalWeeks: total,
          upWeeks: up,
          downWeeks: total - up,
          winRate: wRate,
          avgPct: avgP,
          avgAbsPct: avgAbs
        };
      });

    // 5. Monthly seasonality breakdown
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthlyGroups = Array.from({ length: 12 }, () => []);
    filteredPairs.forEach(p => {
      const mIdx = parseInt(p[dateKey].slice(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        monthlyGroups[mIdx].push(p);
      }
    });

    const monthlySeasonality = monthlyGroups
      .map((mPairs, mIdx) => {
        if (mPairs.length === 0) return null;
        const total = mPairs.length;
        const up = mPairs.filter(p => p.direction === 'UP').length;
        const wRate = Number(((up / total) * 100).toFixed(2));
        const avgP = Number((mPairs.reduce((sum, p) => sum + p.pctMoved, 0) / total).toFixed(3));
        const avgAbs = Number((mPairs.reduce((sum, p) => sum + Math.abs(p.pctMoved), 0) / total).toFixed(3));
        return {
          month: monthNames[mIdx],
          totalWeeks: total,
          upWeeks: up,
          downWeeks: total - up,
          winRate: wRate,
          avgPct: avgP,
          avgAbsPct: avgAbs
        };
      })
      .filter(Boolean);

    // 6. Streak Analysis
    let streaks = [];
    let currentStreakCount = 1;
    let currentDir = filteredPairs[0].direction;

    for (let i = 1; i < filteredPairs.length; i++) {
      if (filteredPairs[i].direction === currentDir) {
        currentStreakCount++;
      } else {
        streaks.push({ direction: currentDir, length: currentStreakCount });
        currentStreakCount = 1;
        currentDir = filteredPairs[i].direction;
      }
    }
    streaks.push({ direction: currentDir, length: currentStreakCount });

    const streakStatsMap = {};
    streaks.forEach(s => {
      const key = `${s.length} Weeks ${s.direction}`;
      streakStatsMap[key] = (streakStatsMap[key] || 0) + 1;
    });

    const totalStreaks = streaks.length;
    const streaksList = Object.entries(streakStatsMap)
      .sort((a, b) => {
        const lenA = parseInt(a[0]);
        const lenB = parseInt(b[0]);
        if (lenB !== lenA) return lenB - lenA;
        return a[0].localeCompare(b[0]);
      })
      .map(([streakKey, occurrences]) => ({
        label: streakKey,
        count: occurrences,
        percentage: Number(((occurrences / totalStreaks) * 100).toFixed(2))
      }));

    return {
      pairs: filteredPairs,
      summary,
      distribution: { absolute: absoluteDist, signed: signedDist },
      yearlySeasonality,
      monthlySeasonality,
      streaks: streaksList
    };
  };

  // Auto-refresh timer
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Fetch index data
  const fetchIndexData = async (indexName, tf) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/index-data/${indexName}?timeframe=${tf}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${indexName}`);
      }
      
      const data = await response.json();
      setIndexData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch correlation & heatmap data
  const fetchAnalyticsData = async (indexName, tf) => {
    try {
      const [corrRes, heatRes] = await Promise.all([
        fetch(`/api/correlation?timeframe=${tf}`),
        fetch(`/api/monthly-returns/${indexName}`)
      ]);
      
      if (corrRes.ok) {
        const corrData = await corrRes.json();
        setCorrelationData(corrData);
      }
      
      if (heatRes.ok) {
        const heatData = await heatRes.json();
        setHeatmapData(heatData);
      }
    } catch (err) {
      console.error('Error fetching analytics data:', err);
    }
  };

  // Fetch global insights strip
  const fetchInsightsData = async () => {
    try {
      const res = await fetch('/api/insights');
      if (res.ok) {
        const data = await res.json();
        setInsightsData(data);
      }
    } catch (err) {
      console.error('Error fetching global insights:', err);
    }
  };

  // Fetch dedicated day-of-week reports
  const fetchReportsData = async (ftIdx, ttIdx) => {
    try {
      const [ftRes, ttRes] = await Promise.all([
        fetch(`/api/friday-tuesday/${ftIdx}`),
        fetch(`/api/tuesday-thursday/${ttIdx}`)
      ]);
      if (ftRes.ok) {
        const ftData = await ftRes.json();
        setFridayTuesdayReport(ftData);
      }
      if (ttRes.ok) {
        const ttData = await ttRes.json();
        setTuesdayThursdayReport(ttData);
      }
    } catch (err) {
      console.error('Error fetching custom reports:', err);
    }
  };

  useEffect(() => {
    fetchIndexData(activeIndex, timeframe);
    fetchAnalyticsData(activeIndex, timeframe);
  }, [activeIndex, timeframe]);

  useEffect(() => {
    fetchReportsData(ftIndex, ttIndex);
  }, [ftIndex, ttIndex]);

  useEffect(() => {
    const fetchThresholdData = async () => {
      try {
        const res = await fetch(`/api/friday-tuesday/${thresholdIndex}`);
        if (res.ok) {
          const data = await res.json();
          setThresholdReport(data);
        }
      } catch (err) {
        console.error('Error fetching threshold report data:', err);
      }
    };
    fetchThresholdData();
  }, [thresholdIndex]);

  // Fetch dedicated Nifty options data when Option Simulator tab is loaded.
  // Always re-fetch fresh data; if existing data lacks open-price fields (mondayOpen/tuesdayOpen),
  // force a server-side cache bypass to get regenerated data.
  // Fetch dedicated options data when Option Simulator tabs are loaded.
  useEffect(() => {
    if (activeTab !== 'optionSimulator' && activeTab !== 'sensexOptionSimulator') return;

    const fetchOptReport = async (forceRefresh = false) => {
      setOptReport(null);
      try {
        const isSensex = activeTab === 'sensexOptionSimulator';
        const endpoint = isSensex
          ? '/api/options/tuesday-thursday/sensex'
          : '/api/friday-tuesday/nifty50';
          
        const url = forceRefresh
          ? `${endpoint}?refresh=1`
          : endpoint;
          
        const res = await fetch(url);
        if (res.ok) {
          let data = await res.json();
          
          if (isSensex) {
            data.pairs = data.pairs.map(p => ({
              ...p,
              fridayDate: p.tuesdayDate,
              fridayOpen: p.tuesdayOpen,
              fridayClose: p.tuesdayClose,
              fridayVIX: p.tuesdayVIX,
              vixFri: p.tuesdayVIX,
              
              mondayDate: p.wednesdayDate,
              mondayOpen: p.wednesdayOpen,
              mondayOpenVIX: p.wednesdayOpenVIX,
              mondayClose: p.wednesdayClose,
              mondayVIX: p.wednesdayVIX,
              vixMon: p.wednesdayVIX,
              
              tuesdayDate: p.thursdayDate,
              tuesdayOpen: p.thursdayOpen,
              tuesdayOpenVIX: p.thursdayOpenVIX,
              tuesdayClose: p.thursdayClose,
              tuesdayVIX: p.thursdayVIX,
              vixTue: p.thursdayVIX
            }));
          } else {
            data.pairs = data.pairs.map(p => ({
              ...p,
              vixFri: p.fridayVIX,
              vixMon: p.mondayVIX,
              vixTue: p.tuesdayVIX
            }));
          }

          const firstPair = data?.pairs?.[0];
          if (!forceRefresh && firstPair && firstPair.fridayVIX === undefined) {
            return fetchOptReport(true);
          }
          setOptReport(data);
        }
      } catch (err) {
        console.error('Error fetching opt report:', err);
      }
    };

    fetchOptReport();
  }, [activeTab]);

  // Fetch live ticks and historical database for Nifty Futures OI
  useEffect(() => {
    let intervalId = null;

    if (activeTab === 'futuresOI' || activeTab === 'liveOptionSignals' || activeTab === 'liveChart') {
      const fetchLiveTicks = async () => {
        try {
          const res = await fetch('/api/futures-oi/live');
          if (res.ok) {
            const data = await res.json();
            setLiveTicks(data.ticks || []);
            setLiveConnected(data.status === 'OPEN');
          }
        } catch (e) {
          console.error('Error fetching live ticks:', e);
          setLiveConnected(false);
        }
      };

      fetchLiveTicks();
      intervalId = setInterval(fetchLiveTicks, 1000);

      const fetchHistoricalOI = async () => {
        try {
          const res = await fetch(`/api/futures-oi/historical?index=${activeIndex}`);
          if (res.ok) {
            const data = await res.json();
            setHistoricalOI(data);
            
            if (data.length > 0) {
              const uniqueDays = Array.from(new Set(data.map(d => d.timestamp.split('T')[0]))).sort();
              if (uniqueDays.length > 0) {
                const latest = uniqueDays[uniqueDays.length - 1];
                setHistEndDate(latest);
                setHistStartDate(uniqueDays[Math.max(0, uniqueDays.length - 30)]);
              }
            }
          }
        } catch (e) {
          console.error('Error fetching historical OI:', e);
        }
      };

      fetchHistoricalOI();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab, activeIndex]);

  useEffect(() => {
    fetchInsightsData();
  }, []);

  const handleRefresh = () => {
    fetchIndexData(activeIndex, timeframe);
    fetchAnalyticsData(activeIndex, timeframe);
    fetchReportsData(ftIndex, ttIndex);
    fetchInsightsData();
    
    fetch(`/api/friday-tuesday/${thresholdIndex}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setThresholdReport(data))
      .catch(e => console.error(e));
    if (activeTab === 'futuresOI' || activeTab === 'liveOptionSignals' || activeTab === 'liveChart') {
      fetch(`/api/futures-oi/historical?index=${activeIndex}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setHistoricalOI(data))
        .catch(e => console.error(e));
      fetch('/api/futures-oi/live')
        .then(res => res.ok ? res.json() : { status: 'CLOSED', ticks: [] })
        .then(data => {
          setLiveTicks(data.ticks || []);
          setLiveConnected(data.status === 'OPEN');
        })
        .catch(e => console.error(e));
    }
  };

  // Helpers
  const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const getThemeColor = (index) => {
    switch (index) {
      case 'nifty50': return 'var(--nifty-color)';
      case 'banknifty': return 'var(--banknifty-color)';
      case 'sensex': return 'var(--sensex-color)';
      default: return 'var(--nifty-color)';
    }
  };

  const getThemeGradient = (index) => {
    switch (index) {
      case 'nifty50': return 'niftyGrad';
      case 'banknifty': return 'bankGrad';
      case 'sensex': return 'sensexGrad';
      default: return 'niftyGrad';
    }
  };

  const getHeatmapColorClass = (val) => {
    if (val === null || val === undefined) return 'cell-neutral';
    if (val > 5) return 'cell-pos-high';
    if (val > 2) return 'cell-pos-med';
    if (val > 0) return 'cell-pos-low';
    if (val < -5) return 'cell-neg-high';
    if (val < -2) return 'cell-neg-med';
    if (val < 0) return 'cell-neg-low';
    return 'cell-neutral';
  };

  const getCorrelationColorClass = (val) => {
    if (val >= 0.8) return 'corr-high';
    if (val >= 0.5) return 'corr-med';
    return 'corr-low';
  };

  const activeThemeColor = getThemeColor(activeIndex);
  const activeGradient = getThemeGradient(activeIndex);

  // Month names for heatmap columns
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const processedFtReport = processReportData(fridayTuesdayReport, ftStartDate, ftEndDate, 'fridayDate');
  const processedTtReport = processReportData(tuesdayThursdayReport, ttStartDate, ttEndDate, 'tuesdayDate');

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-section">
          <Activity className="logo-icon" />
          <h1>SIVA - MARKET INDICES HISTORICAL ANALYZER</h1>
        </div>
        <div className="system-status">
          {/* Out-of-Browser Display Launcher Dropdown */}
          <div className="oob-dropdown-wrapper" style={{ marginRight: '8px' }}>
            <button
              className="oob-menu-btn"
              onClick={() => setIsOobMenuOpen(!isOobMenuOpen)}
              title="Open Out-of-Browser Floating Desk Displays"
            >
              <ExternalLink size={14} />
              Pop-Out Display
              <ChevronDown size={12} style={{ transform: isOobMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {isOobMenuOpen && (
              <div className="oob-dropdown-menu">
                <button className="oob-menu-item" onClick={handleTogglePiP}>
                  <span className="oob-menu-item-icon">📌</span>
                  <div className="oob-menu-item-text">
                    <strong>Floating Widget (Always-On-Top)</strong>
                    <span>Picture-in-Picture window floating over Zerodha, Excel, and charts</span>
                  </div>
                </button>
                <button className="oob-menu-item" onClick={handleOpenPopout}>
                  <span className="oob-menu-item-icon">🗔</span>
                  <div className="oob-menu-item-text">
                    <strong>Portable Standalone Pop-Out Window</strong>
                    <span>Detached popout window ideal for secondary monitor setups</span>
                  </div>
                </button>
                <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }}></div>
                <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-dim)' }}>
                  💡 <strong>PWA App Mode:</strong> Click browser's address bar <em>Install App</em> icon to launch as an OS Desktop App.
                </div>
              </div>
            )}
          </div>

          <button 
            className="tab-btn theme-btn" 
            onClick={toggleTheme} 
            title={`Current Theme: ${theme === 'dark' ? 'Dark Mode' : theme === 'light' ? 'Light Mode' : 'Night Shift'} (Click to cycle)`} 
            style={{ marginRight: '8px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {theme === 'dark' && <><Moon size={14} style={{ color: '#38bdf8' }} /><span>Dark Mode</span></>}
            {theme === 'light' && <><Sun size={14} style={{ color: '#f59e0b' }} /><span>Light Mode</span></>}
            {theme === 'nightshift' && <><Sunset size={14} style={{ color: '#fb923c' }} /><span>Night Shift</span></>}
          </button>
          <button className="tab-btn" onClick={handleRefresh} style={{ marginRight: '8px', padding: '6px 12px' }}>
            <RefreshCw className="logo-icon" style={{ width: '14px', height: '14px' }} />
            Sync Data
          </button>
          <span className="status-dot"></span>
          <span>Live Analysis &bull; Updated: {lastRefreshed || 'Syncing...'}</span>
        </div>

      </header>

      {/* Global Insights Commentary Strip */}
      {insightsData && (
        <div className="insights-strip glass-panel" style={{ borderLeft: `4px solid ${activeThemeColor}` }}>
          <div className="insights-tag" style={{ background: activeThemeColor }}>
            Market Pulse
          </div>
          <div className="insights-content">
            {insightsData.commentary}
          </div>
        </div>
      )}

      {/* Quick Indices Cards Grid */}
      <section className="index-grid">
        {insightsData?.indices ? (
          insightsData.indices.map((idxInfo) => {
            const isSelected = activeIndex === idxInfo.index;
            const changeIsPositive = idxInfo.changePercent >= 0;
            const cardColor = getThemeColor(idxInfo.index);

            return (
              <div
                key={idxInfo.index}
                className={`index-card glass-panel ${idxInfo.index} ${isSelected ? 'active' : ''}`}
                onClick={() => setActiveIndex(idxInfo.index)}
              >
                <div className="index-card-header">
                  <div className="index-title-info">
                    <h3>{idxInfo.name}</h3>
                    <h2>{idxInfo.index === 'nifty50' ? 'NSE NIFTY' : idxInfo.index === 'banknifty' ? 'NIFTY BANK' : 'BSE SENSEX'}</h2>
                  </div>
                  <span className={`index-card-badge badge-${idxInfo.index}`}>
                    {idxInfo.trend}
                  </span>
                </div>
                <div className="index-price-section">
                  <span className="index-price">
                    {formatNumber(idxInfo.price)}
                  </span>
                  <span className={`index-change ${changeIsPositive ? 'price-up' : 'price-down'}`}>
                    {changeIsPositive ? '+' : ''}
                    {formatNumber(idxInfo.changePercent)}%
                  </span>
                </div>
                <div className="index-card-footer">
                  <span>RSI: {idxInfo.rsi} ({idxInfo.rsi > 70 ? 'Overbought' : idxInfo.rsi < 30 ? 'Oversold' : 'Neutral'})</span>
                  <span>{idxInfo.momentum}</span>
                </div>
              </div>
            );
          })
        ) : (
          // Placeholder loading cards
          ['nifty50', 'banknifty', 'sensex'].map((idxName) => (
            <div key={idxName} className="index-card glass-panel" style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
            </div>
          ))
        )}
      </section>

      {/* Navigation Row */}
      <section className="control-row">
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            <BarChart2 size={16} />
            Charts & Overlays
          </button>
          <button
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <Calendar size={16} />
            Analytics & Seasonality
          </button>
          <button
            className={`tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
          >
            <Sliders size={16} />
            Technical Scanner
          </button>
          <button
            className={`tab-btn ${activeTab === 'dayReports' ? 'active' : ''}`}
            onClick={() => setActiveTab('dayReports')}
          >
            <Calendar size={16} />
            Day-of-Week Reports
          </button>
          <button
            className={`tab-btn ${activeTab === 'thresholdModel' ? 'active' : ''}`}
            onClick={() => setActiveTab('thresholdModel')}
          >
            <Sliders size={16} />
            Threshold Modeler
          </button>
          <button
            className={`tab-btn ${activeTab === 'futuresOI' ? 'active' : ''}`}
            onClick={() => setActiveTab('futuresOI')}
          >
            <Activity size={16} />
            Futures OI Tracker
          </button>
          <button
            className={`tab-btn ${activeTab === 'optionSimulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('optionSimulator')}
          >
            <Percent size={16} />
            Nifty option stimulator Fri Close - Tues close
          </button>
          <button
            className={`tab-btn ${activeTab === 'sensexOptionSimulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('sensexOptionSimulator')}
          >
            <Percent size={16} />
            Sensex option stimulator Tue Close - Thurs close
          </button>
          <button
            className={`tab-btn ${activeTab === 'backtester' ? 'active' : ''}`}
            onClick={() => setActiveTab('backtester')}
          >
            <Activity size={16} />
            Back Tester
          </button>
          <button
            className={`tab-btn ${activeTab === 'liveOptionSignals' ? 'active' : ''}`}
            onClick={() => setActiveTab('liveOptionSignals')}
            style={{ background: activeTab === 'liveOptionSignals' ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' : 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.3)', color: activeTab === 'liveOptionSignals' ? '#000' : 'var(--nifty-color)', fontWeight: '700' }}
          >
            <Zap size={16} />
            Live Option Signals
          </button>
          <button
            className={`tab-btn ${activeTab === 'liveChart' ? 'active' : ''}`}
            onClick={() => setActiveTab('liveChart')}
            style={{ background: activeTab === 'liveChart' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: activeTab === 'liveChart' ? '#fff' : '#10b981', fontWeight: '700' }}
          >
            <BarChart2 size={16} />
            Live Chart
          </button>
        </div>

        {/* Timeframe selector (only valid for historical charting) */}
        {activeTab !== 'scanner' && activeTab !== 'dayReports' && activeTab !== 'thresholdModel' && activeTab !== 'optionSimulator' && activeTab !== 'sensexOptionSimulator' && (

          <div className="timeframe-selector">
            {['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'].map((tf) => (
              <button
                key={tf}
                className={`timeframe-btn ${timeframe === tf ? 'active' : ''} ${
                  timeframe === tf ? (activeIndex === 'banknifty' ? 'bank-nifty-theme' : activeIndex === 'sensex' ? 'sensex-theme' : '') : ''
                }`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Content Area */}
      {loading ? (
        <div className="glass-panel loading-container">
          <div className="spinner"></div>
          <p style={{ color: 'var(--text-muted)' }}>Fetching index database and calculating indicators...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <AlertTriangle size={32} style={{ marginBottom: '12px' }} />
          <h3>System Synchronization Failed</h3>
          <p>{error}</p>
          <button className="tab-btn" onClick={handleRefresh} style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            Retry Sync
          </button>
        </div>
      ) : (
        indexData && (
          <>
            {/* TABS CONTAINER */}
            
            {/* 1. CHARTS TAB */}
            {activeTab === 'charts' && (
              <div className="dashboard-grid">
                {/* Main Interactive Chart Card */}
                <div className="glass-panel chart-panel">
                  <div className="chart-header">
                    <div className="chart-title">
                      <h2>{indexData.indexName} Historical Trend</h2>
                    </div>
                    
                    {/* Overlays Checkboxes */}
                    <div className="chart-controls">
                      <span className="toggle-group">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={showSMA20}
                            onChange={(e) => setShowSMA20(e.target.checked)}
                          />
                          SMA 20
                        </label>
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={showSMA50}
                            onChange={(e) => setShowSMA50(e.target.checked)}
                          />
                          SMA 50
                        </label>
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={showSMA200}
                            onChange={(e) => setShowSMA200(e.target.checked)}
                          />
                          SMA 200
                        </label>
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={showBB}
                            onChange={(e) => setShowBB(e.target.checked)}
                          />
                          Bollinger Bands
                        </label>
                      </span>
                    </div>
                  </div>

                  {/* Primary Area Chart */}
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={indexData.history}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <defs>
                          {/* Color Gradient definitions */}
                          <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--nifty-color)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--nifty-color)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="bankGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--banknifty-color)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--banknifty-color)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="sensexGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--sensex-color)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--sensex-color)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--text-main)" stopOpacity={0.05}/>
                            <stop offset="95%" stopColor="var(--text-main)" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                        <XAxis
                          dataKey="date"
                          stroke="var(--text-dim)"
                          tickLine={false}
                          tick={{ fontSize: 11, fontFamily: 'Outfit' }}
                        />
                        <YAxis
                          domain={['auto', 'auto']}
                          stroke="var(--text-dim)"
                          tickLine={false}
                          orientation="right"
                          tickFormatter={(val) => Math.round(val)}
                          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        />
                        
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--tooltip-bg)',
                            borderColor: 'var(--tooltip-border)',
                            borderRadius: '12px',
                            fontFamily: 'Outfit',
                            fontSize: '13px',
                            color: 'var(--text-main)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                          }}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        
                        {/* Bollinger Bands Shaded Area */}
                        {showBB && (
                          <Area
                            type="monotone"
                            dataKey="bbUpper"
                            stroke="transparent"
                            fill="url(#bbFill)"
                          />
                        )}
                        {showBB && (
                          <Line
                            type="monotone"
                            dataKey="bbUpper"
                            stroke="var(--border-color)"
                            strokeDasharray="4 4"
                            dot={false}
                          />
                        )}
                        {showBB && (
                          <Line
                            type="monotone"
                            dataKey="bbLower"
                            stroke="var(--border-color)"
                            strokeDasharray="4 4"
                            dot={false}
                          />
                        )}

                        {/* Core closing price area */}
                        <Area
                          type="monotone"
                          dataKey="close"
                          stroke={activeThemeColor}
                          strokeWidth={2.5}
                          fill={`url(#${activeGradient})`}
                          dot={false}
                          name="Price"
                        />

                        {/* SMAs */}
                        {showSMA20 && (
                          <Line
                            type="monotone"
                            dataKey="sma20"
                            stroke="#eab308"
                            strokeWidth={1.5}
                            dot={false}
                            name="SMA 20"
                          />
                        )}
                        {showSMA50 && (
                          <Line
                            type="monotone"
                            dataKey="sma50"
                            stroke="#ec4899"
                            strokeWidth={1.5}
                            dot={false}
                            name="SMA 50"
                          />
                        )}
                        {showSMA200 && (
                          <Line
                            type="monotone"
                            dataKey="sma200"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            name="SMA 200"
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Volume Sub-Chart */}
                  <div className="sub-chart-container">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Trading Volume (Daily)</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={indexData.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="var(--text-dim)" orientation="right" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={(v) => (v / 1000000).toFixed(0) + 'M'} />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: 'var(--tooltip-bg)', 
                            borderRadius: '8px', 
                            border: '1px solid var(--tooltip-border)',
                            color: 'var(--text-main)' 
                          }}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Bar
                          dataKey="volume"
                          fill={activeThemeColor}
                          opacity={0.35}

                          name="Volume"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right Statistics Summary Panel */}
                <div className="stats-panel">
                  {/* Realtime Metrics */}
                  <div className="glass-panel stat-group-card">
                    <h3>Market Metrics</h3>
                    <div className="stat-row">
                      <span className="stat-label">Current Price</span>
                      <span className="stat-value" style={{ fontSize: '16px', color: activeThemeColor }}>
                        {formatNumber(indexData.quote.price)}
                      </span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Absolute Change</span>
                      <span className={`stat-value ${indexData.quote.change >= 0 ? 'price-up' : 'price-down'}`}>
                        {indexData.quote.change >= 0 ? '+' : ''}{formatNumber(indexData.quote.change)}
                      </span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Today's Open</span>
                      <span className="stat-value">{formatNumber(indexData.quote.open)}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Day's High</span>
                      <span className="stat-value" style={{ color: 'var(--color-up)' }}>{formatNumber(indexData.quote.dayHigh)}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Day's Low</span>
                      <span className="stat-value" style={{ color: 'var(--color-down)' }}>{formatNumber(indexData.quote.dayLow)}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Previous Close</span>
                      <span className="stat-value">{formatNumber(indexData.quote.prevClose)}</span>
                    </div>
                  </div>

                  {/* Period Stats */}
                  <div className="glass-panel stat-group-card">
                    <h3>Performance Analysis</h3>
                    <div className="stat-row">
                      <span className="stat-label">Period Return</span>
                      <span className={`stat-value ${indexData.stats.periodReturn >= 0 ? 'price-up' : 'price-down'}`} style={{ fontSize: '16px' }}>
                        {indexData.stats.periodReturn >= 0 ? '+' : ''}{formatNumber(indexData.stats.periodReturn)}%
                      </span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Annual Volatility</span>
                      <span className="stat-value">{formatNumber(indexData.stats.annualizedVolatility)}%</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Max Drawdown</span>
                      <span className="stat-value" style={{ color: 'var(--color-down)' }}>-{formatNumber(indexData.stats.maxDrawdown)}%</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Current Drawdown</span>
                      <span className="stat-value" style={{ color: 'var(--color-neutral)' }}>-{formatNumber(indexData.stats.currentDrawdown)}%</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">52-Week High</span>
                      <span className="stat-value">{formatNumber(indexData.quote.fiftyTwoWeekHigh)}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">52-Week Low</span>
                      <span className="stat-value">{formatNumber(indexData.quote.fiftyTwoWeekLow)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ANALYTICS & SEASONALITY TAB */}
            {activeTab === 'analytics' && (
              <div>
                {/* Period Return Heatmap */}
                <div className="glass-panel heatmap-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Seasonality Heatmap: Monthly Return Percentages (Last 10 Years)</h2>
                    <div className="system-status">
                      <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(16, 185, 129, 0.25)', border: '1px solid #10b981', marginRight: '4px' }}></span> Positive
                      <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #ef4444', marginLeft: '12px', marginRight: '4px' }}></span> Negative
                    </div>
                  </div>

                  {heatmapData ? (
                    <table className="heatmap-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Year</th>
                          {MONTHS.map((m) => (
                            <th key={m}>{m}</th>
                          ))}
                          <th>Year Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapData.map((row) => (
                          <tr key={row.year}>
                            <td className="heatmap-year">{row.year}</td>
                            {MONTHS.map((_, mIdx) => {
                              const cellVal = row[mIdx];
                              return (
                                <td key={mIdx}>
                                  <span className={`heatmap-cell-value ${getHeatmapColorClass(cellVal)}`}>
                                    {cellVal !== null ? `${cellVal > 0 ? '+' : ''}${cellVal.toFixed(1)}%` : '-'}
                                  </span>
                                </td>
                              );
                            })}
                            <td style={{ fontWeight: '700' }}>
                              <span className={`heatmap-cell-value ${getHeatmapColorClass(row.yearlyTotal)}`} style={{ border: `1px solid rgba(255,255,255,0.1)` }}>
                                {row.yearlyTotal > 0 ? '+' : ''}{row.yearlyTotal.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ display: 'flex', padding: '40px', justifyContent: 'center' }}>
                      <div className="spinner"></div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
                  {/* Index Correlation Matrix Card */}
                  <div className="glass-panel correlation-card">
                    <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Index Correlation Matrix ({timeframe} Timeframe)</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                      Pearson correlation coefficients calculated between daily logarithmic returns of the three indices. Values close to 1 represent high positive movement correlation.
                    </p>

                    {correlationData ? (
                      <div className="correlation-grid-container">
                        <table className="correlation-matrix-table">
                          <thead>
                            <tr>
                              <th></th>
                              {correlationData.labels.map(l => (
                                <th key={l}>{l}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {correlationData.matrix.map((row, rIdx) => (
                              <tr key={rIdx}>
                                <td style={{ fontWeight: '600', color: 'var(--text-muted)', textAlign: 'left', padding: '12px 18px' }}>
                                  {correlationData.labels[rIdx]}
                                </td>
                                {row.map((cellVal, cIdx) => (
                                  <td key={cIdx} className={getCorrelationColorClass(cellVal)}>
                                    {cellVal.toFixed(3)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', padding: '30px', justifyContent: 'center' }}>
                        <div className="spinner"></div>
                      </div>
                    )}
                  </div>

                  {/* Drawdown Timeline Chart */}
                  <div className="glass-panel chart-panel">
                    <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px' }}>Drawdown Percentage Timeline</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      Visualizes peak-to-trough price declines during the selected timeframe. Max drawdown represents the deepest drop from peak.
                    </p>
                    <div style={{ height: '240px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={indexData.history}
                          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                          <XAxis dataKey="date" stroke="var(--text-dim)" tick={{ fontSize: 10 }} />
                          <YAxis stroke="var(--text-dim)" orientation="right" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={(v) => v + '%'} />
                          <Tooltip
                            contentStyle={{ 
                              backgroundColor: 'var(--tooltip-bg)', 
                              borderRadius: '8px', 
                              border: '1px solid var(--tooltip-border)', 
                              color: 'var(--text-main)' 
                            }}
                            labelFormatter={(l) => `Date: ${l}`}
                            formatter={(v) => [`${v.toFixed(2)}%`, 'Drawdown']}
                          />
                          <Area
                            type="monotone"
                            dataKey="drawdown"
                            stroke="#ef4444"
                            strokeWidth={1.5}
                            fill="rgba(239, 68, 68, 0.15)"
                            dot={false}
                          />
                        </AreaChart>

                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TECHNICAL SCANNER TAB */}
            {activeTab === 'scanner' && (
              <div className="scanner-grid">
                {/* Pivot Levels Table */}
                <div className="glass-panel stat-group-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Support & Resistance Pivot Points</h2>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pivot: Classic / Standard</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Intraday pivot coordinates calculated using the high, low, and close values from the last completed daily session. Monitor these levels for price reversals or breakouts.
                  </p>

                  <table className="pivots-table">
                    <thead>
                      <tr>
                        <th>Level Name</th>
                        <th>Coordinate</th>
                        <th>Price Level (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Resistance levels */}
                      <tr style={{ color: 'rgba(239, 68, 68, 0.8)' }}>
                        <td>Resistance 3 (R3)</td>
                        <td>High + 2 * (Pivot - Low)</td>
                        <td>{formatNumber(indexData.stats.pivots.classic.r3)}</td>
                      </tr>
                      <tr style={{ color: 'rgba(239, 68, 68, 0.9)' }}>
                        <td>Resistance 2 (R2)</td>
                        <td>Pivot + (High - Low)</td>
                        <td>{formatNumber(indexData.stats.pivots.classic.r2)}</td>
                      </tr>
                      <tr style={{ color: 'var(--color-down)' }}>
                        <td>Resistance 1 (R1)</td>
                        <td>2 * Pivot - Low</td>
                        <td>{formatNumber(indexData.stats.pivots.classic.r1)}</td>
                      </tr>
                      {/* Main Pivot */}
                      <tr style={{ color: '#fff', fontWeight: '700', background: 'rgba(255,255,255,0.02)' }}>
                        <td>Pivot Point (P)</td>
                        <td>(High + Low + Close) / 3</td>
                        <td>{formatNumber(indexData.stats.pivots.classic.p)}</td>
                      </tr>
                      {/* Support levels */}
                      <tr style={{ color: 'var(--color-up)' }}>
                        <td>Support 1 (S1)</td>
                        <td>2 * Pivot - High</td>
                        <td>{formatNumber(indexData.stats.pivots.classic.s1)}</td>
                      </tr>
                      <tr style={{ color: 'rgba(16, 185, 129, 0.9)' }}>
                        <td>Support 2 (S2)</td>
                        <td>Pivot - (High - Low)</td>
                        <td>{formatNumber(indexData.stats.pivots.classic.s2)}</td>
                      </tr>
                      <tr style={{ color: 'rgba(16, 185, 129, 0.8)' }}>
                        <td>Support 3 (S3)</td>
                        <td>Low - 2 * (High - Pivot)</td>
                        <td>{formatNumber(indexData.stats.pivots.classic.s3)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Candlestick Pattern Alerts */}
                <div className="glass-panel stat-group-card">
                  <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Short-Term Candlestick Pattern Scanner</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Automated scan of the past 10 trading sessions checking for high-probability candlestick pattern signals.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '340px', overflowY: 'auto' }}>
                    {indexData.stats.patterns && indexData.stats.patterns.length > 0 ? (
                      indexData.stats.patterns.map((alert, idx) => {
                        const isBullish = alert.type.includes('Bullish');
                        const isBearish = alert.type.includes('Bearish');
                        const badgeColor = isBullish ? 'var(--color-up-glow)' : isBearish ? 'var(--color-down-glow)' : 'rgba(255, 255, 255, 0.05)';
                        const textColor = isBullish ? 'var(--color-up)' : isBearish ? 'var(--color-down)' : 'var(--text-muted)';
                        
                        return (
                          <div key={idx} className="pattern-alert-item">
                            <div className="pattern-header">
                              <span className="pattern-name">{alert.pattern}</span>
                              <span className="pattern-type" style={{ background: badgeColor, color: textColor }}>{alert.type}</span>
                            </div>
                            <div className="pattern-date">Date Triggered: {alert.date}</div>
                            <div className="pattern-desc">{alert.description}</div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                        <Info size={24} style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-dim)' }} />
                        No high-probability candlestick pattern alerts triggered in the last 10 sessions.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. DAY-OF-WEEK REPORTS TAB */}
            {activeTab === 'dayReports' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  
                  {/* Left Column: Friday to Tuesday Close Report */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Friday Close &rarr; Tuesday Close</h2>
                      <div className="timeframe-selector" style={{ background: 'rgba(0,0,0,0.1)' }}>
                        {['nifty50', 'banknifty', 'sensex'].map(idx => (
                          <button
                            key={idx}
                            className={`timeframe-btn ${ftIndex === idx ? 'active' : ''} ${ftIndex === idx ? (idx === 'banknifty' ? 'bank-nifty-theme' : idx === 'sensex' ? 'sensex-theme' : '') : ''}`}
                            onClick={() => setFtIndex(idx)}
                          >
                            {idx === 'nifty50' ? 'Nifty 50' : idx === 'banknifty' ? 'Bank Nifty' : 'Sensex'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      Analyzes market movement between Friday's close and Tuesday's close. Useful for weekend gap trading strategies.
                    </p>

                    {/* Date filter row */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From:</span>
                        <input
                          type="date"
                          value={ftStartDate}
                          onChange={(e) => setFtStartDate(e.target.value)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 8px',
                            fontSize: '12px',
                            outline: 'none',
                            fontFamily: 'JetBrains Mono'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To:</span>
                        <input
                          type="date"
                          value={ftEndDate}
                          onChange={(e) => setFtEndDate(e.target.value)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 8px',
                            fontSize: '12px',
                            outline: 'none',
                            fontFamily: 'JetBrains Mono'
                          }}
                        />
                      </div>
                      <button
                        className="timeframe-btn"
                        onClick={() => {
                          setFtStartDate(getOneYearAgoDate());
                          setFtEndDate(getTodayDate());
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Reset 1Y
                      </button>
                    </div>

                    {fridayTuesdayReport && fridayTuesdayReport.summary && processedFtReport ? (
                      <div>
                        <div className="mini-tabs-nav">
                          <button className={`mini-tab-btn ${ftSubTab === 'overview' ? 'active' : ''}`} onClick={() => setFtSubTab('overview')}>Overview</button>
                          <button className={`mini-tab-btn ${ftSubTab === 'distributions' ? 'active' : ''}`} onClick={() => setFtSubTab('distributions')}>Distributions</button>
                          <button className={`mini-tab-btn ${ftSubTab === 'seasonality' ? 'active' : ''}`} onClick={() => setFtSubTab('seasonality')}>Seasonality</button>
                          <button className={`mini-tab-btn ${ftSubTab === 'streaks' ? 'active' : ''}`} onClick={() => setFtSubTab('streaks')}>Streaks</button>
                        </div>

                        {ftSubTab === 'overview' && (
                          <>
                            {/* Stats grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Win Rate (UP Weeks)</div>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-up)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedFtReport.summary.winRate}%
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  {processedFtReport.summary.upWeeks} Green weeks vs {processedFtReport.summary.downWeeks} Red weeks
                                </div>
                              </div>

                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Streak</div>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: processedFtReport.summary.streakDirection === 'UP' ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedFtReport.summary.currentStreak} {processedFtReport.summary.streakDirection}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  Active consecutive direction
                                </div>
                              </div>

                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Average Return per Weekend</div>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: processedFtReport.summary.avgPoints >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedFtReport.summary.avgPoints >= 0 ? '+' : ''}{formatNumber(processedFtReport.summary.avgPoints)} pts ({processedFtReport.summary.avgPct >= 0 ? '+' : ''}{processedFtReport.summary.avgPct.toFixed(2)}%)
                                </div>
                              </div>

                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Sample Size</div>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedFtReport.summary.totalWeeks} Weeks
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  Filtered Range Results
                                </div>
                              </div>
                            </div>

                            {/* Extreme moves */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Max Gain: </span>
                                <span style={{ color: 'var(--color-up)', fontWeight: '600' }}>+{formatNumber(processedFtReport.summary.maxGain.pointsMoved)} pts ({processedFtReport.summary.maxGain.fridayDate})</span>
                              </div>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Max Loss: </span>
                                <span style={{ color: 'var(--color-down)', fontWeight: '600' }}>{formatNumber(processedFtReport.summary.maxLoss.pointsMoved)} pts ({processedFtReport.summary.maxLoss.fridayDate})</span>
                              </div>
                            </div>

                            {/* Detailed Transaction table */}
                            <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Weekly Movements</h3>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Fri Close Date</th>
                                    <th>Fri Close</th>
                                    <th>Tue Close</th>
                                    <th>Change</th>
                                    <th>Change %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedFtReport.pairs.slice().reverse().map((pair, pIdx) => {
                                    const isUp = pair.direction === 'UP';
                                    return (
                                      <tr key={pIdx}>
                                        <td style={{ fontSize: '12px' }}>{pair.fridayDate}</td>
                                        <td>{formatNumber(pair.fridayClose)}</td>
                                        <td>{formatNumber(pair.tuesdayClose)}</td>
                                        <td style={{ color: isUp ? 'var(--color-up)' : 'var(--color-down)' }}>
                                          {isUp ? '+' : ''}{formatNumber(pair.pointsMoved)}
                                        </td>
                                        <td style={{ color: isUp ? 'var(--color-up)' : 'var(--color-down)' }}>
                                          {isUp ? '+' : ''}{pair.pctMoved}%
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                        {ftSubTab === 'distributions' && (
                          <div className="distribution-container">
                            <div>
                              <h4 className="report-subtitle">Absolute Change Distribution</h4>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Range</th>
                                    <th>Count</th>
                                    <th>Frequency</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedFtReport.distribution?.absolute.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.label}</td>
                                      <td>{item.count}</td>
                                      <td>{item.percentage}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div>
                              <h4 className="report-subtitle">Directional Return Distribution (Skew)</h4>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Move Range</th>
                                    <th>Count</th>
                                    <th>Frequency</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedFtReport.distribution?.signed.map((item, idx) => {
                                    const isBullish = item.label.includes('Bullish');
                                    const isBearish = item.label.includes('Bearish');
                                    const textColor = isBullish ? 'var(--color-up)' : isBearish ? 'var(--color-down)' : 'var(--text-muted)';
                                    return (
                                      <tr key={idx} style={{ color: textColor }}>
                                        <td>{item.label}</td>
                                        <td>{item.count}</td>
                                        <td>{item.percentage}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {ftSubTab === 'seasonality' && (
                          <div>
                            <h4 className="report-subtitle">Yearly Performance Matrix</h4>
                            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '20px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Year</th>
                                    <th>Weeks</th>
                                    <th>Up</th>
                                    <th>Down</th>
                                    <th>Win Rate</th>
                                    <th>Avg Return</th>
                                    <th>Avg Abs Return</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedFtReport.yearlySeasonality?.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.year}</td>
                                      <td>{item.totalWeeks}</td>
                                      <td style={{ color: 'var(--color-up)' }}>{item.upWeeks}</td>
                                      <td style={{ color: 'var(--color-down)' }}>{item.downWeeks}</td>
                                      <td style={{ fontWeight: '600' }}>{item.winRate}%</td>
                                      <td style={{ color: item.avgPct >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                        {item.avgPct >= 0 ? '+' : ''}{item.avgPct}%
                                      </td>
                                      <td>{item.avgAbsPct}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <h4 className="report-subtitle">Calendar Month Seasonality</h4>
                            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Month</th>
                                    <th>Weeks</th>
                                    <th>Up</th>
                                    <th>Down</th>
                                    <th>Win Rate</th>
                                    <th>Avg Return</th>
                                    <th>Avg Abs Return</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedFtReport.monthlySeasonality?.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.month}</td>
                                      <td>{item.totalWeeks}</td>
                                      <td style={{ color: 'var(--color-up)' }}>{item.upWeeks}</td>
                                      <td style={{ color: 'var(--color-down)' }}>{item.downWeeks}</td>
                                      <td style={{ fontWeight: '600' }}>{item.winRate}%</td>
                                      <td style={{ color: item.avgPct >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                        {item.avgPct >= 0 ? '+' : ''}{item.avgPct}%
                                      </td>
                                      <td>{item.avgAbsPct}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {ftSubTab === 'streaks' && (
                          <div>
                            <h4 className="report-subtitle">Consecutive Streak Probabilities</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                              Historical frequency and occurrence rates of consecutive green or red weekend closes.
                            </p>
                            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Streak Description</th>
                                    <th>Count</th>
                                    <th>Probability</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedFtReport.streaks?.map((item, idx) => {
                                    const isUp = item.label.includes('UP');
                                    return (
                                      <tr key={idx}>
                                        <td style={{ color: isUp ? 'var(--color-up)' : 'var(--color-down)', fontWeight: '600' }}>{item.label}</td>
                                        <td>{item.count}</td>
                                        <td style={{ fontFamily: 'JetBrains Mono' }}>{item.percentage}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', padding: '40px', justifyContent: 'center' }}>
                        <div className="spinner"></div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Tuesday to Thursday Close Report */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Tuesday Close &rarr; Thursday Close</h2>
                      <div className="timeframe-selector" style={{ background: 'rgba(0,0,0,0.1)' }}>
                        {['nifty50', 'banknifty', 'sensex'].map(idx => (
                          <button
                            key={idx}
                            className={`timeframe-btn ${ttIndex === idx ? 'active' : ''} ${ttIndex === idx ? (idx === 'banknifty' ? 'bank-nifty-theme' : idx === 'sensex' ? 'sensex-theme' : '') : ''}`}
                            onClick={() => setTtIndex(idx)}
                          >
                            {idx === 'nifty50' ? 'Nifty 50' : idx === 'banknifty' ? 'Bank Nifty' : 'Sensex'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      Analyzes market movement between Tuesday's close and Thursday's close. Useful for mid-week trend or option expiry strategies.
                    </p>

                    {/* Date filter row */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From:</span>
                        <input
                          type="date"
                          value={ttStartDate}
                          onChange={(e) => setTtStartDate(e.target.value)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 8px',
                            fontSize: '12px',
                            outline: 'none',
                            fontFamily: 'JetBrains Mono'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To:</span>
                        <input
                          type="date"
                          value={ttEndDate}
                          onChange={(e) => setTtEndDate(e.target.value)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 8px',
                            fontSize: '12px',
                            outline: 'none',
                            fontFamily: 'JetBrains Mono'
                          }}
                        />
                      </div>
                      <button
                        className="timeframe-btn"
                        onClick={() => {
                          setTtStartDate(getOneYearAgoDate());
                          setTtEndDate(getTodayDate());
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Reset 1Y
                      </button>
                    </div>

                    {tuesdayThursdayReport && tuesdayThursdayReport.summary && processedTtReport ? (
                      <div>
                        <div className="mini-tabs-nav">
                          <button className={`mini-tab-btn ${ttSubTab === 'overview' ? 'active' : ''}`} onClick={() => setTtSubTab('overview')}>Overview</button>
                          <button className={`mini-tab-btn ${ttSubTab === 'distributions' ? 'active' : ''}`} onClick={() => setTtSubTab('distributions')}>Distributions</button>
                          <button className={`mini-tab-btn ${ttSubTab === 'seasonality' ? 'active' : ''}`} onClick={() => setTtSubTab('seasonality')}>Seasonality</button>
                          <button className={`mini-tab-btn ${ttSubTab === 'streaks' ? 'active' : ''}`} onClick={() => setTtSubTab('streaks')}>Streaks</button>
                        </div>

                        {ttSubTab === 'overview' && (
                          <>
                            {/* Stats grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Win Rate (UP Weeks)</div>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-up)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedTtReport.summary.winRate}%
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  {processedTtReport.summary.upWeeks} Green weeks vs {processedTtReport.summary.downWeeks} Red weeks
                                </div>
                              </div>

                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Streak</div>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: processedTtReport.summary.streakDirection === 'UP' ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedTtReport.summary.currentStreak} {processedTtReport.summary.streakDirection}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  Active consecutive direction
                                </div>
                              </div>

                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Average Return per Midweek</div>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: processedTtReport.summary.avgPoints >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedTtReport.summary.avgPoints >= 0 ? '+' : ''}{formatNumber(processedTtReport.summary.avgPoints)} pts ({processedTtReport.summary.avgPct >= 0 ? '+' : ''}{processedTtReport.summary.avgPct.toFixed(2)}%)
                                </div>
                              </div>

                              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Sample Size</div>
                                <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {processedTtReport.summary.totalWeeks} Weeks
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  Filtered Range Results
                                </div>
                              </div>
                            </div>

                            {/* Extreme moves */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Max Gain: </span>
                                <span style={{ color: 'var(--color-up)', fontWeight: '600' }}>+{formatNumber(processedTtReport.summary.maxGain.pointsMoved)} pts ({processedTtReport.summary.maxGain.tuesdayDate})</span>
                              </div>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Max Loss: </span>
                                <span style={{ color: 'var(--color-down)', fontWeight: '600' }}>{formatNumber(processedTtReport.summary.maxLoss.pointsMoved)} pts ({processedTtReport.summary.maxLoss.tuesdayDate})</span>
                              </div>
                            </div>

                            {/* Detailed Transaction table */}
                            <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Midweek Movements</h3>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Tue Close Date</th>
                                    <th>Tue Close</th>
                                    <th>Thu Close</th>
                                    <th>Change</th>
                                    <th>Change %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedTtReport.pairs.slice().reverse().map((pair, pIdx) => {
                                    const isUp = pair.direction === 'UP';
                                    return (
                                      <tr key={pIdx}>
                                        <td style={{ fontSize: '12px' }}>{pair.tuesdayDate}</td>
                                        <td>{formatNumber(pair.tuesdayClose)}</td>
                                        <td>{formatNumber(pair.thursdayClose)}</td>
                                        <td style={{ color: isUp ? 'var(--color-up)' : 'var(--color-down)' }}>
                                          {isUp ? '+' : ''}{formatNumber(pair.pointsMoved)}
                                        </td>
                                        <td style={{ color: isUp ? 'var(--color-up)' : 'var(--color-down)' }}>
                                          {isUp ? '+' : ''}{pair.pctMoved}%
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                        {ttSubTab === 'distributions' && (
                          <div className="distribution-container">
                            <div>
                              <h4 className="report-subtitle">Absolute Change Distribution</h4>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Range</th>
                                    <th>Count</th>
                                    <th>Frequency</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedTtReport.distribution?.absolute.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.label}</td>
                                      <td>{item.count}</td>
                                      <td>{item.percentage}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div>
                              <h4 className="report-subtitle">Directional Return Distribution (Skew)</h4>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Move Range</th>
                                    <th>Count</th>
                                    <th>Frequency</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedTtReport.distribution?.signed.map((item, idx) => {
                                    const isBullish = item.label.includes('Bullish');
                                    const isBearish = item.label.includes('Bearish');
                                    const textColor = isBullish ? 'var(--color-up)' : isBearish ? 'var(--color-down)' : 'var(--text-muted)';
                                    return (
                                      <tr key={idx} style={{ color: textColor }}>
                                        <td>{item.label}</td>
                                        <td>{item.count}</td>
                                        <td>{item.percentage}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {ttSubTab === 'seasonality' && (
                          <div>
                            <h4 className="report-subtitle">Yearly Performance Matrix</h4>
                            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '20px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Year</th>
                                    <th>Weeks</th>
                                    <th>Up</th>
                                    <th>Down</th>
                                    <th>Win Rate</th>
                                    <th>Avg Return</th>
                                    <th>Avg Abs Return</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedTtReport.yearlySeasonality?.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.year}</td>
                                      <td>{item.totalWeeks}</td>
                                      <td style={{ color: 'var(--color-up)' }}>{item.upWeeks}</td>
                                      <td style={{ color: 'var(--color-down)' }}>{item.downWeeks}</td>
                                      <td style={{ fontWeight: '600' }}>{item.winRate}%</td>
                                      <td style={{ color: item.avgPct >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                        {item.avgPct >= 0 ? '+' : ''}{item.avgPct}%
                                      </td>
                                      <td>{item.avgAbsPct}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <h4 className="report-subtitle">Calendar Month Seasonality</h4>
                            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Month</th>
                                    <th>Weeks</th>
                                    <th>Up</th>
                                    <th>Down</th>
                                    <th>Win Rate</th>
                                    <th>Avg Return</th>
                                    <th>Avg Abs Return</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedTtReport.monthlySeasonality?.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.month}</td>
                                      <td>{item.totalWeeks}</td>
                                      <td style={{ color: 'var(--color-up)' }}>{item.upWeeks}</td>
                                      <td style={{ color: 'var(--color-down)' }}>{item.downWeeks}</td>
                                      <td style={{ fontWeight: '600' }}>{item.winRate}%</td>
                                      <td style={{ color: item.avgPct >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                        {item.avgPct >= 0 ? '+' : ''}{item.avgPct}%
                                      </td>
                                      <td>{item.avgAbsPct}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {ttSubTab === 'streaks' && (
                          <div>
                            <h4 className="report-subtitle">Consecutive Streak Probabilities</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                              Historical frequency and occurrence rates of consecutive green or red midweek closes.
                            </p>
                            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th>Streak Description</th>
                                    <th>Count</th>
                                    <th>Probability</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedTtReport.streaks?.map((item, idx) => {
                                    const isUp = item.label.includes('UP');
                                    return (
                                      <tr key={idx}>
                                        <td style={{ color: isUp ? 'var(--color-up)' : 'var(--color-down)', fontWeight: '600' }}>{item.label}</td>
                                        <td>{item.count}</td>
                                        <td style={{ fontFamily: 'JetBrains Mono' }}>{item.percentage}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', padding: '40px', justifyContent: 'center' }}>
                        <div className="spinner"></div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'futuresOI' && (
              <div style={{ marginTop: '24px' }}>
                <div className="insights-strip" style={{ borderColor: 'var(--nifty-color)', marginBottom: '24px', background: 'rgba(0, 242, 254, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="status-dot"></span>
                    <strong style={{ color: 'var(--nifty-color)' }}>Nifty Futures OI Stream:</strong>
                    <span>Real-time second-by-second derivatives scanner. Seeding spot index updates from Yahoo Finance.</span>
                  </div>
                </div>

                <div className="scanner-grid" style={{ gap: '24px' }}>
                  {/* Left Column: Live Ticker & Real-time Chart */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Activity size={18} style={{ color: 'var(--nifty-color)' }} />
                          Live Futures OI Change
                        </h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Showing rolling second-by-second updates. Price premium: +15 pts.
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Show ticks:</span>
                        <select
                          value={liveWindowSize}
                          onChange={(e) => setLiveWindowSize(Number(e.target.value))}
                          style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--input-border)',
                            color: 'var(--text-main)',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          <option value={30}>30s</option>
                          <option value={60}>60s</option>
                          <option value={120}>120s</option>
                        </select>
                        <span style={{
                          fontSize: '10px',
                          background: liveConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: liveConnected ? 'var(--color-up)' : 'var(--color-down)',
                          border: `1px solid ${liveConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: '600'
                        }}>
                          {liveConnected ? 'LIVE' : 'DISCONNECTED'}
                        </span>
                      </div>
                    </div>

                    {liveConnected ? (
                      liveTicks.length > 0 ? (
                        <>
                          <div style={{ height: '300px', width: '100%', marginBottom: '24px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={liveTicks.slice(-liveWindowSize)}>
                                <defs>
                                  <linearGradient id="livePriceGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--nifty-color)" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="var(--nifty-color)" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                                <XAxis
                                  dataKey="timestamp"
                                  tickFormatter={(val) => {
                                    if (!val) return '';
                                    const parts = val.split('T')[1].split('.')[0].split(':');
                                    return `${parts[1]}:${parts[2]}`;
                                  }}
                                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                />
                                <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} orientation="left" />
                                <YAxis yAxisId="oi" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} orientation="right" />
                                <Tooltip
                                  contentStyle={{ 
                                    backgroundColor: 'var(--tooltip-bg)', 
                                    border: '1px solid var(--tooltip-border)', 
                                    borderRadius: '8px', 
                                    color: 'var(--text-main)' 
                                  }}
                                  labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                                />
                                <Legend verticalAlign="top" height={36} tick={{ fontSize: 11 }} />
                                <Area yAxisId="price" type="monotone" dataKey="price" stroke="var(--nifty-color)" fillOpacity={1} fill="url(#livePriceGrad)" name="Futures Price" />
                                <Line yAxisId="oi" type="monotone" dataKey="oiChange" stroke="var(--color-up)" strokeWidth={2} dot={false} name="OI Change (Contracts)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>


                          <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Live Trades Log</h3>
                          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                            <table className="pivots-table">
                              <thead>
                                <tr>
                                  <th>Time</th>
                                  <th>Futures Price</th>
                                  <th>OI Change (Tick)</th>
                                  <th>Cum. OI Change</th>
                                  <th>Volume (Tick)</th>
                                  <th>Buildup Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {liveTicks.slice().reverse().slice(0, 20).map((tick, idx) => {
                                  const isUp = tick.priceChange >= 0;
                                  const isOiUp = tick.oiChangeDelta >= 0;
                                  let buildupColor = 'var(--text-muted)';
                                  if (tick.buildup === 'Long Buildup') buildupColor = 'var(--color-up)';
                                  else if (tick.buildup === 'Short Buildup') buildupColor = 'var(--color-down)';
                                  else if (tick.buildup === 'Long Unwinding') buildupColor = '#fca5a5';
                                  else if (tick.buildup === 'Short Covering') buildupColor = '#6ee7b7';

                                  return (
                                    <tr key={idx}>
                                      <td style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}>
                                        {new Date(tick.timestamp).toLocaleTimeString()}
                                      </td>
                                      <td style={{ fontWeight: '600' }}>{formatNumber(tick.price)}</td>
                                      <td style={{ color: isOiUp ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>
                                        {isOiUp ? '+' : ''}{formatNumber(tick.oiChangeDelta, 0)}
                                      </td>
                                      <td style={{ fontFamily: 'JetBrains Mono' }}>
                                        {tick.oiChange >= 0 ? '+' : ''}{formatNumber(tick.oiChange, 0)}
                                      </td>
                                      <td style={{ fontFamily: 'JetBrains Mono' }}>
                                        {formatNumber(tick.volumeDelta, 0)}
                                      </td>
                                      <td style={{ color: buildupColor, fontWeight: '600', fontSize: '11px' }}>
                                        {tick.buildup}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '300px', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                          <div className="spinner"></div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Connecting to live Nifty Futures stream...</p>
                        </div>
                      )
                    ) : (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '40px 24px',
                        background: 'rgba(239, 68, 68, 0.02)',
                        border: '1px dashed rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        textAlign: 'center',
                        marginTop: '20px'
                      }}>
                        <AlertTriangle size={36} style={{ color: 'var(--color-down)', marginBottom: '16px' }} />
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>Indian Stock Market is Closed</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: '1.6' }}>
                          Live Nifty Futures OI Stream is active **Monday to Friday, 09:15 AM to 03:30 PM IST**.
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
                          Live tick streaming will automatically resume during active exchange sessions.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Historical Analysis */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} style={{ color: 'var(--nifty-color)' }} />
                      Historical OI Analysis
                    </h2>

                    {historicalOI.length > 0 ? (
                      (() => {
                        const uniqueDays = Array.from(new Set(historicalOI.map(d => d.timestamp.split('T')[0]))).sort();
                        
                        const filteredHist = historicalOI.filter(row => {
                          const datePart = row.timestamp.split('T')[0];
                          if (histStartDate && datePart < histStartDate) return false;
                          if (histEndDate && datePart > histEndDate) return false;
                          
                          if (histBuildupFilter !== 'ALL' && row.buildup !== histBuildupFilter) return false;
                          if (histThreshold > 0 && Math.abs(row.oiChangeDelta) < histThreshold) return false;
                          
                          return true;
                        });

                        const firstRow = filteredHist[0];
                        const lastRow = filteredHist[filteredHist.length - 1];
                        const priceChange = lastRow && firstRow ? Number((lastRow.price - firstRow.price).toFixed(2)) : 0;
                        const priceChangePct = lastRow && firstRow ? Number(((lastRow.price - firstRow.price) / firstRow.price * 100).toFixed(2)) : 0;
                        const totalVol = filteredHist.reduce((s, r) => s + r.volumeDelta, 0);
                        const netOIChange = lastRow && firstRow ? lastRow.oiChange - firstRow.oiChange : 0;

                        const buildupCounts = {
                          'Long Buildup': filteredHist.filter(r => r.buildup === 'Long Buildup').length,
                          'Short Buildup': filteredHist.filter(r => r.buildup === 'Short Buildup').length,
                          'Long Unwinding': filteredHist.filter(r => r.buildup === 'Long Unwinding').length,
                          'Short Covering': filteredHist.filter(r => r.buildup === 'Short Covering').length
                        };
                        const dominantBuildup = Object.entries(buildupCounts).reduce((best, curr) => curr[1] > best[1] ? curr : best, ['None', 0])[0];

                        return (
                          <>
                            {/* Filter Controls Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                              <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From Date</label>
                                <input
                                  type="date"
                                  value={histStartDate}
                                  onChange={(e) => setHistStartDate(e.target.value)}
                                  className="futures-input"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>To Date</label>
                                <input
                                  type="date"
                                  value={histEndDate}
                                  onChange={(e) => setHistEndDate(e.target.value)}
                                  className="futures-input"
                                  style={{ colorScheme: 'dark' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Buildup Type</label>
                                <select
                                  value={histBuildupFilter}
                                  onChange={(e) => setHistBuildupFilter(e.target.value)}
                                  className="futures-input"
                                >
                                  <option value="ALL">All Buildups</option>
                                  <option value="Long Buildup">Long Buildup</option>
                                  <option value="Short Buildup">Short Buildup</option>
                                  <option value="Long Unwinding">Long Unwinding</option>
                                  <option value="Short Covering">Short Covering</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Min OI Change</label>
                                <input
                                  type="number"
                                  value={histThreshold || ''}
                                  onChange={(e) => setHistThreshold(Number(e.target.value))}
                                  className="futures-input"
                                  placeholder="e.g. 5000"
                                  style={{ fontFamily: 'JetBrains Mono' }}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button
                                  className="timeframe-btn"
                                  onClick={() => {
                                    if (uniqueDays.length > 0) {
                                      setHistEndDate(uniqueDays[uniqueDays.length - 1]);
                                      setHistStartDate(uniqueDays[Math.max(0, uniqueDays.length - 30)]);
                                    }
                                  }}
                                  style={{ width: '100%', height: '34px', padding: '6px', fontSize: '12px' }}
                                >
                                  Reset 30D
                                </button>
                              </div>
                            </div>

                            {/* Range Summary Dashboard Card */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                              <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Price Change</div>
                                <div style={{ fontSize: '14px', fontWeight: '700', color: priceChange >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                                  {priceChange >= 0 ? '+' : ''}{priceChange} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct}%)
                                </div>
                              </div>
                              <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Net OI Change</div>
                                <div style={{ fontSize: '14px', fontWeight: '700', color: netOIChange >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                                  {netOIChange >= 0 ? '+' : ''}{formatNumber(netOIChange, 0)}
                                </div>
                              </div>
                              <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Accum. Volume</div>
                                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                                  {formatNumber(totalVol, 0)}
                                </div>
                              </div>
                              <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Dominant Buildup</div>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: dominantBuildup === 'Long Buildup' ? 'var(--color-up)' : dominantBuildup === 'Short Buildup' ? 'var(--color-down)' : dominantBuildup === 'Long Unwinding' ? '#fca5a5' : dominantBuildup === 'Short Covering' ? '#6ee7b7' : 'var(--text-main)',
                                  marginTop: '2px'
                                }}>
                                  {dominantBuildup}
                                </div>
                              </div>
                            </div>

                            {/* Historical minute-by-minute Recharts */}
                            {filteredHist.length > 0 ? (
                              <>
                                <div style={{ height: '240px', width: '100%', marginBottom: '20px' }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={filteredHist}>
                                      <defs>
                                        <linearGradient id="histPriceGrad" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="var(--nifty-color)" stopOpacity={0.15} />
                                          <stop offset="95%" stopColor="var(--nifty-color)" stopOpacity={0} />
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                                      <XAxis
                                        dataKey="timestamp"
                                        tickFormatter={(val) => {
                                          if (!val) return '';
                                          return val.split('T')[1].slice(0, 5);
                                        }}
                                        tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                                      />
                                      <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} orientation="left" />
                                      <YAxis yAxisId="oi" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} orientation="right" />
                                      <Tooltip
                                        contentStyle={{ 
                                          backgroundColor: 'var(--tooltip-bg)', 
                                          border: '1px solid var(--tooltip-border)', 
                                          borderRadius: '8px', 
                                          color: 'var(--text-main)' 
                                        }}
                                        labelFormatter={(label) => label.replace('T', ' ')}
                                      />
                                      <Legend verticalAlign="top" height={28} tick={{ fontSize: 10 }} />
                                      <Area yAxisId="price" type="monotone" dataKey="price" stroke="var(--nifty-color)" fillOpacity={1} fill="url(#histPriceGrad)" name="Futures Price" />
                                      <Line yAxisId="oi" type="monotone" dataKey="oiChange" stroke="var(--color-up)" strokeWidth={1.5} dot={false} name="OI Change" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>


                                {/* Historical Data Table Grid */}
                                <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Filtered Intervals</h3>
                                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                  <table className="pivots-table">
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Futures Close</th>
                                        <th>OI Change (Daily)</th>
                                        <th>Total Open Interest (OI)</th>
                                        <th>Volume (Daily)</th>
                                        <th>Buildup Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredHist.slice().reverse().map((row, idx) => {
                                        const isUp = row.priceChange >= 0;
                                        const isOiUp = row.oiChangeDelta >= 0;
                                        let buildupColor = 'var(--text-muted)';
                                        if (row.buildup === 'Long Buildup') buildupColor = 'var(--color-up)';
                                        else if (row.buildup === 'Short Buildup') buildupColor = 'var(--color-down)';
                                        else if (row.buildup === 'Long Unwinding') buildupColor = '#fca5a5';
                                        else if (row.buildup === 'Short Covering') buildupColor = '#6ee7b7';

                                        return (
                                          <tr key={idx}>
                                            <td style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}>
                                              {row.timestamp.split('T')[0]} {row.timestamp.split('T')[1].slice(0, 5)}
                                            </td>
                                            <td style={{ fontWeight: '600' }}>{formatNumber(row.price)}</td>
                                            <td style={{ color: isOiUp ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>
                                              {isOiUp ? '+' : ''}{formatNumber(row.oiChangeDelta, 0)}
                                            </td>
                                            <td style={{ fontFamily: 'JetBrains Mono' }}>
                                              {formatNumber(row.oi, 0)}
                                            </td>
                                            <td style={{ fontFamily: 'JetBrains Mono' }}>
                                              {formatNumber(row.volumeDelta, 0)}
                                            </td>
                                            <td style={{ color: buildupColor, fontWeight: '600', fontSize: '11px' }}>
                                              {row.buildup}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', height: '240px', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No historical intervals match the specified filters.</p>
                              </div>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '300px', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                        <div className="spinner"></div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading Nifty Futures historical database...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'thresholdModel' && (
              <div style={{ marginTop: '24px' }}>
                <div className="insights-strip glass-panel" style={{ borderLeft: `4px solid ${activeThemeColor}` }}>
                  <div className="insights-tag" style={{ background: activeThemeColor }}>
                    Modeler Guide
                  </div>
                  <div className="insights-content">
                    This modeler projects returns based on weekend gaps (Friday Close to Tuesday Close) using dynamic threshold ranges.
                    Each range is either fixed or linearly interpolated ("matching inclination") to estimate simulated returns.
                  </div>
                </div>

                <div className="scanner-grid" style={{ gap: '24px', gridTemplateColumns: '1fr 1.3fr' }}>
                  {/* Left Column: Threshold Inputs Configuration */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Threshold Configurations</h2>
                      <button
                        className="timeframe-btn"
                        onClick={() => setThresholds([
                          { val: 0.27, outcome: -2.7 },
                          { val: 0.40, outcome: 0.0 },
                          { val: 0.88, outcome: 10.0 },
                          { val: 1.10, outcome: 10.0 },
                          { val: 1.60, outcome: 0.0 },
                          { val: 1.90, outcome: -8.0 }
                        ])}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        Reset Defaults
                      </button>
                    </div>

                    <table className="pivots-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Range Node</th>
                          <th>Threshold Gap % (X)</th>
                          <th>Model Return % (Y)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {thresholds.map((t, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Node {idx + 1}</td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={t.val}
                                onChange={(e) => {
                                  const newVal = Number(e.target.value);
                                  setThresholds(prev => prev.map((item, i) => i === idx ? { ...item, val: newVal } : item));
                                }}
                                className="futures-input"
                                style={{ width: '90px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.1"
                                value={t.outcome}
                                onChange={(e) => {
                                  const newOut = Number(e.target.value);
                                  setThresholds(prev => prev.map((item, i) => i === idx ? { ...item, outcome: newOut } : item));
                                }}
                                className="futures-input"
                                style={{ width: '90px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      <h4 style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-main)' }}>Model Logic Rules:</h4>
                      <ul style={{ paddingLeft: '16px' }}>
                        <li>Below Node 1 ({thresholds[0].val}%): Fixed at {thresholds[0].outcome}%</li>
                        <li>Between Node 1 &amp; Node 2: Interpolated separation</li>
                        <li>Between Node 2 &amp; Node 3: Interpolated separation</li>
                        <li>Between Node 3 &amp; Node 4: Fixed at {thresholds[2].outcome}%</li>
                        <li>Between Node 4 &amp; Node 5: Interpolated separation</li>
                        <li>Between Node 5 &amp; Node 6: Interpolated separation</li>
                        <li>Above Node 6 ({thresholds[5].val}%): Fixed at {thresholds[5].outcome}%</li>
                      </ul>
                    </div>
                  </div>

                  {/* Right Column: Filters and Summary Results */}
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Historical Date Filter &amp; Asset</h2>
                      
                      <div className="timeframe-selector" style={{ background: 'var(--panel-bg-subtle)' }}>
                        {['nifty50', 'banknifty', 'sensex'].map(idx => (
                          <button
                            key={idx}
                            className={`timeframe-btn ${thresholdIndex === idx ? 'active' : ''} ${thresholdIndex === idx ? (idx === 'banknifty' ? 'bank-nifty-theme' : idx === 'sensex' ? 'sensex-theme' : '') : ''}`}
                            onClick={() => setThresholdIndex(idx)}
                          >
                            {idx === 'nifty50' ? 'Nifty 50' : idx === 'banknifty' ? 'Bank Nifty' : 'Sensex'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date filter inputs */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From:</span>
                        <input
                          type="date"
                          value={threshStartDate}
                          onChange={(e) => setThreshStartDate(e.target.value)}
                          className="futures-input"
                          style={{ padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', width: '130px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To:</span>
                        <input
                          type="date"
                          value={threshEndDate}
                          onChange={(e) => setThreshEndDate(e.target.value)}
                          className="futures-input"
                          style={{ padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', width: '130px' }}
                        />
                      </div>
                      <button
                        className="timeframe-btn"
                        onClick={() => {
                          setThreshStartDate(getOneYearAgoDate());
                          setThreshEndDate(getTodayDate());
                        }}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        Reset 1Y
                      </button>
                    </div>

                    {thresholdReport && thresholdReport.pairs ? (
                      (() => {
                        // Filter pairs inside selected range
                        const filteredPairs = thresholdReport.pairs.filter(p => {
                          return p.fridayDate >= threshStartDate && p.fridayDate <= threshEndDate;
                        });

                        // Enrich pairs with modeled outcome
                        const enrichedPairs = filteredPairs.map(p => {
                          const modeled = calculateModeledOutcome(p.pctMoved);
                          return {
                            ...p,
                            modeled
                          };
                        });

                        // Search filter
                        const searchedPairs = enrichedPairs.filter(pair => {
                          if (!threshSearchText) return true;
                          const term = threshSearchText.toLowerCase();
                          return (
                            pair.fridayDate.toLowerCase().includes(term) ||
                            (pair.tuesdayDate && pair.tuesdayDate.toLowerCase().includes(term)) ||
                            pair.fridayClose.toString().includes(term) ||
                            pair.tuesdayClose.toString().includes(term) ||
                            pair.pctMoved.toFixed(2).includes(term) ||
                            pair.modeled.toFixed(2).includes(term)
                          );
                        });

                        // Sorting logic
                        const sortedPairs = [...searchedPairs].sort((a, b) => {
                          let valA = a[threshSortKey];
                          let valB = b[threshSortKey];
                          
                          if (typeof valA === 'number' && typeof valB === 'number') {
                            return threshSortOrder === 'asc' ? valA - valB : valB - valA;
                          }
                          
                          valA = String(valA).toLowerCase();
                          valB = String(valB).toLowerCase();
                          if (valA < valB) return threshSortOrder === 'asc' ? -1 : 1;
                          if (valA > valB) return threshSortOrder === 'asc' ? 1 : -1;
                          return 0;
                        });

                        const totalWeeks = filteredPairs.length;
                        let positiveWeeks = 0;
                        let totalModeledReturn = 0;
                        
                        enrichedPairs.forEach(p => {
                          if (p.modeled > 0) positiveWeeks++;
                          totalModeledReturn += p.modeled;
                        });

                        const winRate = totalWeeks > 0 ? (positiveWeeks / totalWeeks * 100) : 0;
                        const avgModeledReturn = totalWeeks > 0 ? (totalModeledReturn / totalWeeks) : 0;

                        const handleThreshSort = (key) => {
                          if (threshSortKey === key) {
                            setThreshSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setThreshSortKey(key);
                            setThreshSortOrder('desc');
                          }
                        };

                        const exportToCSV = (data) => {
                          let csv = 'S.No.,Friday Close Date,Friday Close,Tuesday Close Date,Tuesday Close,Actual Change %,Modeled Return %\n';
                          data.forEach((row, index) => {
                            csv += `${index + 1},${row.fridayDate},${row.fridayClose},${row.tuesdayDate},${row.tuesdayClose},${row.pctMoved.toFixed(2)}%,${row.modeled.toFixed(2)}%\n`;
                          });
                          
                          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.setAttribute('href', url);
                          link.setAttribute('download', `Threshold_Model_Report_${thresholdIndex}_${threshStartDate}_to_${threshEndDate}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        };

                        const exportToPDF = (data) => {
                          const printWindow = window.open('', '_blank', 'width=900,height=700');
                          let tableHtml = `
                            <html>
                            <head>
                              <title>Threshold Modeler Report - ${thresholdIndex.toUpperCase()}</title>
                              <style>
                                body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; }
                                h2 { margin-bottom: 5px; color: #111; }
                                p { font-size: 12px; color: #666; margin-top: 0; margin-bottom: 20px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                th { background-color: #f5f5f5; font-weight: bold; }
                                tr:nth-child(even) { background-color: #fafafa; }
                                .up { color: #0f9d58; font-weight: bold; }
                                .down { color: #d93025; font-weight: bold; }
                              </style>
                            </head>
                            <body>
                              <h2>Threshold Modeler Report (${thresholdIndex.toUpperCase()})</h2>
                              <p>Date Range: ${threshStartDate} to ${threshEndDate} | Total Filtered Weeks: ${data.length}</p>
                              <table>
                                <thead>
                                  <tr>
                                    <th>S.No.</th>
                                    <th>Fri Close Date</th>
                                    <th>Fri Close</th>
                                    <th>Tue Close Date</th>
                                    <th>Tue Close</th>
                                    <th>Actual Change %</th>
                                    <th>Modeled Return %</th>
                                  </tr>
                                </thead>
                                <tbody>
                          `;
                          
                          data.forEach((row, index) => {
                            const isActualUp = row.pctMoved >= 0;
                            const isModeledUp = row.modeled > 0;
                            const isModeledDown = row.modeled < 0;
                            tableHtml += `
                              <tr>
                                <td>${index + 1}</td>
                                <td>${row.fridayDate}</td>
                                <td>${row.fridayClose.toFixed(2)}</td>
                                <td>${row.tuesdayDate}</td>
                                <td>${row.tuesdayClose.toFixed(2)}</td>
                                <td class="${isActualUp ? 'up' : 'down'}">${isActualUp ? '+' : ''}${row.pctMoved.toFixed(2)}%</td>
                                <td class="${isModeledUp ? 'up' : isModeledDown ? 'down' : ''}">${isModeledUp ? '+' : ''}${row.modeled.toFixed(2)}%</td>
                              </tr>
                            `;
                          });
                          
                          tableHtml += `
                                </tbody>
                              </table>
                              <script>
                                window.onload = function() {
                                  window.print();
                                  setTimeout(function() { window.close(); }, 500);
                                };
                              <\/script>
                            </body>
                            </html>
                          `;
                          
                          printWindow.document.write(tableHtml);
                          printWindow.document.close();
                        };

                        const { mean, sd } = (() => {
                          if (filteredPairs.length === 0) return { mean: 0, sd: 1 };
                          const vals = filteredPairs.map(p => p.pctMoved);
                          const m = vals.reduce((s, v) => s + v, 0) / vals.length;
                          const dsq = vals.map(v => Math.pow(v - m, 2));
                          const v = dsq.reduce((s, v) => s + v, 0) / vals.length;
                          return { mean: m, sd: Math.sqrt(v) || 1 };
                        })();

                        const simulationChartData = (() => {
                          const data = [];
                          const steps = 60;
                          const minRange = mean - 3 * sd;
                          const maxRange = mean + 3 * sd;
                          const stepSize = (maxRange - minRange) / steps;
                          const values = filteredPairs.map(p => p.pctMoved);

                          for (let i = 0; i <= steps; i++) {
                            const x = minRange + i * stepSize;
                            const modelReturn = calculateModeledOutcome(x);
                            const modelReturnPositive = modelReturn >= 0 ? modelReturn : 0;
                            const modelReturnNegative = modelReturn < 0 ? modelReturn : 0;

                            const normDist = (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
                            
                            const binMin = x - stepSize / 2;
                            const binMax = x + stepSize / 2;
                            const histCount = values.filter(v => v >= binMin && v < binMax).length;

                            data.push({
                              x,
                              modelReturn,
                              modelReturnPositive,
                              modelReturnNegative,
                              normDist,
                              histCount
                            });
                          }
                          return data;
                        })();

                        const activePair = filteredPairs.find(p => p.fridayDate === selectedThreshWeek?.fridayDate)
                          ? enrichedPairs.find(p => p.fridayDate === selectedThreshWeek?.fridayDate)
                          : enrichedPairs[0];


                        return (
                          <>
                            {/* Summary Metrics Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                              <div className="glass-panel" style={{ padding: '16px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Modeled Total Return</div>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: totalModeledReturn >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {totalModeledReturn >= 0 ? '+' : ''}{totalModeledReturn.toFixed(2)}%
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  Average: {avgModeledReturn >= 0 ? '+' : ''}{avgModeledReturn.toFixed(2)}% / week
                                </div>
                              </div>
                              <div className="glass-panel" style={{ padding: '16px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Modeled Win Rate</div>
                                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-up)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                  {winRate.toFixed(1)}%
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                  {positiveWeeks} profitable weeks of {totalWeeks} total
                                </div>
                              </div>
                            </div>

                            {/* Graphical Simulation Panel */}
                            <div className="glass-panel" style={{ padding: '16px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                  Graphical Simulation {activePair ? `(${activePair.fridayDate} to ${activePair.tuesdayDate})` : ''}
                                </h4>
                                {activePair && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                    Actual Gap: <strong style={{ color: activePair.pctMoved >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>{activePair.pctMoved.toFixed(2)}%</strong>
                                    &nbsp;|&nbsp;
                                    Modeled Outcome: <strong style={{ color: activePair.modeled >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>{activePair.modeled.toFixed(2)}%</strong>
                                  </div>
                                )}
                              </div>
                              <div style={{ height: '320px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={simulationChartData} margin={{ top: 15, right: 5, left: -20, bottom: -5 }}>
                                    <XAxis 
                                      dataKey="x" 
                                      type="number" 
                                      domain={['auto', 'auto']} 
                                      tick={{ fontSize: 8 }}
                                      tickFormatter={(v) => v.toFixed(2) + '%'}
                                      stroke="var(--text-dim)"
                                    />
                                    <YAxis 
                                      yAxisId="left" 
                                      tick={{ fontSize: 8 }}
                                      stroke="var(--text-dim)"
                                      tickFormatter={(v) => v + '%'}
                                    />
                                    <YAxis 
                                      yAxisId="right" 
                                      orientation="right" 
                                      hide={true} 
                                    />
                                    <Tooltip
                                      contentStyle={{ 
                                        backgroundColor: 'var(--tooltip-bg)', 
                                        border: '1px solid var(--tooltip-border)', 
                                        borderRadius: '8px', 
                                        color: 'var(--text-main)',
                                        fontSize: '10px'
                                      }}
                                      labelFormatter={(val) => `Weekend Return: ${val.toFixed(2)}%`}
                                    />
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                                    
                                    <Bar yAxisId="right" dataKey="histCount" barSize={8}>
                                      {simulationChartData.map((entry, index) => (
                                        <Cell 
                                          key={index} 
                                          fill={entry.x >= 0 ? "rgba(15, 157, 88, 0.12)" : "rgba(217, 48, 37, 0.08)"} 
                                        />
                                      ))}
                                    </Bar>

                                    <Line 
                                      yAxisId="right" 
                                      type="monotone" 
                                      dataKey="normDist" 
                                      stroke="#3b82f6" 
                                      strokeWidth={1.5} 
                                      dot={false} 
                                      name="Normal Dist" 
                                    />

                                    <Area 
                                      yAxisId="left" 
                                      type="monotone" 
                                      dataKey="modelReturnPositive" 
                                      stroke="#0f9d58" 
                                      fill="rgba(15, 157, 88, 0.1)" 
                                      strokeWidth={2}
                                      name="Modeled Return (+)" 
                                    />

                                    <Area 
                                      yAxisId="left" 
                                      type="monotone" 
                                      dataKey="modelReturnNegative" 
                                      stroke="#d93025" 
                                      fill="rgba(217, 48, 37, 0.06)" 
                                      strokeWidth={2}
                                      name="Modeled Return (-)" 
                                    />

                                    <ReferenceLine yAxisId="left" x={mean - 2 * sd} stroke="var(--text-dim)" strokeDasharray="3 3" label={{ value: '-2SD', position: 'insideTopLeft', fill: 'var(--text-dim)', fontSize: 7 }} />
                                    <ReferenceLine yAxisId="left" x={mean - sd} stroke="var(--text-dim)" strokeDasharray="3 3" label={{ value: '-1SD', position: 'insideTopLeft', fill: 'var(--text-dim)', fontSize: 7 }} />
                                    <ReferenceLine yAxisId="left" x={mean + sd} stroke="var(--text-dim)" strokeDasharray="3 3" label={{ value: '+1SD', position: 'insideTopRight', fill: 'var(--text-dim)', fontSize: 7 }} />
                                    <ReferenceLine yAxisId="left" x={mean + 2 * sd} stroke="var(--text-dim)" strokeDasharray="3 3" label={{ value: '+2SD', position: 'insideTopRight', fill: 'var(--text-dim)', fontSize: 7 }} />
                                    <ReferenceLine yAxisId="left" x={0} stroke="var(--border-color)" strokeWidth={1} />

                                    {activePair && (
                                      <ReferenceLine
                                        yAxisId="left"
                                        x={activePair.pctMoved}
                                        stroke="var(--text-main)"
                                        strokeWidth={2.5}
                                        label={{ value: `Actual: ${activePair.pctMoved.toFixed(2)}%`, position: 'top', fill: 'var(--text-main)', fontSize: 7, fontWeight: 'bold' }}
                                      />
                                    )}
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            {/* Header and Search Input */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '12px', flexWrap: 'wrap' }}>
                              <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Modeled Weekly Outputs</h3>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  placeholder="Search output rows..."
                                  value={threshSearchText}
                                  onChange={(e) => setThreshSearchText(e.target.value)}
                                  className="futures-input"
                                  style={{ width: '180px', padding: '4px 10px', fontSize: '12px', margin: 0 }}
                                />
                                <button 
                                  onClick={() => exportToCSV(sortedPairs)}
                                  className="timeframe-btn"
                                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)' }}
                                >
                                  Export Excel
                                </button>
                                <button 
                                  onClick={() => exportToPDF(sortedPairs)}
                                  className="timeframe-btn"
                                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)' }}
                                >
                                  Export PDF
                                </button>
                              </div>
                            </div>

                            {/* Modeler Details Table */}
                            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                              <table className="pivots-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: '60px', textAlign: 'center' }}>S.No.</th>
                                    <th onClick={() => handleThreshSort('fridayDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                      Fri Close Date {threshSortKey === 'fridayDate' ? (threshSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                    </th>
                                    <th onClick={() => handleThreshSort('fridayClose')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                      Fri Close {threshSortKey === 'fridayClose' ? (threshSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                    </th>
                                    <th onClick={() => handleThreshSort('tuesdayDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                      Tue Close Date {threshSortKey === 'tuesdayDate' ? (threshSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                    </th>
                                    <th onClick={() => handleThreshSort('tuesdayClose')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                      Tue Close {threshSortKey === 'tuesdayClose' ? (threshSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                    </th>
                                    <th onClick={() => handleThreshSort('pctMoved')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                      Actual Change % {threshSortKey === 'pctMoved' ? (threshSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                    </th>
                                    <th onClick={() => handleThreshSort('modeled')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                      Modeled Return % {threshSortKey === 'modeled' ? (threshSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedPairs.map((pair, idx) => {
                                    const isActualUp = pair.pctMoved >= 0;
                                    const isModeledUp = pair.modeled > 0;
                                    const isModeledDown = pair.modeled < 0;
                                    const isSelected = activePair?.fridayDate === pair.fridayDate;
                                    return (
                                      <tr 
                                        key={idx} 
                                        onClick={() => setSelectedThreshWeek(pair)}
                                        style={{ 
                                          cursor: 'pointer', 
                                          backgroundColor: isSelected ? 'var(--hover-bg-active)' : ''
                                        }}
                                      >
                                        <td style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', textAlign: 'center' }}>{idx + 1}</td>
                                        <td style={{ fontSize: '12px' }}>{pair.fridayDate}</td>
                                        <td style={{ fontFamily: 'JetBrains Mono' }}>{formatNumber(pair.fridayClose)}</td>
                                       <td style={{ fontSize: '12px', color: '#f97316' }}>{pair.mondayDate || '-'}</td>
                                       <td style={{ fontFamily: 'JetBrains Mono', color: '#f97316' }}>{pair.mondayClose != null ? formatNumber(pair.mondayClose) : '-'}</td>
                                       <td style={{ fontSize: '12px', color: '#06b6d4' }}>{pair.tuesdayDate}</td>
                                       <td style={{ fontFamily: 'JetBrains Mono', color: '#06b6d4' }}>{formatNumber(pair.tuesdayClose)}</td>
                                        <td style={{ color: isActualUp ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>
                                          {isActualUp ? '+' : ''}{pair.pctMoved.toFixed(2)}%
                                        </td>
                                        <td style={{ 
                                          fontWeight: '700', 
                                          color: isModeledUp ? 'var(--color-up)' : isModeledDown ? 'var(--color-down)' : 'var(--text-muted)',
                                          fontFamily: 'JetBrains Mono' 
                                        }}>
                                          {isModeledUp ? '+' : ''}{pair.modeled.toFixed(2)}%
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div style={{ display: 'flex', padding: '40px', justifyContent: 'center', alignItems: 'center' }}>
                        <div className="spinner"></div>
                        <p style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Calculating simulation metrics...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'optionSimulator' || activeTab === 'sensexOptionSimulator') && (
              <div style={{ marginTop: '24px' }}>
                <div className="insights-strip glass-panel" style={{ borderLeft: '4px solid var(--banknifty-color)', background: 'rgba(168, 85, 247, 0.02)' }}>
                  <div className="insights-tag" style={{ background: 'var(--banknifty-color)' }}>
                    Options Modeler
                  </div>
                  <div className="insights-content">
                    Simulates weekly options selling strategies on {activeTab === 'sensexOptionSimulator' ? 'SENSEX' : 'NIFTY'} from {activeTab === 'sensexOptionSimulator' ? 'Tuesday' : 'Friday'} Close to {activeTab === 'sensexOptionSimulator' ? 'Thursday' : 'Tuesday'} Close using Black-Scholes pricing.
                    {optReport?.hasVIXHistory
                      ? <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: '8px' }}>✅ Historical India VIX used for accurate premium calculation.</span>
                      : <span style={{ color: '#f97316', fontWeight: 600, marginLeft: '8px' }}>⚠️ VIX history unavailable — using VIX slider value for all weeks.</span>
                    }
                    Margins are standard exchange margins in India (Hedged margin benefit applies for Iron Condors).
                  </div>
                </div>

                {optReport && optReport.pairs ? (
                  (() => {
                    const isSensex = activeTab === 'sensexOptionSimulator';
                    const entryDay = isSensex ? 'Tue' : 'Fri';
                    const midDay = isSensex ? 'Wed' : 'Mon';
                    const exitDay = isSensex ? 'Thu' : 'Tue';

                    const filteredPairs = optReport.pairs.filter(p => {
                      return p.fridayDate >= optStartDate && p.fridayDate <= optEndDate;
                    });

                    const r = 0.07;
                     const sigma = optVIX / 100; // fallback sigma (used when histVIX not available)
                     const Tf = 4 / 365;
                     const Tt = 0;
                     const roundStrike = (val) => Math.round(val / 50) * 50;

                     const strategyLabels = {
                       condor: 'Iron Condor',
                       strangle: 'Strangle',
                       straddle: 'Straddle',
                       iron_butterfly: 'Iron Butterfly',
                       bear_call_spread: 'Bear Call Spread',
                       bull_put_spread: 'Bull Put Spread',
                       bull_call_spread: 'Bull Call Spread',
                       bear_put_spread: 'Bear Put Spread',
                       custom: 'Custom Leg Builder'
                     };
                     const activeStrategyLabel = strategyLabels[optStrategy] || optStrategy;

                     const getLotSizeForDate = (dateStr) => {
                        if (activeTab === 'sensexOptionSimulator') return 10;
                        return dateStr >= '2026-01-06' ? 65 : 75;
                      };

                     const getStrategyLegs = (strategy, Sf) => {
                       if (strategy === 'straddle') {
                         return [
                           { action: 'sell', type: 'put', offset: 0 },
                           { action: 'sell', type: 'call', offset: 0 }
                         ];
                       } else if (strategy === 'strangle') {
                         return [
                           { action: 'sell', type: 'put', offset: -optSellDist },
                           { action: 'sell', type: 'call', offset: optSellDist }
                         ];
                       } else if (strategy === 'condor') {
                         return [
                           { action: 'sell', type: 'put', offset: -optSellDist },
                           { action: 'sell', type: 'call', offset: optSellDist },
                           { action: 'buy', type: 'put', offset: -optBuyDist },
                           { action: 'buy', type: 'call', offset: optBuyDist }
                         ];
                       } else if (strategy === 'iron_butterfly') {
                         return [
                           { action: 'sell', type: 'put', offset: 0 },
                           { action: 'sell', type: 'call', offset: 0 },
                           { action: 'buy', type: 'put', offset: -optBuyDist },
                           { action: 'buy', type: 'call', offset: optBuyDist }
                         ];
                       } else if (strategy === 'bull_put_spread') {
                         return [
                           { action: 'sell', type: 'put', offset: -optSellDist },
                           { action: 'buy', type: 'put', offset: -optBuyDist }
                         ];
                       } else if (strategy === 'bear_call_spread') {
                         return [
                           { action: 'sell', type: 'call', offset: optSellDist },
                           { action: 'buy', type: 'call', offset: optBuyDist }
                         ];
                       } else if (strategy === 'bull_call_spread') {
                         return [
                           { action: 'buy', type: 'call', offset: 0 },
                           { action: 'sell', type: 'call', offset: optSellDist }
                         ];
                       } else if (strategy === 'bear_put_spread') {
                         return [
                           { action: 'buy', type: 'put', offset: 0 },
                           { action: 'sell', type: 'put', offset: -optSellDist }
                         ];
                       } else if (strategy === 'custom') {
                          return customLegs.map(leg => {
                            const num = Number(leg.offset);
                            return {
                              ...leg,
                              offset: isNaN(num) ? 0 : num
                            };
                          });
                       }
                       return [];
                     };

                     const getMarginForWeek = (spot, strategy, weekVix, currentLotSize) => {
                       const legs = getStrategyLegs(strategy, spot);
                       const soldPuts = legs.filter(l => l.action === 'sell' && l.type === 'put');
                       const soldCalls = legs.filter(l => l.action === 'sell' && l.type === 'call');
                       const boughtPuts = legs.filter(l => l.action === 'buy' && l.type === 'put');
                       const boughtCalls = legs.filter(l => l.action === 'buy' && l.type === 'call');

                       if (!useAutoMargin) {
                         if (strategy === 'straddle') return optMarginStraddle;
                         if (strategy === 'strangle') return optMarginStrangle;
                         if (strategy === 'condor') return optMarginCondor;
                         
                         const hasHedge = boughtPuts.length > 0 || boughtCalls.length > 0;
                         if (hasHedge) return optMarginCondor;
                         const isATM = soldPuts.some(l => l.offset === 0) || soldCalls.some(l => l.offset === 0);
                         if (isATM) return optMarginStraddle;
                         return optMarginStrangle;
                       }

                       const contractValue = spot * currentLotSize;
                       let totalMargin = 0;

                       soldPuts.forEach(sp => {
                         const strikeSp = roundStrike(spot * (1 + Number(sp.offset) / 100));
                         const protection = boughtPuts
                           .map(bp => roundStrike(spot * (1 + Number(bp.offset) / 100)))
                           .filter(bpStrike => bpStrike < strikeSp);
                         
                         if (protection.length > 0) {
                           const maxBpStrike = Math.max(...protection);
                           const spread = strikeSp - maxBpStrike;
                           totalMargin += (spread * currentLotSize) + (contractValue * (0.007 + weekVix / 1800));
                         } else {
                           totalMargin += contractValue * (0.05 + weekVix / 450);
                         }
                       });

                       soldCalls.forEach(sc => {
                         const strikeSc = roundStrike(spot * (1 + Number(sc.offset) / 100));
                         const protection = boughtCalls
                           .map(bc => roundStrike(spot * (1 + Number(bc.offset) / 100)))
                           .filter(bcStrike => bcStrike > strikeSc);

                         if (protection.length > 0) {
                           const minBcStrike = Math.min(...protection);
                           const spread = minBcStrike - strikeSc;
                           totalMargin += (spread * currentLotSize) + (contractValue * (0.007 + weekVix / 1800));
                         } else {
                           totalMargin += contractValue * (0.05 + weekVix / 450);
                         }
                       });

                       return Math.max(5000, Math.round(totalMargin));
                     };

                    const activeMargin = optStrategy === 'condor' 
                      ? optMarginCondor 
                      : optStrategy === 'strangle' 
                        ? optMarginStrangle 
                        : optMarginStraddle;

                    const enrichedPairs = filteredPairs.map(p => {
                      const Sf = p.fridayClose;
                      const St = p.tuesdayClose;

                      // Sigma per milestone: respect useHistVIX toggle
                      const _hv = useHistVIX && optReport?.hasVIXHistory;
                      const sigFri  = (_hv && p.fridayVIX      != null ? p.fridayVIX      : optVIX) / 100;
                      const sigMon  = (_hv && p.mondayVIX      != null ? p.mondayVIX      : optVIX) / 100;
                      const sigTue  = (_hv && p.tuesdayVIX     != null ? p.tuesdayVIX     : optVIX) / 100;
                      const sigMonO = (_hv && p.mondayOpenVIX  != null ? p.mondayOpenVIX  : optVIX) / 100;
                      const sigTueO = (_hv && p.tuesdayOpenVIX != null ? p.tuesdayOpenVIX : optVIX) / 100;

                      const legs = getStrategyLegs(optStrategy, Sf);
                      
                      let initPrem = 0;
                      let finalVal = 0;
                      
                      const soldPuts = legs.filter(l => l.action === 'sell' && l.type === 'put');
                      const soldCalls = legs.filter(l => l.action === 'sell' && l.type === 'call');
                      const boughtPuts = legs.filter(l => l.action === 'buy' && l.type === 'put');
                      const boughtCalls = legs.filter(l => l.action === 'buy' && l.type === 'call');

                      let sellPutStrike = soldPuts.length > 0 ? roundStrike(Sf * (1 + Number(soldPuts[0].offset) / 100)) : 0;
                      let sellCallStrike = soldCalls.length > 0 ? roundStrike(Sf * (1 + Number(soldCalls[0].offset) / 100)) : 0;
                      let buyPutStrike = boughtPuts.length > 0 ? roundStrike(Sf * (1 + Number(boughtPuts[0].offset) / 100)) : null;
                      let buyCallStrike = boughtCalls.length > 0 ? roundStrike(Sf * (1 + Number(boughtCalls[0].offset) / 100)) : null;

                      let sellPutEntry = soldPuts.length > 0 ? blackScholes(Sf, sellPutStrike, Tf, r, sigFri, 'put') : 0;
                      let sellCallEntry = soldCalls.length > 0 ? blackScholes(Sf, sellCallStrike, Tf, r, sigFri, 'call') : 0;
                      let buyPutEntry = boughtPuts.length > 0 ? blackScholes(Sf, buyPutStrike, Tf, r, sigFri, 'put') : 0;
                      let buyCallEntry = boughtCalls.length > 0 ? blackScholes(Sf, buyCallStrike, Tf, r, sigFri, 'call') : 0;

                      let sellPutExit = soldPuts.length > 0 ? blackScholes(St, sellPutStrike, Tt, r, sigTue, 'put') : 0;
                      let sellCallExit = soldCalls.length > 0 ? blackScholes(St, sellCallStrike, Tt, r, sigTue, 'call') : 0;
                      let buyPutExit = boughtPuts.length > 0 ? blackScholes(St, buyPutStrike, Tt, r, sigTue, 'put') : 0;
                      let buyCallExit = boughtCalls.length > 0 ? blackScholes(St, buyCallStrike, Tt, r, sigTue, 'call') : 0;

                      const pricedLegs = legs.map(leg => {
                        const K = roundStrike(Sf * (1 + Number(leg.offset) / 100));
                        const entry = blackScholes(Sf, K, Tf, r, sigFri, leg.type);
                        const exit = blackScholes(St, K, Tt, r, sigTue, leg.type);
                        
                        const factor = leg.action === 'sell' ? 1 : -1;
                        initPrem += entry * factor;
                        
                        return {
                          ...leg,
                          strike: K,
                          entry,
                          exit
                        };
                      });

                      let adjustedLegs = pricedLegs.map(l => ({ ...l }));
                      let adjustmentDetails = null;
                      let adjCredit = 0;
                      let isPositionClosed = false;
                      let closedMilestone = null;

                      let activeLegsAtMonOpen = adjustedLegs.map(l => ({ ...l }));
                      let activeLegsAtMonClose = adjustedLegs.map(l => ({ ...l }));
                      let activeLegsAtTueOpen = adjustedLegs.map(l => ({ ...l }));

                      if (enableAdj) {
                        const milestones = [];
                        if (p.mondayOpen != null) {
                          milestones.push({ name: 'Mon Open', spot: p.mondayOpen, vix: sigMonO, T: 3.5 / 365, key: 'monOpen' });
                        }
                        if (p.mondayClose != null) {
                          milestones.push({ name: 'Mon Close', spot: p.mondayClose, vix: sigMon, T: 3.0 / 365, key: 'monClose' });
                        }
                        if (p.tuesdayOpen != null) {
                          milestones.push({ name: 'Tue Open', spot: p.tuesdayOpen, vix: sigTueO, T: 0.5 / 365, key: 'tueOpen' });
                        }

                        const triggerDist = adjTriggerType === 'breach' ? 0 : adjTriggerDist;

                        for (let mIdx = 0; mIdx < milestones.length; mIdx++) {
                          const m = milestones[mIdx];
                          const Sm = m.spot;
                          const Vm = m.vix;
                          const Tm = m.T;

                          const scLeg = adjustedLegs.find(l => l.action === 'sell' && l.type === 'call');
                          const spLeg = adjustedLegs.find(l => l.action === 'sell' && l.type === 'put');

                          let triggered = false;
                          let side = null;

                          const isBullCall = optStrategy === 'bull_call_spread';
                          const isBearPut = optStrategy === 'bear_put_spread';

                          if (isBullCall) {
                            const bcLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'call');
                            if (bcLeg) {
                              const Kc1 = bcLeg.strike;
                              const threshold = Kc1 * (1 - triggerDist / 100);
                              if (Sm <= threshold) {
                                triggered = true;
                                side = 'put_side';
                              }
                            }
                          } else if (isBearPut) {
                            const bpLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'put');
                            if (bpLeg) {
                              const Kp2 = bpLeg.strike;
                              const threshold = Kp2 * (1 + triggerDist / 100);
                              if (Sm >= threshold) {
                                triggered = true;
                                side = 'call_side';
                              }
                            }
                          } else {
                            if (scLeg) {
                              const Kc = scLeg.strike;
                              const thresholdCall = Math.abs(Kc - Sf) < 5
                                ? Sf * (1 + triggerDist / 100)
                                : Kc * (1 - triggerDist / 100);
                              if (Sm >= thresholdCall) {
                                triggered = true;
                                side = 'call';
                              }
                            }

                            if (!triggered && spLeg) {
                              const Kp = spLeg.strike;
                              const thresholdPut = Math.abs(Kp - Sf) < 5
                                ? Sf * (1 - triggerDist / 100)
                                : Kp * (1 + triggerDist / 100);
                              if (Sm <= thresholdPut) {
                                triggered = true;
                                side = 'put';
                              }
                            }
                          }

                          if (triggered) {
                            if (adjAction === 'close_position') {
                              isPositionClosed = true;
                              closedMilestone = m.name;
                              adjustedLegs.forEach(leg => {
                                const closePrice = blackScholes(Sm, leg.strike, Tm, r, Vm, leg.type);
                                const factor = leg.action === 'sell' ? -1 : 1;
                                adjCredit += closePrice * factor;
                              });
                              adjustmentDetails = {
                                type: 'closed',
                                milestone: m.name,
                                detail: `Closed position @ spot ${Sm.toFixed(1)}`
                              };
                              break;
                            } else if (adjAction === 'convert_to_condor' && (isBullCall || isBearPut)) {
                              if (isBullCall) {
                                const bcLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'call');
                                const scCallLeg = adjustedLegs.find(l => l.action === 'sell' && l.type === 'call');
                                const spread = (scCallLeg && bcLeg) ? (scCallLeg.strike - bcLeg.strike) : 100;
                                
                                const Kp_sold = roundStrike(Sm);
                                const Kp_bought = Kp_sold - spread;
                                
                                const pSoldPrem = blackScholes(Sm, Kp_sold, Tm, r, Vm, 'put');
                                const pBoughtPrem = blackScholes(Sm, Kp_bought, Tm, r, Vm, 'put');
                                const netCredit = pSoldPrem - pBoughtPrem;
                                
                                adjCredit += netCredit;
                                
                                adjustedLegs.push({
                                  action: 'sell',
                                  type: 'put',
                                  strike: Kp_sold,
                                  entry: pSoldPrem,
                                  exit: blackScholes(St, Kp_sold, Tt, r, sigTue, 'put')
                                });
                                adjustedLegs.push({
                                  action: 'buy',
                                  type: 'put',
                                  strike: Kp_bought,
                                  entry: pBoughtPrem,
                                  exit: blackScholes(St, Kp_bought, Tt, r, sigTue, 'put')
                                });
                                
                                adjustmentDetails = {
                                  type: 'rolled',
                                  milestone: m.name,
                                  detail: `Converted to Condor (Sold Put Spread ${Kp_sold}/${Kp_bought})`
                                };
                              } else if (isBearPut) {
                                const bpLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'put');
                                const spPutLeg = adjustedLegs.find(l => l.action === 'sell' && l.type === 'put');
                                const spread = (bpLeg && spPutLeg) ? (bpLeg.strike - spPutLeg.strike) : 100;
                                
                                const Kc_sold = roundStrike(Sm);
                                const Kc_bought = Kc_sold + spread;
                                
                                const cSoldPrem = blackScholes(Sm, Kc_sold, Tm, r, Vm, 'call');
                                const cBoughtPrem = blackScholes(Sm, Kc_bought, Tm, r, Vm, 'call');
                                const netCredit = cSoldPrem - cBoughtPrem;
                                
                                adjCredit += netCredit;
                                
                                adjustedLegs.push({
                                  action: 'sell',
                                  type: 'call',
                                  strike: Kc_sold,
                                  entry: cSoldPrem,
                                  exit: blackScholes(St, Kc_sold, Tt, r, sigTue, 'call')
                                });
                                adjustedLegs.push({
                                  action: 'buy',
                                  type: 'call',
                                  strike: Kc_bought,
                                  entry: cBoughtPrem,
                                  exit: blackScholes(St, Kc_bought, Tt, r, sigTue, 'call')
                                });
                                
                                adjustmentDetails = {
                                  type: 'rolled',
                                  milestone: m.name,
                                  detail: `Converted to Condor (Sold Call Spread ${Kc_sold}/${Kc_bought})`
                                };
                              }
                              break;
                            } else {
                              const isSingleSidedCall = scLeg && !spLeg;
                              const isSingleSidedPut = spLeg && !scLeg;

                              if (side === 'call' && spLeg) {
                                const Kp = spLeg.strike;
                                const oldPutClose = blackScholes(Sm, Kp, Tm, r, Vm, 'put');
                                const Kp_new = adjAction === 'roll_untested_atm'
                                  ? roundStrike(Sm)
                                  : roundStrike((Sm + Kp) / 2);
                                const newPutOpen = blackScholes(Sm, Kp_new, Tm, r, Vm, 'put');
                                
                                let rollDiff = newPutOpen - oldPutClose;
                                
                                adjustedLegs = adjustedLegs.map(l => {
                                  if (l.action === 'sell' && l.type === 'put') {
                                    return { ...l, strike: Kp_new };
                                  }
                                  return l;
                                });

                                const bpLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'put');
                                if (bpLeg) {
                                  const Kbp = bpLeg.strike;
                                  const spread = Kp - Kbp;
                                  const Kbp_new = Kp_new - spread;
                                  const oldBpClose = blackScholes(Sm, Kbp, Tm, r, Vm, 'put');
                                  const newBpOpen = blackScholes(Sm, Kbp_new, Tm, r, Vm, 'put');
                                  
                                  rollDiff += (oldBpClose - newBpOpen);
                                  
                                  adjustedLegs = adjustedLegs.map(l => {
                                    if (l.action === 'buy' && l.type === 'put') {
                                      return { ...l, strike: Kbp_new };
                                    }
                                    return l;
                                  });
                                }

                                adjCredit += rollDiff;
                                adjustmentDetails = {
                                  type: 'rolled',
                                  milestone: m.name,
                                  detail: `Rolled Puts (Sold: ${Kp}→${Kp_new})`
                                };
                              } else if (side === 'put' && scLeg) {
                                const Kc = scLeg.strike;
                                const oldCallClose = blackScholes(Sm, Kc, Tm, r, Vm, 'call');
                                const Kc_new = adjAction === 'roll_untested_atm'
                                  ? roundStrike(Sm)
                                  : roundStrike((Sm + Kc) / 2);
                                const newCallOpen = blackScholes(Sm, Kc_new, Tm, r, Vm, 'call');

                                let rollDiff = newCallOpen - oldCallClose;

                                adjustedLegs = adjustedLegs.map(l => {
                                  if (l.action === 'sell' && l.type === 'call') {
                                    return { ...l, strike: Kc_new };
                                  }
                                  return l;
                                });

                                const bcLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'call');
                                if (bcLeg) {
                                  const Kbc = bcLeg.strike;
                                  const spread = Kbc - Kc;
                                  const Kbc_new = Kc_new + spread;
                                  const oldBcClose = blackScholes(Sm, Kbc, Tm, r, Vm, 'call');
                                  const newBcOpen = blackScholes(Sm, Kbc_new, Tm, r, Vm, 'call');

                                  rollDiff += (oldBcClose - newBcOpen);

                                  adjustedLegs = adjustedLegs.map(l => {
                                    if (l.action === 'buy' && l.type === 'call') {
                                      return { ...l, strike: Kbc_new };
                                    }
                                    return l;
                                  });
                                }

                                adjCredit += rollDiff;
                                adjustmentDetails = {
                                  type: 'rolled',
                                  milestone: m.name,
                                  detail: `Rolled Calls (Sold: ${Kc}→${Kc_new})`
                                };
                              } else if (side === 'call' && isSingleSidedCall) {
                                const bcLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'call');
                                const spread = (bcLeg) ? (bcLeg.strike - scLeg.strike) : 100;
                                
                                const Kp_sold = roundStrike(Sm);
                                const Kp_bought = Kp_sold - spread;
                                
                                const pSoldPrem = blackScholes(Sm, Kp_sold, Tm, r, Vm, 'put');
                                const pBoughtPrem = blackScholes(Sm, Kp_bought, Tm, r, Vm, 'put');
                                const netCredit = pSoldPrem - pBoughtPrem;
                                
                                adjCredit += netCredit;
                                
                                adjustedLegs.push({
                                  action: 'sell',
                                  type: 'put',
                                  strike: Kp_sold,
                                  entry: pSoldPrem,
                                  exit: blackScholes(St, Kp_sold, Tt, r, sigTue, 'put')
                                });
                                adjustedLegs.push({
                                  action: 'buy',
                                  type: 'put',
                                  strike: Kp_bought,
                                  entry: pBoughtPrem,
                                  exit: blackScholes(St, Kp_bought, Tt, r, sigTue, 'put')
                                });
                                
                                adjustmentDetails = {
                                  type: 'rolled',
                                  milestone: m.name,
                                  detail: `Converted to Condor (Sold Put Spread ${Kp_sold}/${Kp_bought})`
                                };
                              } else if (side === 'put' && isSingleSidedPut) {
                                const bpLeg = adjustedLegs.find(l => l.action === 'buy' && l.type === 'put');
                                const spread = (bpLeg) ? (bpLeg.strike - spLeg.strike) : 100;
                                
                                const Kc_sold = roundStrike(Sm);
                                const Kc_bought = Kc_sold + spread;
                                
                                const cSoldPrem = blackScholes(Sm, Kc_sold, Tm, r, Vm, 'call');
                                const cBoughtPrem = blackScholes(Sm, Kc_bought, Tm, r, Vm, 'call');
                                const netCredit = cSoldPrem - cBoughtPrem;
                                
                                adjCredit += netCredit;
                                
                                adjustedLegs.push({
                                  action: 'sell',
                                  type: 'call',
                                  strike: Kc_sold,
                                  entry: cSoldPrem,
                                  exit: blackScholes(St, Kc_sold, Tt, r, sigTue, 'call')
                                });
                                adjustedLegs.push({
                                  action: 'buy',
                                  type: 'call',
                                  strike: Kc_bought,
                                  entry: cBoughtPrem,
                                  exit: blackScholes(St, Kc_bought, Tt, r, sigTue, 'call')
                                });
                                
                                adjustmentDetails = {
                                  type: 'rolled',
                                  milestone: m.name,
                                  detail: `Converted to Condor (Sold Call Spread ${Kc_sold}/${Kc_bought})`
                                };
                              }
                              break;
                            }
                          }

                          if (m.key === 'monOpen') {
                            activeLegsAtMonOpen = adjustedLegs.map(l => ({ ...l }));
                          }
                          if (m.key === 'monClose') {
                            activeLegsAtMonClose = adjustedLegs.map(l => ({ ...l }));
                          }
                          if (m.key === 'tueOpen') {
                            activeLegsAtTueOpen = adjustedLegs.map(l => ({ ...l }));
                          }
                        }

                        if (isPositionClosed) {
                          activeLegsAtMonOpen = [];
                          activeLegsAtMonClose = [];
                          activeLegsAtTueOpen = [];
                        } else {
                          if (adjustmentDetails) {
                            const triggerM = adjustmentDetails.milestone;
                            if (triggerM === 'Mon Open') {
                              activeLegsAtMonClose = adjustedLegs.map(l => ({ ...l }));
                              activeLegsAtTueOpen = adjustedLegs.map(l => ({ ...l }));
                            } else if (triggerM === 'Mon Close') {
                              activeLegsAtTueOpen = adjustedLegs.map(l => ({ ...l }));
                            }
                          }
                        }
                      }

                      if (isPositionClosed) {
                        finalVal = 0;
                      } else {
                        adjustedLegs.forEach(leg => {
                          const exitPrice = blackScholes(St, leg.strike, Tt, r, sigTue, leg.type);
                          const factor = leg.action === 'sell' ? 1 : -1;
                          finalVal += exitPrice * factor;
                        });
                      }

                      const profitPoints = (initPrem - finalVal) + adjCredit;
                      const vixFriVal = _hv && p.fridayVIX != null ? p.fridayVIX : optVIX;
                      const weekLotSize = getLotSizeForDate(p.fridayDate);
                      const weekMargin = getMarginForWeek(Sf, optStrategy, vixFriVal, weekLotSize);
                      const roc = (profitPoints * weekLotSize / weekMargin) * 100;
                      const entryPremium = initPrem;
                      const exitValue = finalVal;

                      // ── Mid-week premium snapshots using per-day historical VIX ──
                      const Tmo = 3.5 / 365;
                      const Tmc = 3.0 / 365;
                      const Tto = 0.5 / 365;

                      const calcPremiumAtSpot = (spot, T, sig, milestoneLegs, isClosedBeforeThis) => {
                        if (isClosedBeforeThis) {
                          return { sellPut: 0, sellCall: 0, buyPut: 0, buyCall: 0, net: 0, legs: [] };
                        }
                        let net = 0;
                        const legsPriced = milestoneLegs.map(leg => {
                          const price = blackScholes(spot, leg.strike, T, r, sig, leg.type);
                          const factor = leg.action === 'sell' ? 1 : -1;
                          net += price * factor;
                          return { ...leg, strike: leg.strike, price };
                        });
                        
                        const sp = legsPriced.find(l => l.action === 'sell' && l.type === 'put')?.price || 0;
                        const sc = legsPriced.find(l => l.action === 'sell' && l.type === 'call')?.price || 0;
                        const bp = legsPriced.find(l => l.action === 'buy' && l.type === 'put')?.price || 0;
                        const bc = legsPriced.find(l => l.action === 'buy' && l.type === 'call')?.price || 0;
                        
                        return {
                          sellPut: sp,
                          sellCall: sc,
                          buyPut: bp,
                          buyCall: bc,
                          net,
                          legs: legsPriced
                        };
                      };

                      const moSpot = p.mondayOpen  ?? Sf;
                      const mcSpot = p.mondayClose ?? Sf;
                      const toSpot = p.tuesdayOpen ?? p.tuesdayClose;

                      const premMonOpen  = calcPremiumAtSpot(moSpot, Tmo, sigMonO, activeLegsAtMonOpen, isPositionClosed && closedMilestone === 'Mon Open');
                      const premMonClose = calcPremiumAtSpot(mcSpot, Tmc, sigMon, activeLegsAtMonClose, isPositionClosed && (closedMilestone === 'Mon Open' || closedMilestone === 'Mon Close'));
                      const premTueOpen  = calcPremiumAtSpot(toSpot, Tto, sigTueO, activeLegsAtTueOpen, isPositionClosed);

                      // VIX values shown per milestone: respect toggle
                      const _hvDisp = useHistVIX && optReport?.hasVIXHistory;
                      const vixFri  = (_hvDisp && p.fridayVIX      != null) ? p.fridayVIX      : optVIX;
                      const vixMonO = (_hvDisp && p.mondayOpenVIX  != null) ? p.mondayOpenVIX  : optVIX;
                      const vixMonC = (_hvDisp && p.mondayVIX      != null) ? p.mondayVIX      : optVIX;
                      const vixTueO = (_hvDisp && p.tuesdayOpenVIX != null) ? p.tuesdayOpenVIX : optVIX;
                      const vixTueC = (_hvDisp && p.tuesdayVIX     != null) ? p.tuesdayVIX     : optVIX;

                      const adjSoldPuts = adjustedLegs.filter(l => l.action === 'sell' && l.type === 'put');
                      const adjSoldCalls = adjustedLegs.filter(l => l.action === 'sell' && l.type === 'call');
                      const adjBoughtPuts = adjustedLegs.filter(l => l.action === 'buy' && l.type === 'put');
                      const adjBoughtCalls = adjustedLegs.filter(l => l.action === 'buy' && l.type === 'call');

                      sellPutStrike = adjSoldPuts.length > 0 ? adjSoldPuts[0].strike : 0;
                      sellCallStrike = adjSoldCalls.length > 0 ? adjSoldCalls[0].strike : 0;
                      buyPutStrike = adjBoughtPuts.length > 0 ? adjBoughtPuts[0].strike : null;
                      buyCallStrike = adjBoughtCalls.length > 0 ? adjBoughtCalls[0].strike : null;

                      sellPutEntry = soldPuts.length > 0 ? blackScholes(Sf, sellPutStrike, Tf, r, sigFri, 'put') : 0;
                      sellCallEntry = soldCalls.length > 0 ? blackScholes(Sf, sellCallStrike, Tf, r, sigFri, 'call') : 0;
                      buyPutEntry = boughtPuts.length > 0 ? blackScholes(Sf, buyPutStrike, Tf, r, sigFri, 'put') : 0;
                      buyCallEntry = boughtCalls.length > 0 ? blackScholes(Sf, buyCallStrike, Tf, r, sigFri, 'call') : 0;

                      sellPutExit = adjSoldPuts.length > 0 ? blackScholes(St, sellPutStrike, Tt, r, sigTue, 'put') : 0;
                      sellCallExit = adjSoldCalls.length > 0 ? blackScholes(St, sellCallStrike, Tt, r, sigTue, 'call') : 0;
                      buyPutExit = adjBoughtPuts.length > 0 ? blackScholes(St, buyPutStrike, Tt, r, sigTue, 'put') : 0;
                      buyCallExit = adjBoughtCalls.length > 0 ? blackScholes(St, buyCallStrike, Tt, r, sigTue, 'call') : 0;

                      return {
                        ...p,
                        profitPoints,
                        lotSize: weekLotSize,
                        margin: weekMargin,
                        roc,
                        sellPutStrike,
                        sellCallStrike,
                        buyPutStrike,
                        buyCallStrike,
                        sellPutEntry,
                        sellCallEntry,
                        buyPutEntry,
                        buyCallEntry,
                        sellPutExit,
                        sellCallExit,
                        buyPutExit,
                        buyCallExit,
                        entryPremium,
                        exitValue,
                        premMonOpen,
                        premMonClose,
                        premTueOpen,
                        vixFri,
                        vixMonO,
                        vixMonC,
                        vixTueO,
                        vixTueC,
                        pricedLegs,
                        adjustedLegs,
                        adjustmentDetails,
                        adjCredit,
                        isPositionClosed
                      };
                    }).reverse();

                    const totalWeeks = enrichedPairs.length;
                    const winWeeks = enrichedPairs.filter(p => p.profitPoints > 0).length;
                    const winRate = totalWeeks > 0 ? (winWeeks / totalWeeks * 100) : 0;
                    const totalReturn = enrichedPairs.reduce((sum, p) => sum + p.roc, 0);
                    const avgReturn = totalWeeks > 0 ? (totalReturn / totalWeeks) : 0;
                    const avgMargin = enrichedPairs.reduce((sum, p) => sum + p.margin, 0) / (totalWeeks || 1);

                    let cumulative = 0;
                    let peak = 0;
                    let maxDD = 0;
                    const equityCurve = [];

                    enrichedPairs.slice().reverse().forEach(p => {
                      cumulative += p.roc;
                      if (cumulative > peak) peak = cumulative;
                      const dd = peak - cumulative;
                      if (dd > maxDD) maxDD = dd;
                      equityCurve.push({
                        date: p.fridayDate,
                        cumReturn: cumulative,
                        weeklyReturn: p.roc
                      });
                    });

                    // Determine the active clicked week for single payoff charting
                    const activePair = filteredPairs.find(p => p.fridayDate === selectedOptWeek?.fridayDate)
                      ? enrichedPairs.find(p => p.fridayDate === selectedOptWeek?.fridayDate)
                      : enrichedPairs[0];

                    const payoffChartData = (() => {
                      if (!activePair) return [];
                      const data = [];
                      const Sf = activePair.fridayClose;
                      
                      const legs = getStrategyLegs(optStrategy, Sf);
                      
                      let initPrem = 0;
                      legs.forEach(leg => {
                        const K = roundStrike(Sf * (1 + Number(leg.offset) / 100));
                        const entryPrice = blackScholes(Sf, K, Tf, r, sigma, leg.type);
                        const factor = leg.action === 'sell' ? 1 : -1;
                        initPrem += entryPrice * factor;
                      });

                      const steps = 80;
                      const minSpot = Sf * 0.96;
                      const maxSpot = Sf * 1.04;
                      const stepSize = (maxSpot - minSpot) / steps;

                      for (let i = 0; i <= steps; i++) {
                        const spotPot = minSpot + i * stepSize;
                        let finalVal = 0;
                        let finalValExpiry = 0;

                        legs.forEach(leg => {
                          const K = roundStrike(Sf * (1 + Number(leg.offset) / 100));
                          const exitPrice = blackScholes(spotPot, K, Tt, r, sigma, leg.type);
                          const exitPriceExpiry = Math.max(0, leg.type === 'call' ? spotPot - K : K - spotPot);
                          const factor = leg.action === 'sell' ? 1 : -1;
                          
                          finalVal += exitPrice * factor;
                          finalValExpiry += exitPriceExpiry * factor;
                        });

                        const profitPoints = initPrem - finalVal;
                        const activePairMargin = activePair ? activePair.margin : activeMargin;
                        const activePairLotSize = activePair ? activePair.lotSize : 75;
                        const roc = (profitPoints * activePairLotSize / activePairMargin) * 100;
                        const rocPositive = roc >= 0 ? roc : 0;
                        const rocNegative = roc < 0 ? roc : 0;

                        const profitPointsExpiry = initPrem - finalValExpiry;
                        const rocExpiry = (profitPointsExpiry * activePairLotSize / activePairMargin) * 100;

                        data.push({
                          spot: spotPot,
                          roc,
                          rocPositive,
                          rocNegative,
                          rocExpiry
                        });
                      }
                      return data;
                    })();

                    const searchedPairs = enrichedPairs.filter(p => {
                      if (!optSearchText) return true;
                      const term = optSearchText.toLowerCase();
                      const monOpenPremStr = p.premMonOpen?.net != null ? p.premMonOpen.net.toFixed(2) : '';
                      const monClosePremStr = p.premMonClose?.net != null ? p.premMonClose.net.toFixed(2) : '';
                      const tueOpenPremStr = p.premTueOpen?.net != null ? p.premTueOpen.net.toFixed(2) : '';
                      return (
                        p.fridayDate.toLowerCase().includes(term) ||
                        (p.tuesdayDate && p.tuesdayDate.toLowerCase().includes(term)) ||
                        p.fridayClose.toString().includes(term) ||
                        p.tuesdayClose.toString().includes(term) ||
                        p.pctMoved.toFixed(2).includes(term) ||
                        p.roc.toFixed(2).includes(term) ||
                        p.entryPremium.toFixed(2).includes(term) ||
                        monOpenPremStr.includes(term) ||
                        monClosePremStr.includes(term) ||
                        tueOpenPremStr.includes(term) ||
                        p.exitValue.toFixed(2).includes(term)
                      );
                    });

                    const filteredByNetPrem = searchedPairs.filter(p => {
                      if (optNetPremFilter === 'all') return true;
                      if (optNetPremFilter === 'positiveEntry') return p.entryPremium > 0;
                      if (optNetPremFilter === 'debitEntry') return p.entryPremium < 0;
                      if (optNetPremFilter === 'decayed50') return p.exitValue <= (p.entryPremium * 0.5);
                      if (optNetPremFilter === 'decayed80') return p.exitValue <= (p.entryPremium * 0.2);
                      if (optNetPremFilter === 'profitableExit') return p.exitValue < p.entryPremium;
                      if (optNetPremFilter === 'unprofitableExit') return p.exitValue > p.entryPremium;
                      return true;
                    });

                    const filteredByAdj = filteredByNetPrem.filter(p => {
                      if (optAdjFilter === 'all') return true;
                      if (optAdjFilter === 'static') return !p.adjustmentDetails;
                      if (optAdjFilter === 'adjusted') return !!p.adjustmentDetails;
                      if (optAdjFilter === 'rolled') return p.adjustmentDetails?.type === 'rolled';
                      if (optAdjFilter === 'closed') return p.adjustmentDetails?.type === 'closed';
                      return true;
                    });

                    const sortedPairs = [...filteredByAdj].sort((a, b) => {
                      let valA, valB;
                      if (optSortKey === 'entryPremium') {
                        valA = a.entryPremium;
                        valB = b.entryPremium;
                      } else if (optSortKey === 'premMonOpen') {
                        valA = a.premMonOpen?.net ?? -99999;
                        valB = b.premMonOpen?.net ?? -99999;
                      } else if (optSortKey === 'premMonClose') {
                        valA = a.premMonClose?.net ?? -99999;
                        valB = b.premMonClose?.net ?? -99999;
                      } else if (optSortKey === 'premTueOpen') {
                        valA = a.premTueOpen?.net ?? -99999;
                        valB = b.premTueOpen?.net ?? -99999;
                      } else if (optSortKey === 'exitValue') {
                        valA = a.exitValue;
                        valB = b.exitValue;
                      } else {
                        valA = a[optSortKey];
                        valB = b[optSortKey];
                      }

                      if (typeof valA === 'number' && typeof valB === 'number') {
                        return optSortOrder === 'asc' ? valA - valB : valB - valA;
                      }
                      
                      valA = String(valA).toLowerCase();
                      valB = String(valB).toLowerCase();
                      if (valA < valB) return optSortOrder === 'asc' ? -1 : 1;
                      if (valA > valB) return optSortOrder === 'asc' ? 1 : -1;
                      return 0;
                    });

                    const handleOptSort = (key) => {
                      if (optSortKey === key) {
                        setOptSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      } else {
                        setOptSortKey(key);
                        setOptSortOrder('desc');
                      }
                    };

                    const exportOptCSV = (data) => {
                      let csv = `S.No.,${entryDay} Close Date,${entryDay} Close,${entryDay} VIX %,${midDay} Date,${midDay} Close,${exitDay} Close Date,${exitDay} Close,Weekend Change %,Sell Put Strike,Sell Call Strike,Buy Put Strike,Buy Call Strike,Adj Status,Adj Detail,${entryDay} Entry Prem,${midDay} Open Prem,${midDay} Close Prem,${exitDay} Open Prem,${exitDay} Close Prem,Points Profit,Margin Required (₹),ROC %\n`;
                      data.forEach((row, index) => {
                        const adjStatus = row.adjustmentDetails ? row.adjustmentDetails.type.toUpperCase() : 'STATIC';
                        const adjDetail = row.adjustmentDetails ? `"${row.adjustmentDetails.detail} at ${row.adjustmentDetails.milestone} (Cash: ${row.adjCredit.toFixed(1)} pts)"` : 'N/A';
                        const friPrem = row.entryPremium.toFixed(2);
                        const monOPrem = row.premMonOpen?.net != null ? row.premMonOpen.net.toFixed(2) : '-';
                        const monCPrem = row.premMonClose?.net != null ? row.premMonClose.net.toFixed(2) : '-';
                        const tueOPrem = row.premTueOpen?.net != null ? row.premTueOpen.net.toFixed(2) : '-';
                        const tueCPrem = row.exitValue.toFixed(2);
                        csv += `${index + 1},${row.fridayDate},${row.fridayClose},${row.vixFri != null ? row.vixFri.toFixed(2) : '-'}%,${row.mondayDate || '-'},${row.mondayClose != null ? row.mondayClose : '-'},${row.tuesdayDate},${row.tuesdayClose},${row.pctMoved.toFixed(2)}%,${row.sellPutStrike.toFixed(1)},${row.sellCallStrike.toFixed(1)},${row.buyPutStrike ? row.buyPutStrike.toFixed(1) : '-'},${row.buyCallStrike ? row.buyCallStrike.toFixed(1) : '-'},${adjStatus},${adjDetail},${friPrem},${monOPrem},${monCPrem},${tueOPrem},${tueCPrem},${row.profitPoints.toFixed(2)},${row.margin},${row.roc.toFixed(2)}%\n`;
                      });
                      
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.setAttribute('href', url);
                      link.setAttribute('download', `Options_Backtest_Report_${optStrategy}_${optStartDate}_to_${optEndDate}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    };

                    const exportOptPDF = (data) => {
                      const printWindow = window.open('', '_blank', 'width=900,height=700');
                      let tableHtml = `
                        <html>
                        <head>
                          <title>Option Backtest Report - ${optStrategy.toUpperCase()}</title>
                          <style>
                            body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; }
                            h2 { margin-bottom: 5px; color: #111; }
                            p { font-size: 12px; color: #666; margin-top: 0; margin-bottom: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f5f5f5; font-weight: bold; }
                            tr:nth-child(even) { background-color: #fafafa; }
                            .up { color: #0f9d58; font-weight: bold; }
                            .down { color: #d93025; font-weight: bold; }
                          </style>
                        </head>
                        <body>
                          <h2>Option Backtester Report (${optStrategy.toUpperCase()})</h2>
                          <p>Date Range: ${optStartDate} to ${optEndDate} | Total Weeks: ${data.length} | Avg Margin: ₹${Math.round(avgMargin).toLocaleString('en-IN')}</p>
                          <table>
                            <thead>
                              <tr>
                                <th>S.No.</th>
                                <th>${entryDay} Close Date</th>
                                <th>${entryDay} Close</th>
                                <th style="color:#818cf8">${entryDay} VIX %</th>
                                <th style="color:#f97316">${midDay} Date</th>
                                <th style="color:#f97316">${midDay} Close</th>
                                <th style="color:#06b6d4">${exitDay} Close Date</th>
                                <th style="color:#06b6d4">${exitDay} Close</th>
                                <th>Weekend Change %</th>
                                <th>Sell Put</th>
                                <th>Sell Call</th>
                                <th>Buy Put</th>
                                <th>Buy Call</th>
                                <th>Adj Status</th>
                                <th style="color:#818cf8">${entryDay} Entry Prem</th>
                                <th style="color:#f59e0b">${midDay} Open Prem</th>
                                <th style="color:#f97316">${midDay} Close Prem</th>
                                <th style="color:#14b8a6">${exitDay} Open Prem</th>
                                <th style="color:#06b6d4">${exitDay} Close Prem</th>
                                <th>Points Profit</th>
                                <th>Margin Required</th>
                                <th>ROC %</th>
                              </tr>
                            </thead>
                            <tbody>
                      `;
                      
                      data.forEach((row, index) => {
                        const isActualUp = row.pctMoved >= 0;
                        const isRocUp = row.roc > 0;
                        const isRocDown = row.roc < 0;
                        const friPrem = row.entryPremium.toFixed(2);
                        const monOPrem = row.premMonOpen?.net != null ? row.premMonOpen.net.toFixed(2) : '-';
                        const monCPrem = row.premMonClose?.net != null ? row.premMonClose.net.toFixed(2) : '-';
                        const tueOPrem = row.premTueOpen?.net != null ? row.premTueOpen.net.toFixed(2) : '-';
                        const tueCPrem = row.exitValue.toFixed(2);
                        tableHtml += `
                          <tr>
                            <td>${index + 1}</td>
                            <td>${row.fridayDate}</td>
                            <td>${row.fridayClose.toFixed(2)}</td>
                            <td style="color:#818cf8">${row.vixFri != null ? row.vixFri.toFixed(1) : '-'}%</td>
                            <td style="color:#f97316">${row.mondayDate || '-'}</td>
                            <td style="color:#f97316">${row.mondayClose != null ? row.mondayClose.toFixed(2) : '-'}</td>
                            <td style="color:#06b6d4">${row.tuesdayDate}</td>
                            <td style="color:#06b6d4">${row.tuesdayClose.toFixed(2)}</td>
                            <td class="${isActualUp ? 'up' : 'down'}">${isActualUp ? '+' : ''}${row.pctMoved.toFixed(2)}%</td>
                            <td>${row.sellPutStrike.toFixed(1)}</td>
                            <td>${row.sellCallStrike.toFixed(1)}</td>
                            <td>${row.buyPutStrike ? row.buyPutStrike.toFixed(1) : '-'}</td>
                            <td>${row.buyCallStrike ? row.buyCallStrike.toFixed(1) : '-'}</td>
                            <td>${row.adjustmentDetails ? `${row.adjustmentDetails.type.toUpperCase()} (${row.adjustmentDetails.milestone})` : 'STATIC'}</td>
                            <td style="color:#818cf8;font-weight:bold;">${friPrem}</td>
                            <td style="color:#f59e0b;">${monOPrem}</td>
                            <td style="color:#f97316;">${monCPrem}</td>
                            <td style="color:#14b8a6;">${tueOPrem}</td>
                            <td style="color:#06b6d4;font-weight:bold;">${tueCPrem}</td>
                            <td>${row.profitPoints.toFixed(2)}</td>
                            <td>₹${row.margin.toLocaleString('en-IN')}</td>
                            <td class="${isRocUp ? 'up' : isRocDown ? 'down' : ''}">${isRocUp ? '+' : ''}${row.roc.toFixed(2)}%</td>
                          </tr>
                        `;
                      });
                      
                      tableHtml += `
                            </tbody>
                          </table>
                          <script>
                            window.onload = function() {
                              window.print();
                              setTimeout(function() { window.close(); }, 500);
                            };
                          <\/script>
                        </body>
                        </html>
                      `;
                      
                      printWindow.document.write(tableHtml);
                      printWindow.document.close();
                    };

                    return (
                      <div className="option-simulator-grid">
                        {/* Left Column: Strategy and Parameters */}
                        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Simulation Strategy</h2>
                            <select
                              value={optStrategy}
                              onChange={(e) => setOptStrategy(e.target.value)}
                              className="futures-input"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: '13px',
                                borderRadius: '8px',
                                border: '1px solid var(--input-border)',
                                background: 'var(--input-bg)',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                fontFamily: 'inherit'
                              }}
                            >
                              <option value="condor">Iron Condor</option>
                              <option value="strangle">Strangle</option>
                              <option value="straddle">Straddle</option>
                              <option value="iron_butterfly">Iron Butterfly</option>
                              <option value="bear_call_spread">Bear Call Spread (Credit)</option>
                              <option value="bull_put_spread">Bull Put Spread (Credit)</option>
                              <option value="bull_call_spread">Bull Call Spread (Debit)</option>
                              <option value="bear_put_spread">Bear Put Spread (Debit)</option>
                              <option value="custom">Custom Strategy...</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '600', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>Strikes &amp; Volatility</h3>
                            
                            {['condor', 'strangle', 'bull_put_spread', 'bear_call_spread', 'bull_call_spread', 'bear_put_spread'].includes(optStrategy) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sell Strike Distance (%):</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={optSellDist}
                                  onChange={(e) => setOptSellDist(Number(e.target.value))}
                                  className="futures-input"
                                  style={{ width: '80px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono' }}
                                />
                              </div>
                            )}

                            {['condor', 'iron_butterfly', 'bull_put_spread', 'bear_call_spread'].includes(optStrategy) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Buy Strike Distance (%):</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={optBuyDist}
                                  onChange={(e) => setOptBuyDist(Number(e.target.value))}
                                  className="futures-input"
                                  style={{ width: '80px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono' }}
                                />
                              </div>
                            )}

                            {optStrategy === 'custom' && (
                              <div style={{ marginTop: '4px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase' }}>Custom Leg Builder</h4>
                                  <button
                                    onClick={() => {
                                      if (customLegs.length < 4) {
                                        setCustomLegs(prev => [...prev, { action: 'sell', type: 'call', offset: 1.5 }]);
                                      }
                                    }}
                                    disabled={customLegs.length >= 4}
                                    className="mini-tab-btn"
                                    style={{ padding: '2px 8px', fontSize: '10px', background: 'var(--hover-bg-active)', borderRadius: '4px', cursor: customLegs.length >= 4 ? 'not-allowed' : 'pointer' }}
                                  >
                                    + Add Leg
                                  </button>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                                  {customLegs.map((leg, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                                      <select
                                        value={leg.action}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setCustomLegs(prev => prev.map((l, i) => i === index ? { ...l, action: val } : l));
                                        }}
                                        className="futures-input"
                                        style={{ width: '56px', padding: '2px 4px', fontSize: '11px', margin: 0 }}
                                      >
                                        <option value="sell">Sell</option>
                                        <option value="buy">Buy</option>
                                      </select>
                                      
                                      <select
                                        value={leg.type}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setCustomLegs(prev => prev.map((l, i) => i === index ? { ...l, type: val } : l));
                                        }}
                                        className="futures-input"
                                        style={{ width: '56px', padding: '2px 4px', fontSize: '11px', margin: 0 }}
                                      >
                                        <option value="call">Call</option>
                                        <option value="put">Put</option>
                                      </select>
                                      
                                      <div style={{ position: 'relative', width: '76px', display: 'flex', alignItems: 'center' }}>
                                        <input
                                          type="text"
                                          value={leg.offset}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || val === '-' || val === '.' || val === '-.' || !isNaN(Number(val))) {
                                              setCustomLegs(prev => prev.map((l, i) => i === index ? { ...l, offset: val } : l));
                                            }
                                          }}
                                          placeholder="0.0"
                                          className="futures-input"
                                          style={{ width: '100%', padding: '2px 14px 2px 6px', fontSize: '11px', margin: 0, fontFamily: 'JetBrains Mono', textAlign: 'right' }}
                                        />
                                        <span style={{ fontSize: '9px', color: 'var(--text-dim)', position: 'absolute', right: '4px' }}>%</span>
                                      </div>
                                      
                                      {customLegs.length > 1 && (
                                        <button
                                          onClick={() => {
                                            setCustomLegs(prev => prev.filter((_, i) => i !== index));
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--color-down)',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            padding: '0 4px',
                                            fontWeight: 'bold'
                                          }}
                                          title="Remove Leg"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                               {/* VIX Source Toggle */}
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>VIX Source:</span>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   <span style={{ fontSize: '11px', color: useHistVIX ? 'var(--text-dim)' : 'var(--color-up)', fontWeight: useHistVIX ? 400 : 700 }}>Slider</span>
                                   {/* Toggle switch */}
                                   <div
                                     onClick={() => setUseHistVIX(v => !v)}
                                     style={{
                                       width: '40px', height: '20px',
                                       borderRadius: '10px',
                                       background: (useHistVIX && optReport?.hasVIXHistory) ? '#22c55e' : 'var(--border-color)',
                                       position: 'relative',
                                       cursor: 'pointer',
                                       transition: 'background 0.2s',
                                       border: '1px solid var(--border-subtle)'
                                     }}
                                   >
                                     <div style={{
                                       width: '16px', height: '16px',
                                       borderRadius: '50%',
                                       background: 'white',
                                       position: 'absolute',
                                       top: '1px',
                                       left: useHistVIX ? '21px' : '1px',
                                       transition: 'left 0.2s',
                                       boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                     }} />
                                   </div>
                                   <span style={{ fontSize: '11px', color: (useHistVIX && optReport?.hasVIXHistory) ? '#22c55e' : 'var(--text-dim)', fontWeight: (useHistVIX && optReport?.hasVIXHistory) ? 700 : 400 }}>Historical</span>
                                   {useHistVIX && !optReport?.hasVIXHistory && (
                                     <span style={{ fontSize: '9px', color: '#f97316' }} title="Historical VIX data not loaded yet">⚠️</span>
                                   )}
                                 </div>
                               </div>

                               {/* VIX Slider — always visible, dimmed in Historical mode */}
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: (useHistVIX && optReport?.hasVIXHistory) ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                                 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Slider VIX (%) <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{(useHistVIX && optReport?.hasVIXHistory) ? '(inactive)' : '(active)'}</span>:</span>
                                 <input
                                   type="number"
                                   step="0.5"
                                   value={optVIX}
                                   disabled={useHistVIX && !!optReport?.hasVIXHistory}
                                   onChange={(e) => setOptVIX(Number(e.target.value))}
                                   className="futures-input"
                                   style={{ width: '80px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', cursor: (useHistVIX && optReport?.hasVIXHistory) ? 'not-allowed' : 'text' }}
                                 />
                               </div>
                             </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '600', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>Margin Parameters</h3>
                            
                            {/* Margin Source Toggle */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Margin Source:</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: useAutoMargin ? 'var(--text-dim)' : 'var(--color-up)', fontWeight: useAutoMargin ? 400 : 700 }}>Fixed Inputs</span>
                                {/* Toggle switch */}
                                <div
                                  onClick={() => setUseAutoMargin(v => !v)}
                                  style={{
                                    width: '40px', height: '20px',
                                    borderRadius: '10px',
                                    background: useAutoMargin ? '#22c55e' : 'var(--border-color)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    border: '1px solid var(--border-subtle)'
                                  }}
                                >
                                  <div style={{
                                    width: '16px', height: '16px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: '1px',
                                    left: useAutoMargin ? '21px' : '1px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                  }} />
                                </div>
                                <span style={{ fontSize: '11px', color: useAutoMargin ? '#22c55e' : 'var(--text-dim)', fontWeight: useAutoMargin ? 700 : 400 }}>Auto (Dynamic)</span>
                              </div>
                            </div>

                            {/* Straddle Margin Input — dimmed when useAutoMargin is true */}
                            {optStrategy === 'straddle' && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: useAutoMargin ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Straddle Margin (₹) {useAutoMargin ? '(inactive)' : ''}:</span>
                                <input
                                  type="number"
                                  step="5000"
                                  value={optMarginStraddle}
                                  disabled={useAutoMargin}
                                  onChange={(e) => setOptMarginStraddle(Number(e.target.value))}
                                  className="futures-input"
                                  style={{ width: '100px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', cursor: useAutoMargin ? 'not-allowed' : 'text' }}
                                />
                              </div>
                            )}

                            {/* Strangle Margin Input — dimmed when useAutoMargin is true */}
                            {optStrategy === 'strangle' && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: useAutoMargin ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strangle Margin (₹) {useAutoMargin ? '(inactive)' : ''}:</span>
                                <input
                                  type="number"
                                  step="5000"
                                  value={optMarginStrangle}
                                  disabled={useAutoMargin}
                                  onChange={(e) => setOptMarginStrangle(Number(e.target.value))}
                                  className="futures-input"
                                  style={{ width: '100px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', cursor: useAutoMargin ? 'not-allowed' : 'text' }}
                                />
                              </div>
                            )}

                            {/* Iron Condor Margin Input — dimmed when useAutoMargin is true */}
                            {optStrategy === 'condor' && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: useAutoMargin ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Iron Condor Margin (₹) {useAutoMargin ? '(inactive)' : ''}:</span>
                                <input
                                  type="number"
                                  step="5000"
                                  value={optMarginCondor}
                                  disabled={useAutoMargin}
                                  onChange={(e) => setOptMarginCondor(Number(e.target.value))}
                                  className="futures-input"
                                  style={{ width: '100px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', cursor: useAutoMargin ? 'not-allowed' : 'text' }}
                                />
                              </div>
                            )}
                          </div>

                           {/* Defensive Hedging / Adjustments section */}
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                             <h3 style={{ fontSize: '14px', fontWeight: '600', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               🛡️ Defensive Hedging
                             </h3>

                             {/* Enable Adjustments Toggle */}
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enable Adjustments:</span>
                               <div
                                 onClick={() => setEnableAdj(v => !v)}
                                 style={{
                                   width: '40px', height: '20px',
                                   borderRadius: '10px',
                                   background: enableAdj ? '#e11d48' : 'var(--border-color)',
                                   position: 'relative',
                                   cursor: 'pointer',
                                   transition: 'background 0.2s',
                                   border: '1px solid var(--border-subtle)'
                                 }}
                               >
                                 <div style={{
                                   width: '16px', height: '16px',
                                   borderRadius: '50%',
                                   background: 'white',
                                   position: 'absolute',
                                   top: '1px',
                                   left: enableAdj ? '21px' : '1px',
                                   transition: 'left 0.2s',
                                   boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                 }} />
                               </div>
                             </div>

                             {enableAdj && (
                               <>
                                 {/* Trigger Type Select */}
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Trigger Rule:</span>
                                   <select
                                     value={adjTriggerType}
                                     onChange={(e) => setAdjTriggerType(e.target.value)}
                                     className="futures-input"
                                     style={{ width: '100px', padding: '4px', fontSize: '11px', margin: 0 }}
                                   >
                                     <option value="breach">Strike Breach</option>
                                     <option value="distance">Offset Dist</option>
                                   </select>
                                 </div>

                                 {/* Trigger Distance offset (only for distance) */}
                                 {adjTriggerType === 'distance' && (
                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                     <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Trigger Offset (%):</span>
                                     <input
                                       type="number"
                                       step="0.1"
                                       value={adjTriggerDist}
                                       onChange={(e) => setAdjTriggerDist(Number(e.target.value))}
                                       className="futures-input"
                                       style={{ width: '80px', padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono' }}
                                     />
                                   </div>
                                 )}

                                 {/* Adjustment Action Select */}
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Action:</span>
                                   <select
                                     value={adjAction}
                                     onChange={(e) => setAdjAction(e.target.value)}
                                     className="futures-input"
                                     style={{ width: '120px', padding: '4px', fontSize: '11px', margin: 0 }}
                                   >
                                     <option value="roll_untested_atm">Roll Untested ATM</option>
                                     <option value="roll_untested_halfway">Roll Halfway</option>
                                     <option value="close_position">Close Position</option>
                                     <option value="convert_to_condor">Convert to Condor (Sell opposite side)</option>
                                   </select>
                                 </div>
                               </>
                             )}
                           </div>

                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            <h4 style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px', marginTop: '4px' }}>Model Overview:</h4>
                            <ul style={{ paddingLeft: '16px', margin: 0 }}>
                              <li>Friday Entry: Spot standard pricing ($T = 6/365$).</li>
                              <li>Tuesday Exit: Remaining premium ($T = 2/365$).</li>
                              <li>Interest Rate modeled at 7% per annum.</li>
                              <li>Lot size: 75 (before 6-Jan-2026) / 65 (on/after).</li>
                            </ul>
                          </div>

                          {/* Cumulative Growth Curve Chart - inside Left Column */}
                          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '8px' }}>
                            <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: 0 }}>
                              Cumulative Capital Growth Curve (ROC %)
                            </h4>
                            <div style={{ height: '220px', width: '100%' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={equityCurve} margin={{ top: 5, right: 5, left: -20, bottom: -5 }}>
                                  <defs>
                                    <linearGradient id="optEquityGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="var(--banknifty-color)" stopOpacity={0.2} />
                                      <stop offset="95%" stopColor="var(--banknifty-color)" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis 
                                    dataKey="date" 
                                    tick={{ fontSize: 8 }}
                                    stroke="var(--text-dim)"
                                  />
                                  <YAxis 
                                    tick={{ fontSize: 8 }}
                                    stroke="var(--text-dim)"
                                    tickFormatter={(v) => v + '%'}
                                  />
                                  <Tooltip
                                    contentStyle={{ 
                                      backgroundColor: 'var(--tooltip-bg)', 
                                      border: '1px solid var(--tooltip-border)', 
                                      borderRadius: '8px', 
                                      color: 'var(--text-main)',
                                      fontSize: '10px'
                                    }}
                                    labelFormatter={(val) => `Date: ${val}`}
                                    formatter={(v) => [`${v.toFixed(2)}%`, 'Cumulative Return']}
                                  />
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                                  <Area 
                                    type="monotone" 
                                    dataKey="cumReturn" 
                                    stroke="var(--banknifty-color)" 
                                    fillOpacity={1} 
                                    fill="url(#optEquityGrad)" 
                                    strokeWidth={2}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Results & Payoff Chart */}
                        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{isSensex ? 'Sensex option stimulator Tue Close - Thurs close' : 'Nifty option stimulator Fri Close - Tues close'} - Backtester Filters ({activeStrategyLabel})</h2>
                            
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From:</span>
                                <input
                                  type="date"
                                  value={optStartDate}
                                  onChange={(e) => setOptStartDate(e.target.value)}
                                  className="futures-input"
                                  style={{ padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', width: '130px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To:</span>
                                <input
                                  type="date"
                                  value={optEndDate}
                                  onChange={(e) => setOptEndDate(e.target.value)}
                                  className="futures-input"
                                  style={{ padding: '4px 8px', margin: 0, fontFamily: 'JetBrains Mono', width: '130px' }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Summary Metrics Cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                            <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Average Weekly ROC</div>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: avgReturn >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                {avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(2)}%
                              </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Strategy Win Rate</div>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-up)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                {winRate.toFixed(1)}%
                              </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total Return</div>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: totalReturn >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
                              </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max Drawdown</div>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-down)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                {maxDD.toFixed(1)}%
                              </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '12px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{useAutoMargin ? 'Avg Margin Required' : 'Margin Required'}</div>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                                ₹{(avgMargin / 1000).toFixed(1)}k
                              </div>
                            </div>
                          </div>

                          {/* Payoff Simulation Chart */}
                          <div className="glass-panel" style={{ padding: '16px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                Payoff Simulation: {activePair ? activePair.fridayDate : 'Select a Week'}
                              </h4>
                              {activePair && (
                                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                                  Actual Close: <strong style={{ color: activePair.pctMoved >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>{activePair.tuesdayClose.toFixed(1)}</strong>
                                </div>
                              )}
                            </div>
                            <div style={{ height: '320px', width: '100%' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={payoffChartData} margin={{ top: 15, right: 25, left: -10, bottom: -5 }}>
                                  <XAxis 
                                    dataKey="spot" 
                                    type="number"
                                    domain={['auto', 'auto']}
                                    tick={{ fontSize: 8 }}
                                    tickFormatter={(v) => Math.round(v)}
                                    stroke="var(--text-dim)"
                                  />
                                  <YAxis 
                                    tick={{ fontSize: 8 }}
                                    stroke="var(--text-dim)"
                                    tickFormatter={(v) => v.toFixed(1) + '%'}
                                  />
                                  <Tooltip
                                    contentStyle={{ 
                                      backgroundColor: 'var(--tooltip-bg)', 
                                      border: '1px solid var(--tooltip-border)', 
                                      borderRadius: '8px', 
                                      color: 'var(--text-main)',
                                      fontSize: '10px'
                                    }}
                                    labelFormatter={(val) => `Spot Price: ${val.toFixed(1)}`}
                                    formatter={(value, name, props) => {
                                      if ((props.dataKey === 'rocPositive' || props.dataKey === 'rocNegative') && value === 0) {
                                        return null;
                                      }
                                      const formattedVal = `${value.toFixed(2)}%`;
                                      if (props.dataKey === 'rocExpiry') {
                                        return [formattedVal, 'Expiration ROC (Tue)'];
                                      }
                                      return [formattedVal, 'Tuesday Close ROC'];
                                    }}
                                  />
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line-color)" />
                                  
                                  <Area 
                                    type="monotone" 
                                    dataKey="rocPositive" 
                                    stroke="#0f9d58" 
                                    fill="rgba(15, 157, 88, 0.1)" 
                                    strokeWidth={1.5}
                                    name="Tuesday Close ROC (Profitable)"
                                  />
                                  <Area 
                                    type="monotone" 
                                    dataKey="rocNegative" 
                                    stroke="#d93025" 
                                    fill="rgba(217, 48, 37, 0.06)" 
                                    strokeWidth={1.5}
                                    name="Tuesday Close ROC (Unprofitable)"
                                  />
                                  <Line 
                                    type="monotone" 
                                    dataKey="rocExpiry" 
                                    stroke="#a855f7" 
                                    strokeDasharray="4 4"
                                    strokeWidth={2.5}
                                    dot={false}
                                    name="Expiration Payoff (Tue)" 
                                  />
                                  {activePair && (
                                    <>
                                      {/* Friday Entry Spot */}
                                      <ReferenceLine x={activePair.fridayClose} stroke="#999" strokeDasharray="3 3" label={{ value: `Entry (${entryDay}): ${activePair.fridayClose.toFixed(0)}`, position: 'insideBottom', fill: '#999', fontSize: 7, fontWeight: 'bold' }} />
                                      {/* Monday Open Spot — amber */}
                                      {activePair.mondayOpen != null && (
                                        <ReferenceLine x={activePair.mondayOpen} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" label={{ value: `${midDay} Open: ${activePair.mondayOpen.toFixed(0)}`, position: 'insideTopLeft', fill: '#f59e0b', fontSize: 7, fontWeight: 'bold' }} />
                                      )}
                                      {/* Monday Close Spot — orange */}
                                      {activePair.mondayClose != null && (
                                        <ReferenceLine x={activePair.mondayClose} stroke="#f97316" strokeWidth={2} strokeDasharray="5 3" label={{ value: `${midDay} Close: ${activePair.mondayClose.toFixed(0)}`, position: 'insideTopLeft', fill: '#f97316', fontSize: 7, fontWeight: 'bold' }} />
                                      )}
                                      {/* Tuesday Open Spot — teal */}
                                      {activePair.tuesdayOpen != null && (
                                        <ReferenceLine x={activePair.tuesdayOpen} stroke="#14b8a6" strokeWidth={1.5} strokeDasharray="4 2" label={{ value: `${exitDay} Open: ${activePair.tuesdayOpen.toFixed(0)}`, position: 'insideBottomRight', fill: '#14b8a6', fontSize: 7, fontWeight: 'bold' }} />
                                      )}
                                      {/* Actual Tuesday / Expiry Close Spot — cyan */}
                                      <ReferenceLine x={activePair.tuesdayClose} stroke="#06b6d4" strokeWidth={2} label={{ value: `Expiry (${exitDay}): ${activePair.tuesdayClose.toFixed(0)}`, position: 'top', fill: '#06b6d4', fontSize: 7, fontWeight: 'bold' }} />
                                      
                                      {/* Call / Put strikes */}
                                      {optStrategy === 'straddle' && (
                                        <ReferenceLine x={activePair.sellCallStrike} stroke="var(--color-down)" strokeDasharray="3 3" label={{ value: `Straddle Strike: ${activePair.sellCallStrike.toFixed(0)}`, position: 'insideTop', fill: 'var(--color-down)', fontSize: 7, fontWeight: 'bold' }} />
                                      )}
                                      {optStrategy !== 'straddle' && (
                                        <>
                                          <ReferenceLine x={activePair.sellCallStrike} stroke="var(--color-down)" strokeDasharray="3 3" label={{ value: `Sell Call: ${activePair.sellCallStrike.toFixed(0)}`, position: 'insideTopRight', fill: 'var(--color-down)', fontSize: 7, fontWeight: 'bold' }} />
                                          <ReferenceLine x={activePair.sellPutStrike} stroke="var(--color-down)" strokeDasharray="3 3" label={{ value: `Sell Put: ${activePair.sellPutStrike.toFixed(0)}`, position: 'insideTopLeft', fill: 'var(--color-down)', fontSize: 7, fontWeight: 'bold' }} />
                                        </>
                                      )}
                                      {optStrategy === 'condor' && (
                                        <>
                                          <ReferenceLine x={activePair.buyCallStrike} stroke="#888" strokeDasharray="3 3" label={{ value: `Buy Call: ${activePair.buyCallStrike.toFixed(0)}`, position: 'insideBottomRight', fill: '#888', fontSize: 7 }} />
                                          <ReferenceLine x={activePair.buyPutStrike} stroke="#888" strokeDasharray="3 3" label={{ value: `Buy Put: ${activePair.buyPutStrike.toFixed(0)}`, position: 'insideBottomLeft', fill: '#888', fontSize: 7 }} />
                                        </>
                                      )}
                                    </>
                                  )}
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Selected Week Leg Price Breakdown Card */}
                          {activePair && (
                            <div className="glass-panel" style={{ padding: '16px', background: 'var(--hover-bg)', border: '1px solid var(--border-subtle)', marginTop: '8px' }}>
                              <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Leg Premium Breakdown: {activePair.fridayDate}
                                {optReport?.hasVIXHistory
                                  ? <span style={{ fontSize: '9px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, letterSpacing: 0 }}>✅ Historical VIX</span>
                                  : <span style={{ fontSize: '9px', background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, letterSpacing: 0 }}>⚠️ Slider VIX {optVIX}%</span>
                                }
                              </h4>

                              {activePair.adjustmentDetails && (
                                <div style={{ 
                                  background: activePair.adjustmentDetails.type === 'closed' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                  color: activePair.adjustmentDetails.type === 'closed' ? '#f87171' : '#fbbf24',
                                  border: `1px solid ${activePair.adjustmentDetails.type === 'closed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  fontSize: '11px',
                                  marginBottom: '12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span>
                                    🛡️ <strong>Defensive Hedging Triggered:</strong> {activePair.adjustmentDetails.detail} at <strong>{activePair.adjustmentDetails.milestone}</strong>
                                  </span>
                                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>
                                    Net Roll Cash: {activePair.adjCredit >= 0 ? '+' : ''}{activePair.adjCredit.toFixed(2)} pts
                                  </span>
                                </div>
                              )}

                              {/* 5-column milestone grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(125px, 1fr))', gap: '10px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '6px' }}>

                                {/* ── Col 1: Friday Entry ── */}
                                <div style={{ minWidth: '140px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#999', borderBottom: '2px solid #555', paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>📅 {entryDay} Entry</span>
                                    <span style={{ fontSize: '9px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700, letterSpacing: 0 }}>VIX {activePair.vixFri?.toFixed(1) ?? optVIX}%</span>
                                  </div>
                                  <div style={{ fontSize: '11px', marginBottom: '6px', color: 'var(--text-muted)' }}>
                                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--text-main)', fontSize: '13px' }}>{activePair.fridayClose.toFixed(2)}</span>
                                    <span style={{ fontSize: '9px', marginLeft: '4px', color: 'var(--text-dim)' }}>Close • {activePair.fridayDate}</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                    {activePair.pricedLegs?.map((leg, lIdx) => (
                                      <div key={lIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                          {leg.action.toUpperCase()} {leg.type.toUpperCase()} ({leg.strike}):
                                        </span>
                                        <span style={{ fontFamily: 'JetBrains Mono', color: leg.action === 'sell' ? 'var(--color-up)' : 'var(--color-down)' }}>
                                          {leg.action === 'sell' ? '+' : '-'}{leg.entry.toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-subtle)', paddingTop: '5px', marginTop: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                                      <span>Net Premium:</span>
                                      <span style={{ fontFamily: 'JetBrains Mono', color: activePair.entryPremium >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                        {activePair.entryPremium >= 0 ? '+' : ''}{activePair.entryPremium.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* ── Col 2: Monday Open ── */}
                                <div style={{ minWidth: '140px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#f59e0b', borderBottom: '2px solid #f59e0b', paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🔔 {midDay} Open</span>
                                    <span style={{ fontSize: '9px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700, letterSpacing: 0 }}>VIX {activePair.vixMonO?.toFixed(1) ?? optVIX}%</span>
                                  </div>
                                  {activePair.mondayOpen != null ? (
                                    <>
                                      <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                                        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#f59e0b', fontSize: '13px' }}>{activePair.mondayOpen.toFixed(2)}</span>
                                        <span style={{ fontSize: '9px', marginLeft: '4px', color: 'var(--text-dim)' }}>Open • {activePair.mondayDate}</span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                        {activePair.premMonOpen.legs?.map((leg, lIdx) => (
                                          <div key={lIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                              {leg.action.toUpperCase()} {leg.type.toUpperCase()}:
                                            </span>
                                            <span style={{ fontFamily: 'JetBrains Mono' }}>
                                              {leg.price.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-subtle)', paddingTop: '5px', marginTop: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                                          <span>Net Value:</span>
                                          <span style={{ fontFamily: 'JetBrains Mono', color: activePair.premMonOpen.net <= activePair.entryPremium ? 'var(--color-up)' : 'var(--color-down)' }}>{activePair.premMonOpen.net.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic', paddingTop: '8px' }}>Holiday / No data</div>
                                  )}
                                </div>

                                {/* ── Col 3: Monday Close ── */}
                                <div style={{ minWidth: '140px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#f97316', borderBottom: '2px solid #f97316', paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🌆 {midDay} Close</span>
                                    <span style={{ fontSize: '9px', background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700, letterSpacing: 0 }}>VIX {activePair.vixMonC?.toFixed(1) ?? optVIX}%</span>
                                  </div>
                                  {activePair.mondayClose != null ? (
                                    <>
                                      <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                                        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#f97316', fontSize: '13px' }}>{activePair.mondayClose.toFixed(2)}</span>
                                        <span style={{ fontSize: '9px', marginLeft: '4px', color: 'var(--text-dim)' }}>Close • {activePair.mondayDate}</span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                        {activePair.premMonClose.legs?.map((leg, lIdx) => (
                                          <div key={lIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                              {leg.action.toUpperCase()} {leg.type.toUpperCase()}:
                                            </span>
                                            <span style={{ fontFamily: 'JetBrains Mono' }}>
                                              {leg.price.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-subtle)', paddingTop: '5px', marginTop: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                                          <span>Net Value:</span>
                                          <span style={{ fontFamily: 'JetBrains Mono', color: activePair.premMonClose.net <= activePair.entryPremium ? 'var(--color-up)' : 'var(--color-down)' }}>{activePair.premMonClose.net.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic', paddingTop: '8px' }}>Holiday / No data</div>
                                  )}
                                </div>

                                {/* ── Col 4: Tuesday Open ── */}
                                <div style={{ minWidth: '140px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#14b8a6', borderBottom: '2px solid #14b8a6', paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🌅 {exitDay} Open</span>
                                    <span style={{ fontSize: '9px', background: 'rgba(20,184,166,0.15)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.3)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700, letterSpacing: 0 }}>VIX {activePair.vixTueO?.toFixed(1) ?? optVIX}%</span>
                                  </div>
                                  {activePair.tuesdayOpen != null ? (
                                    <>
                                      <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                                        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#14b8a6', fontSize: '13px' }}>{activePair.tuesdayOpen.toFixed(2)}</span>
                                        <span style={{ fontSize: '9px', marginLeft: '4px', color: 'var(--text-dim)' }}>Open • {activePair.tuesdayDate}</span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                        {activePair.premTueOpen.legs?.map((leg, lIdx) => (
                                          <div key={lIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>
                                              {leg.action.toUpperCase()} {leg.type.toUpperCase()}:
                                            </span>
                                            <span style={{ fontFamily: 'JetBrains Mono' }}>
                                              {leg.price.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-subtle)', paddingTop: '5px', marginTop: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                                          <span>Net Value:</span>
                                          <span style={{ fontFamily: 'JetBrains Mono', color: activePair.premTueOpen.net <= activePair.entryPremium ? 'var(--color-up)' : 'var(--color-down)' }}>{activePair.premTueOpen.net.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic', paddingTop: '8px' }}>No data</div>
                                  )}
                                </div>

                                {/* ── Col 5: Tuesday Close (Exit) ── */}
                                <div style={{ minWidth: '140px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#06b6d4', borderBottom: '2px solid #06b6d4', paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🏁 {exitDay} Close</span>
                                    <span style={{ fontSize: '9px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '3px', padding: '1px 5px', fontWeight: 700, letterSpacing: 0 }}>VIX {activePair.vixTueC?.toFixed(1) ?? optVIX}%</span>
                                  </div>
                                  <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#06b6d4', fontSize: '13px' }}>{activePair.tuesdayClose.toFixed(2)}</span>
                                    <span style={{ fontSize: '9px', marginLeft: '4px', color: 'var(--text-dim)' }}>Close • {activePair.tuesdayDate}</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                                    {activePair.pricedLegs?.map((leg, lIdx) => (
                                      <div key={lIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                          {leg.action.toUpperCase()} {leg.type.toUpperCase()}:
                                        </span>
                                        <span style={{ fontFamily: 'JetBrains Mono' }}>
                                          {leg.exit.toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-subtle)', paddingTop: '5px', marginTop: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                                      <span>Net Exit Value:</span>
                                      <span style={{ fontFamily: 'JetBrains Mono', color: activePair.exitValue <= activePair.entryPremium ? 'var(--color-up)' : 'var(--color-down)' }}>{activePair.exitValue.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>

                              </div>

                              {/* Net Summary Bar */}
                              <div style={{ 
                                display: 'flex', 
                                flexWrap: 'wrap',
                                gap: '12px',
                                alignItems: 'center', 
                                marginTop: '12px', 
                                padding: '8px 12px', 
                                background: 'rgba(0,0,0,0.02)', 
                                borderRadius: '6px', 
                                fontSize: '11px',
                                borderTop: '1px solid var(--border-subtle)'
                              }}>
                                <div>
                                  Result: <strong style={{ color: activePair.profitPoints >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                    {activePair.profitPoints >= 0 ? 'PROFIT' : 'LOSS'} ({activePair.profitPoints >= 0 ? '+' : ''}{activePair.profitPoints.toFixed(2)} pts)
                                  </strong>
                                </div>
                                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                                  Margin: <strong>₹{activePair.margin.toLocaleString('en-IN')}</strong>
                                </div>
                                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                                  Lot Return: <strong>₹{(activePair.profitPoints * activePair.lotSize).toFixed(0)}</strong> <span style={{ color: 'var(--text-dim)' }}>(Qty: {activePair.lotSize})</span>
                                </div>
                                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                                  Weekly ROC: <strong style={{ color: activePair.roc >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                    {activePair.roc >= 0 ? '+' : ''}{activePair.roc.toFixed(2)}%
                                  </strong>
                                </div>
                                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px', marginLeft: 'auto' }}>
                                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>Fri Close→Tue Close:</span>{' '}
                                  <strong style={{ color: activePair.pctMoved >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                                    {activePair.pctMoved >= 0 ? '+' : ''}{activePair.pctMoved.toFixed(2)}%
                                  </strong>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Header and Search/Download Inputs */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '12px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Strategy Outputs - {activeStrategyLabel}</h3>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <select
                                value={optAdjFilter}
                                onChange={(e) => setOptAdjFilter(e.target.value)}
                                className="futures-input"
                                style={{ width: '130px', padding: '4px 8px', fontSize: '12px', margin: 0 }}
                              >
                                <option value="all">All Statuses</option>
                                <option value="static">Static Only</option>
                                <option value="adjusted">Adjusted Only</option>
                                <option value="rolled">Rolled Only</option>
                                <option value="closed">Closed Only</option>
                              </select>

                              <select
                                value={optNetPremFilter}
                                onChange={(e) => setOptNetPremFilter(e.target.value)}
                                className="futures-input"
                                style={{ width: '150px', padding: '4px 8px', fontSize: '12px', margin: 0 }}
                              >
                                <option value="all">All Net Premiums</option>
                                <option value="positiveEntry">Credit Entry (+)</option>
                                <option value="debitEntry">Debit Entry (-)</option>
                                <option value="decayed50">Decay ≥ 50% ({exitDay})</option>
                                <option value="decayed80">Decay ≥ 80% ({exitDay})</option>
                                <option value="profitableExit">Profitable Exit ({exitDay} &lt; {entryDay})</option>
                                <option value="unprofitableExit">Loss Exit ({exitDay} &gt; {entryDay})</option>
                              </select>

                              <input
                                type="text"
                                placeholder="Search output rows..."
                                value={optSearchText}
                                onChange={(e) => setOptSearchText(e.target.value)}
                                className="futures-input"
                                style={{ width: '160px', padding: '4px 10px', fontSize: '12px', margin: 0 }}
                              />
                              <button 
                                onClick={() => exportOptCSV(sortedPairs)}
                                className="timeframe-btn"
                                style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)' }}
                              >
                                Export Excel
                              </button>
                              <button 
                                onClick={() => exportOptPDF(sortedPairs)}
                                className="timeframe-btn"
                                style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)' }}
                              >
                                Export PDF
                              </button>
                              <button 
                                onClick={() => setIsTableExpanded(prev => !prev)}
                                className="timeframe-btn"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: isTableExpanded ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(168, 85, 247, 0.2))' : 'var(--hover-bg)',
                                  color: isTableExpanded ? 'var(--nifty-color)' : 'inherit',
                                  border: isTableExpanded ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid var(--border-subtle)',
                                  fontWeight: 600
                                }}
                              >
                                {isTableExpanded ? 'Collapse Table ⬆' : 'Expand Full Table ↕'}
                              </button>
                            </div>
                          </div>

                          {/* Column Preset Views & Table Scroll Controls */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--panel-bg-subtle)',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            marginTop: '10px',
                            marginBottom: '6px',
                            gap: '8px',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Preset Views:</span>
                              {[
                                { id: 'all', label: '📊 All Columns (22)' },
                                { id: 'premiums', label: '💰 Premiums & PnL View (Focus After Adj Status)' },
                                { id: 'strikes', label: '🎯 Strikes & Hedge View' },
                                { id: 'spots', label: '📈 Spot Prices View' }
                              ].map(mode => (
                                <button
                                  key={mode.id}
                                  onClick={() => setOptColumnMode(mode.id)}
                                  className="mini-tab-btn"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    background: optColumnMode === mode.id ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(168, 85, 247, 0.2))' : 'transparent',
                                    color: optColumnMode === mode.id ? 'var(--nifty-color)' : 'var(--text-muted)',
                                    fontWeight: optColumnMode === mode.id ? 700 : 500,
                                    border: optColumnMode === mode.id ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid transparent'
                                  }}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                onClick={() => {
                                  const el = document.getElementById('strategy-table-scroll');
                                  if (el) el.scrollLeft = 0;
                                }}
                                className="mini-tab-btn"
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                                title="Scroll table to left edge"
                              >
                                ◀ Spot Prices
                              </button>
                              <button
                                onClick={() => {
                                  const el = document.getElementById('strategy-table-scroll');
                                  if (el) el.scrollLeft = 750;
                                }}
                                className="mini-tab-btn"
                                style={{ fontSize: '11px', padding: '3px 10px', color: '#00f2fe', background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)', fontWeight: 600 }}
                                title="Scroll table directly to Leg Premiums after Adj Status"
                              >
                                Scroll to Leg Premiums ▶
                              </button>
                            </div>
                          </div>

                          {/* Outputs Details Table */}
                          <div
                            id="strategy-table-scroll"
                            style={{
                              maxHeight: isTableExpanded ? '1200px' : '550px',
                              overflowY: 'auto',
                              overflowX: 'auto',
                              width: '100%',
                              maxWidth: '100%',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '8px',
                              transition: 'max-height 0.3s ease'
                            }}
                          >
                            <table className="pivots-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '45px', textAlign: 'center' }}>S.No.</th>
                                  <th onClick={() => handleOptSort('fridayDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    {entryDay} Date {optSortKey === 'fridayDate' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                  </th>
                                  
                                  {(optColumnMode === 'all' || optColumnMode === 'spots') && (
                                    <>
                                      <th onClick={() => handleOptSort('fridayClose')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        {entryDay} Close {optSortKey === 'fridayClose' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('vixFri')} style={{ cursor: 'pointer', userSelect: 'none', color: '#818cf8' }}>
                                        {entryDay} VIX % {optSortKey === 'vixFri' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('mondayDate')} style={{ cursor: 'pointer', userSelect: 'none', color: '#f97316' }}>
                                        {midDay} Date {optSortKey === 'mondayDate' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('mondayClose')} style={{ cursor: 'pointer', userSelect: 'none', color: '#f97316' }}>
                                        {midDay} Close {optSortKey === 'mondayClose' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('tuesdayDate')} style={{ cursor: 'pointer', userSelect: 'none', color: '#06b6d4' }}>
                                        {exitDay} Date {optSortKey === 'tuesdayDate' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('tuesdayClose')} style={{ cursor: 'pointer', userSelect: 'none', color: '#06b6d4' }}>
                                        {exitDay} Close {optSortKey === 'tuesdayClose' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('pctMoved')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Change % {optSortKey === 'pctMoved' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                    </>
                                  )}

                                  {(optColumnMode === 'all' || optColumnMode === 'strikes') && (
                                    <>
                                      <th onClick={() => handleOptSort('sellPutStrike')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Sell Put {optSortKey === 'sellPutStrike' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('sellCallStrike')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Sell Call {optSortKey === 'sellCallStrike' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('buyPutStrike')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Buy Put {optSortKey === 'buyPutStrike' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('buyCallStrike')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Buy Call {optSortKey === 'buyCallStrike' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                    </>
                                  )}

                                  {/* Adj Status column */}
                                  <th style={{ userSelect: 'none', color: '#f43f5e', borderLeft: '2px solid rgba(244, 63, 94, 0.4)', borderRight: '2px solid rgba(244, 63, 94, 0.4)' }}>
                                    Adj Status
                                  </th>

                                  {(optColumnMode === 'all' || optColumnMode === 'premiums') && (
                                    <>
                                      <th onClick={() => handleOptSort('entryPremium')} style={{ cursor: 'pointer', userSelect: 'none', color: '#818cf8', background: 'rgba(129, 140, 248, 0.1)' }}>
                                        {entryDay} Entry {optSortKey === 'entryPremium' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('premMonOpen')} style={{ cursor: 'pointer', userSelect: 'none', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
                                        {midDay} Open {optSortKey === 'premMonOpen' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('premMonClose')} style={{ cursor: 'pointer', userSelect: 'none', color: '#f97316', background: 'rgba(249, 115, 22, 0.1)' }}>
                                        {midDay} Close {optSortKey === 'premMonClose' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('premTueOpen')} style={{ cursor: 'pointer', userSelect: 'none', color: '#14b8a6', background: 'rgba(20, 184, 166, 0.1)' }}>
                                        {exitDay} Open {optSortKey === 'premTueOpen' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                      <th onClick={() => handleOptSort('exitValue')} style={{ cursor: 'pointer', userSelect: 'none', color: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)' }}>
                                        {exitDay} Close {optSortKey === 'exitValue' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                      </th>
                                    </>
                                  )}

                                  <th onClick={() => handleOptSort('profitPoints')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    Net Profit {optSortKey === 'profitPoints' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                  </th>
                                  <th style={{ userSelect: 'none' }}>
                                    Margin
                                  </th>
                                  <th onClick={() => handleOptSort('roc')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    ROC % {optSortKey === 'roc' ? (optSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedPairs.map((pair, idx) => {
                                  const isActualUp = pair.pctMoved >= 0;
                                  const isRocUp = pair.roc > 0;
                                  const isRocDown = pair.roc < 0;
                                  const isSelected = activePair?.fridayDate === pair.fridayDate;
                                  return (
                                    <tr 
                                      key={idx}
                                      onClick={() => setSelectedOptWeek(pair)}
                                      style={{ 
                                        cursor: 'pointer',
                                        backgroundColor: isSelected ? 'var(--hover-bg-active)' : ''
                                      }}
                                    >
                                      <td style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', textAlign: 'center' }}>{idx + 1}</td>
                                      <td style={{ fontSize: '12px' }}>{pair.fridayDate}</td>

                                      {(optColumnMode === 'all' || optColumnMode === 'spots') && (
                                        <>
                                          <td style={{ fontFamily: 'JetBrains Mono' }}>{formatNumber(pair.fridayClose)}</td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#818cf8' }}>{formatNumber(pair.vixFri, 1)}%</td>
                                          <td style={{ fontSize: '12px', color: '#f97316' }}>{pair.mondayDate || '-'}</td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#f97316' }}>{pair.mondayClose != null ? formatNumber(pair.mondayClose) : '-'}</td>
                                          <td style={{ fontSize: '12px', color: '#06b6d4' }}>{pair.tuesdayDate}</td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#06b6d4' }}>{formatNumber(pair.tuesdayClose)}</td>
                                          <td style={{ color: isActualUp ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>
                                            {isActualUp ? '+' : ''}{pair.pctMoved.toFixed(2)}%
                                          </td>
                                        </>
                                      )}

                                      {(optColumnMode === 'all' || optColumnMode === 'strikes') && (
                                        <>
                                          <td style={{ fontFamily: 'JetBrains Mono' }}>{formatNumber(pair.sellPutStrike, 0)}</td>
                                          <td style={{ fontFamily: 'JetBrains Mono' }}>{formatNumber(pair.sellCallStrike, 0)}</td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: pair.buyPutStrike ? '' : 'var(--text-dim)' }}>
                                            {pair.buyPutStrike ? formatNumber(pair.buyPutStrike, 0) : '-'}
                                          </td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: pair.buyCallStrike ? '' : 'var(--text-dim)' }}>
                                            {pair.buyCallStrike ? formatNumber(pair.buyCallStrike, 0) : '-'}
                                          </td>
                                        </>
                                      )}

                                      {/* Adj Status column */}
                                      <td 
                                        style={{ fontSize: '11px', textAlign: 'center', borderLeft: '2px solid rgba(244, 63, 94, 0.2)', borderRight: '2px solid rgba(244, 63, 94, 0.2)' }}
                                        onClick={(e) => {
                                          if (pair.adjustmentDetails) {
                                            e.stopPropagation();
                                            setOptActiveAdjModal(pair);
                                          }
                                        }}
                                      >
                                        {pair.adjustmentDetails ? (
                                          <span 
                                            title="Click for full adjustment details"
                                            style={{ 
                                              background: pair.adjustmentDetails.type === 'closed' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                              color: pair.adjustmentDetails.type === 'closed' ? '#f87171' : '#fbbf24',
                                              border: `1px solid ${pair.adjustmentDetails.type === 'closed' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                              borderRadius: '4px',
                                              padding: '2px 6px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'inline-block'
                                            }}
                                          >
                                            {pair.adjustmentDetails.type === 'closed' ? 'Closed 🔍' : 'Rolled 🔍'}
                                          </span>
                                        ) : (
                                          <span style={{ color: 'var(--text-dim)' }}>Static</span>
                                        )}
                                      </td>

                                      {(optColumnMode === 'all' || optColumnMode === 'premiums') && (
                                        <>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#818cf8', fontWeight: 600, background: 'rgba(129, 140, 248, 0.05)' }}>
                                            {pair.entryPremium >= 0 ? '+' : ''}{pair.entryPremium.toFixed(2)}
                                          </td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
                                            {pair.premMonOpen?.net != null ? `${pair.premMonOpen.net >= 0 ? '+' : ''}${pair.premMonOpen.net.toFixed(2)}` : '-'}
                                          </td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#f97316', background: 'rgba(249, 115, 22, 0.05)' }}>
                                            {pair.premMonClose?.net != null ? `${pair.premMonClose.net >= 0 ? '+' : ''}${pair.premMonClose.net.toFixed(2)}` : '-'}
                                          </td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#14b8a6', background: 'rgba(20, 184, 166, 0.05)' }}>
                                            {pair.premTueOpen?.net != null ? `${pair.premTueOpen.net >= 0 ? '+' : ''}${pair.premTueOpen.net.toFixed(2)}` : '-'}
                                          </td>
                                          <td style={{ fontFamily: 'JetBrains Mono', color: '#06b6d4', fontWeight: 600, background: 'rgba(6, 182, 212, 0.05)' }}>
                                            {pair.exitValue >= 0 ? '+' : ''}{pair.exitValue.toFixed(2)}
                                          </td>
                                        </>
                                      )}

                                      <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                                        {pair.profitPoints >= 0 ? '+' : ''}{pair.profitPoints.toFixed(2)}
                                      </td>
                                      <td style={{ fontFamily: 'JetBrains Mono' }}>
                                        ₹{pair.margin.toLocaleString('en-IN')}
                                      </td>
                                      <td style={{ 
                                        fontWeight: '700', 
                                        color: isRocUp ? 'var(--color-up)' : isRocDown ? 'var(--color-down)' : 'var(--text-muted)',
                                        fontFamily: 'JetBrains Mono' 
                                      }}>
                                        {isRocUp ? '+' : ''}{pair.roc.toFixed(2)}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ display: 'flex', padding: '40px', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="spinner"></div>
                    <p style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>Running Black-Scholes valuations...</p>
                  </div>
                )}
              </div>
            )}
           {optActiveAdjModal && (
             <div style={{
               position: 'fixed',
               top: 0, left: 0, right: 0, bottom: 0,
               background: 'rgba(0,0,0,0.75)',
               backdropFilter: 'blur(8px)',
               zIndex: 9999,
               display: 'flex',
               justifyContent: 'center',
               alignItems: 'center',
               padding: '20px'
             }} onClick={() => setOptActiveAdjModal(null)}>
               <div style={{
                 background: 'var(--tooltip-bg)',
                 border: '1px solid var(--border-color)',
                 borderRadius: '12px',
                 width: '100%',
                 maxWidth: '520px',
                 padding: '24px',
                 boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                 display: 'flex',
                 flexDirection: 'column',
                 gap: '16px',
                 color: 'var(--text-main)'
               }} onClick={(e) => e.stopPropagation()}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                   <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     🛡️ Hedging Transaction Ledger
                   </h3>
                   <button 
                     onClick={() => setOptActiveAdjModal(null)}
                     style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '18px', padding: 0 }}
                   >
                     ×
                   </button>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', lineHeight: '1.5' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--panel-bg-subtle)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                     <div>
                       <span style={{ color: 'var(--text-muted)' }}>Date:</span> <strong style={{ color: 'var(--text-main)' }}>{optActiveAdjModal.fridayDate}</strong>
                     </div>
                     <div>
                       <span style={{ color: 'var(--text-muted)' }}>Friday Close:</span> <strong style={{ color: 'var(--text-main)' }}>{optActiveAdjModal.fridayClose.toFixed(1)}</strong>
                     </div>
                     <div>
                       <span style={{ color: 'var(--text-muted)' }}>Hedge Action:</span> <strong style={{ color: optActiveAdjModal.adjustmentDetails.type === 'closed' ? '#f87171' : '#fbbf24' }}>{optActiveAdjModal.adjustmentDetails.type.toUpperCase()}</strong>
                     </div>
                     <div>
                       <span style={{ color: 'var(--text-muted)' }}>Milestone:</span> <strong style={{ color: 'var(--text-main)' }}>{optActiveAdjModal.adjustmentDetails.milestone}</strong>
                     </div>
                   </div>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                     <span style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Adjustment Ledger:</span>
                     
                     <div style={{ background: 'var(--panel-bg-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed var(--border-subtle)', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                         <span>Transaction / Leg Action</span>
                         <span>Points Value</span>
                       </div>
                       
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                         <span>{optActiveAdjModal.entryPremium >= 0 ? 'Friday Open Position (Received Credit)' : 'Friday Open Position (Paid Debit)'}</span>
                         <span style={{ color: optActiveAdjModal.entryPremium >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>
                           {optActiveAdjModal.entryPremium >= 0 ? '+' : ''}{optActiveAdjModal.entryPremium.toFixed(2)} pts
                         </span>
                       </div>

                       <div style={{ color: '#fbbf24', fontSize: '11px', margin: '8px 0', background: 'rgba(245,158,11,0.05)', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid #fbbf24' }}>
                         <strong>Trigger:</strong> {optActiveAdjModal.adjustmentDetails.detail}
                       </div>

                       {optActiveAdjModal.adjustmentDetails.type === 'closed' ? (
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#f87171' }}>
                           <span>Close Position Debit (Paid back)</span>
                           <span style={{ fontFamily: 'JetBrains Mono' }}>{optActiveAdjModal.adjCredit.toFixed(2)} pts</span>
                         </div>
                       ) : (
                         <>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                             <span>{optActiveAdjModal.adjustmentDetails.detail.includes('Converted') ? 'Opposite Spread Credit Collected' : 'Untested Leg Rolled (Adjustment Cash)'}</span>
                             <span style={{ color: optActiveAdjModal.adjCredit >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>
                               {optActiveAdjModal.adjCredit >= 0 ? '+' : ''}{optActiveAdjModal.adjCredit.toFixed(2)} pts
                             </span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                             <span>Tuesday Final Position Value (Paid back)</span>
                             <span style={{ color: 'var(--color-down)', fontFamily: 'JetBrains Mono' }}>
                               -{optActiveAdjModal.exitValue.toFixed(2)} pts
                             </span>
                           </div>
                         </>
                       )}

                       <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px', fontWeight: 'bold' }}>
                         <span>Net Profit / Loss Points</span>
                         <span style={{ color: optActiveAdjModal.profitPoints >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontFamily: 'JetBrains Mono', fontSize: '13px' }}>
                           {optActiveAdjModal.profitPoints >= 0 ? '+' : ''}{optActiveAdjModal.profitPoints.toFixed(2)} pts
                         </span>
                       </div>
                     </div>
                   </div>

                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', background: 'var(--hover-bg)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                     <span>Qty: <strong>{optActiveAdjModal.lotSize}</strong> (Lot)</span>
                     <span>Margin: <strong>₹{optActiveAdjModal.margin.toLocaleString('en-IN')}</strong></span>
                     <span style={{ color: optActiveAdjModal.profitPoints >= 0 ? 'var(--color-up)' : 'var(--color-down)', fontWeight: 'bold' }}>
                       Outcome: ₹{(optActiveAdjModal.profitPoints * optActiveAdjModal.lotSize).toFixed(0)}
                     </span>
                   </div>
                 </div>

                 <button
                   onClick={() => setOptActiveAdjModal(null)}
                   className="timeframe-btn active"
                   style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '600', marginTop: '8px' }}
                 >
                   Dismiss Ledger
                 </button>
               </div>
             </div>
           )}

        {activeTab === 'liveOptionSignals' && (
          <LiveOptionSignalsModule
            indexData={indexData}
            liveTicks={liveTicks}
            historicalOI={historicalOI}
            onRefresh={handleRefresh}
            formatNumber={formatNumber}
            themeColor={activeThemeColor}
          />
        )}

        {activeTab === 'liveChart' && (
          <LiveChartModule
            indexData={indexData}
            activeIndex={activeIndex}
            timeframe={timeframe}
            liveTicks={liveTicks}
            historicalOI={historicalOI}
            onRefresh={handleRefresh}
            formatNumber={formatNumber}
            themeColor={activeThemeColor}
          />
        )}

       {activeTab === 'backtester' && (
         <BacktesterModule
           indexData={indexData}
           activeIndex={activeIndex}
           timeframe={timeframe}
           formatNumber={formatNumber}
           themeColor={activeThemeColor}
         />
       )}
           </>
         )
       )}

       {/* Portals into Picture-in-Picture Window & Standalone Pop-Out Window */}
       {pipWindow && createPortal(
         <OutOfBrowserWidget
           data={indexData}
           activeIndex={activeIndex}
           setActiveIndex={setActiveIndex}
           onRefresh={handleRefresh}
           theme={theme}
           toggleTheme={toggleTheme}
           isPiP={true}
           onDock={() => {
             pipWindow.close();
             setPipWindow(null);
           }}
         />,
         pipWindow.document.body
       )}

       {popoutWin && !popoutWin.closed && createPortal(
         <OutOfBrowserWidget
           data={indexData}
           activeIndex={activeIndex}
           setActiveIndex={setActiveIndex}
           onRefresh={handleRefresh}
           theme={theme}
           toggleTheme={toggleTheme}
           isPiP={false}
           onDock={() => {
             popoutWin.close();
             setPopoutWin(null);
           }}
         />,
         popoutWin.document.body
       )}
     </div>
   );
 }

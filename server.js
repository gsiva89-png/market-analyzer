import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import yahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculatePivotPoints,
  calculateCorrelation,
  calculateDrawdown,
  detectCandlestickPatterns,
  calculateFridayTuesdayAnalysis,
  calculateTuesdayThursdayAnalysis,
  calculateTuesdayThursdayOptionsAnalysis,
  runBacktest
} from './analysis.js';
import { saveLocalData, loadLocalData } from './localStore.js';
import { generateLiveOptionRecommendation } from './src/utils/liveOptionEngine.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory cache for API requests (caches data for 5 minutes)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in ms

const getCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

const setCache = (key, data) => {
  cache.set(key, {
    timestamp: Date.now(),
    data
  });
};

// Map URL index strings to Yahoo Finance Symbols
const INDEX_SYMBOLS = {
  nifty50: '^NSEI',
  banknifty: '^NSEBANK',
  sensex: '^BSESN'
};

const INDEX_NAMES = {
  nifty50: 'Nifty 50',
  banknifty: 'Bank Nifty',
  sensex: 'Sensex'
};

// Timeframe parser helper
const getTimeframeDates = (timeframe) => {
  const end = new Date();
  const start = new Date();
  switch (timeframe?.toUpperCase()) {
    case '1M': start.setMonth(start.getMonth() - 1); break;
    case '3M': start.setMonth(start.getMonth() - 3); break;
    case '6M': start.setMonth(start.getMonth() - 6); break;
    case '1Y': start.setFullYear(start.getFullYear() - 1); break;
    case '3Y': start.setFullYear(start.getFullYear() - 3); break;
    case '5Y': start.setFullYear(start.getFullYear() - 5); break;
    case 'MAX': start.setFullYear(start.getFullYear() - 12); break; // 12 years of history
    default: start.setFullYear(start.getFullYear() - 1); // default 1Y
  }
  return { start, end };
};

// Endpoint 1: Fetch details, candles, and metrics for a specific index
app.get('/api/index-data/:index', async (req, res) => {
  const { index } = req.params;
  const timeframe = req.query.timeframe || '1Y';
  const symbol = INDEX_SYMBOLS[index.toLowerCase()];

  if (!symbol) {
    return res.status(400).json({ error: `Invalid index. Choose from: ${Object.keys(INDEX_SYMBOLS).join(', ')}` });
  }

  const forceSync = req.query.force === 'true';
  const cacheKey = `data-${index}-${timeframe}`;
  const cachedData = getCache(cacheKey);
  if (cachedData && !forceSync) {
    return res.json(cachedData);
  }

  try {
    const { start, end } = getTimeframeDates(timeframe);
    
    // For calculating indicators (like 200 SMA), we need extra lookback data. 
    // We add 300 days of buffer before the requested start date.
    const bufferedStart = new Date(start);
    bufferedStart.setDate(bufferedStart.getDate() - 300);

    // 1. Fetch historical pricing
    const chartResult = await yahooFinance.chart(symbol, {
      period1: bufferedStart,
      period2: end,
      interval: '1d'
    }, {
      fetchOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }
    });

    const historicalData = chartResult.quotes || [];

    if (!historicalData || historicalData.length === 0) {
      throw new Error(`No historical data found for symbol ${symbol}`);
    }

    // Clean data (ensure no null closes)
    const cleanHistory = historicalData
      .filter(d => d.close && d.high && d.low && d.open)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Get arrays of close, high, low, open prices for indicators
    const closes = cleanHistory.map(d => d.close);
    const highs = cleanHistory.map(d => d.high);
    const lows = cleanHistory.map(d => d.low);
    const opens = cleanHistory.map(d => d.open);

    // Calculate indicators on the complete buffered series
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const rsi14 = calculateRSI(closes, 14);
    const macdResult = calculateMACD(closes);
    const bb = calculateBollingerBands(closes, 20, 2);

    // Combine back into rich candles
    const enrichedHistory = cleanHistory.map((candle, idx) => ({
      date: candle.date.toISOString().split('T')[0],
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      sma20: sma20[idx],
      sma50: sma50[idx],
      sma200: sma200[idx],
      ema20: ema20[idx],
      ema50: ema50[idx],
      rsi: rsi14[idx],
      macd: macdResult.macdLine[idx],
      macdSignal: macdResult.signalLine[idx],
      macdHist: macdResult.histogram[idx],
      bbUpper: bb.upperBand[idx],
      bbMiddle: bb.middleBand[idx],
      bbLower: bb.lowerBand[idx]
    }));

    // Slice history to only return starting from the requested (unbuffered) date
    const startIso = start.toISOString().split('T')[0];
    const finalHistory = enrichedHistory.filter(candle => candle.date >= startIso);

    let currentQuote = {};
    try {
      currentQuote = await yahooFinance.quote(symbol, {}, {
        fetchOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        }
      });
    } catch (e) {
      console.warn(`Quote fetch failed for ${symbol}, falling back to last history candle.`);
      const lastCandle = cleanHistory[cleanHistory.length - 1];
      const prevCandle = cleanHistory[cleanHistory.length - 2];
      const change = lastCandle.close - prevCandle.close;
      currentQuote = {
        regularMarketPrice: lastCandle.close,
        regularMarketChange: change,
        regularMarketChangePercent: (change / prevCandle.close) * 100,
        regularMarketPreviousClose: prevCandle.close,
        regularMarketOpen: lastCandle.open,
        regularMarketDayHigh: lastCandle.high,
        regularMarketDayLow: lastCandle.low,
        regularMarketVolume: lastCandle.volume,
        fiftyTwoWeekHigh: Math.max(...closes.slice(-252)),
        fiftyTwoWeekLow: Math.min(...closes.slice(-252))
      };
    }

    // 3. Statistical Calculations for final history range
    const periodCloses = finalHistory.map(d => d.close);
    const startPrice = periodCloses[0];
    const endPrice = periodCloses[periodCloses.length - 1];
    const totalReturn = ((endPrice - startPrice) / startPrice) * 100;

    // Daily Returns & Volatility
    const dailyReturns = [];
    for (let i = 1; i < periodCloses.length; i++) {
      dailyReturns.push((periodCloses[i] - periodCloses[i - 1]) / periodCloses[i - 1]);
    }
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const returnVariance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1);
    const dailyVol = Math.sqrt(returnVariance);
    const annualizedVol = dailyVol * Math.sqrt(252) * 100; // in percentage

    // Drawdowns
    const { drawdowns, maxDrawdown, currentDrawdown } = calculateDrawdown(periodCloses);

    // Merge drawdown back into the final history for plotting
    const chartedHistory = finalHistory.map((candle, idx) => ({
      ...candle,
      drawdown: drawdowns[idx]
    }));

    // Pivot Points (based on the last completed day)
    const lastDay = cleanHistory[cleanHistory.length - 1];
    const pivots = calculatePivotPoints(lastDay.high, lastDay.low, lastDay.close);

    // Candlestick Pattern Alerts (last 10 candles)
    const patternAlerts = detectCandlestickPatterns(cleanHistory, 10);

    const responsePayload = {
      indexName: INDEX_NAMES[index.toLowerCase()],
      symbol,
      quote: {
        price: currentQuote.regularMarketPrice,
        change: currentQuote.regularMarketChange,
        changePercent: currentQuote.regularMarketChangePercent,
        open: currentQuote.regularMarketOpen,
        dayHigh: currentQuote.regularMarketDayHigh,
        dayLow: currentQuote.regularMarketDayLow,
        prevClose: currentQuote.regularMarketPreviousClose,
        volume: currentQuote.regularMarketVolume,
        fiftyTwoWeekHigh: currentQuote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: currentQuote.fiftyTwoWeekLow,
      },
      stats: {
        periodReturn: totalReturn,
        annualizedVolatility: annualizedVol,
        maxDrawdown,
        currentDrawdown,
        pivots,
        patterns: patternAlerts
      },
      history: chartedHistory
    };

    // ── Friday → Tuesday weekend analysis (use full buffered history for max pairs) ──
    responsePayload.weekendAnalysis = calculateFridayTuesdayAnalysis(cleanHistory);

    // ── Tuesday → Thursday midweek analysis (use full buffered history for max pairs) ──
    responsePayload.tuesdayThursdayAnalysis = calculateTuesdayThursdayAnalysis(cleanHistory);

    saveLocalData(`index-data-${index}-${timeframe}`, responsePayload);
    setCache(cacheKey, responsePayload);
    res.json(responsePayload);

  } catch (error) {
    console.error(`Error in /api/index-data/${index}:`, error);
    const fallback = loadLocalData(`index-data-${index}-${timeframe}`);
    if (fallback) {
      console.log(`[OFFLINE MODE] Serving cached index-data for ${index}-${timeframe} from local database.`);
      setCache(cacheKey, fallback);
      return res.json(fallback);
    }
    res.status(500).json({ error: error.message || 'Failed to fetch index data' });
  }
});

// Endpoint 2: Fetch Pearson correlation coefficients between the indices
app.get('/api/correlation', async (req, res) => {
  const timeframe = req.query.timeframe || '1Y';
  
  const cacheKey = `correlation-${timeframe}`;
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const { start, end } = getTimeframeDates(timeframe);
    
    // Fetch data for all three
    const fetchIndexHistory = async (symbol) => {
      const result = await yahooFinance.chart(symbol, { period1: start, period2: end, interval: '1d' }, {
        fetchOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        }
      });
      const hist = result.quotes || [];
      return hist
        .filter(d => d.close)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    const [niftyData, bankNiftyData, sensexData] = await Promise.all([
      fetchIndexHistory(INDEX_SYMBOLS.nifty50),
      fetchIndexHistory(INDEX_SYMBOLS.banknifty),
      fetchIndexHistory(INDEX_SYMBOLS.sensex)
    ]);

    // Align by date
    // Create a map by date string
    const mapByDate = (history) => {
      const map = new Map();
      history.forEach(d => {
        const dateStr = d.date.toISOString().split('T')[0];
        map.set(dateStr, d.close);
      });
      return map;
    };

    const niftyMap = mapByDate(niftyData);
    const bankNiftyMap = mapByDate(bankNiftyData);
    const sensexMap = mapByDate(sensexData);

    // Find intersection of all dates
    const commonDates = Array.from(niftyMap.keys())
      .filter(date => bankNiftyMap.has(date) && sensexMap.has(date))
      .sort((a, b) => new Date(a) - new Date(b));

    if (commonDates.length < 5) {
      throw new Error("Insufficient overlapping historical trading dates found.");
    }

    // Calculate daily returns for aligned dates
    const niftyReturns = [];
    const bankNiftyReturns = [];
    const sensexReturns = [];

    for (let i = 1; i < commonDates.length; i++) {
      const prevDate = commonDates[i - 1];
      const currDate = commonDates[i];

      niftyReturns.push((niftyMap.get(currDate) - niftyMap.get(prevDate)) / niftyMap.get(prevDate));
      bankNiftyReturns.push((bankNiftyMap.get(currDate) - bankNiftyMap.get(prevDate)) / bankNiftyMap.get(prevDate));
      sensexReturns.push((sensexMap.get(currDate) - sensexMap.get(prevDate)) / sensexMap.get(prevDate));
    }

    // Calculate correlation matrix coefficients
    const nifty_bank = calculateCorrelation(niftyReturns, bankNiftyReturns);
    const nifty_sensex = calculateCorrelation(niftyReturns, sensexReturns);
    const bank_sensex = calculateCorrelation(bankNiftyReturns, sensexReturns);

    const correlationMatrix = {
      labels: ['Nifty 50', 'Bank Nifty', 'Sensex'],
      matrix: [
        [1, nifty_bank, nifty_sensex],
        [nifty_bank, 1, bank_sensex],
        [nifty_sensex, bank_sensex, 1]
      ],
      sampleSize: commonDates.length
    };

    saveLocalData(`correlation-${timeframe}`, correlationMatrix);
    setCache(cacheKey, correlationMatrix);
    res.json(correlationMatrix);

  } catch (error) {
    console.error('Error in /api/correlation:', error);
    const fallback = loadLocalData(`correlation-${timeframe}`);
    if (fallback) {
      console.log(`[OFFLINE MODE] Serving cached correlation data for ${timeframe} from local database.`);
      setCache(cacheKey, fallback);
      return res.json(fallback);
    }
    res.status(500).json({ error: error.message || 'Failed to calculate index correlation' });
  }
});

// Endpoint 3: Calculate monthly returns heatmap grid for the past 10 years
app.get('/api/monthly-returns/:index', async (req, res) => {
  const { index } = req.params;
  const symbol = INDEX_SYMBOLS[index.toLowerCase()];

  if (!symbol) {
    return res.status(400).json({ error: 'Invalid index.' });
  }

  const cacheKey = `monthly-returns-${index}`;
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 10); // Fetch last 10 years for heatmap

    const result = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: '1d'
    }, {
      fetchOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }
    });

    const history = result.quotes || [];

    const cleanHistory = history
      .filter(d => d.close)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group candles by year and month
    const grouped = {};
    cleanHistory.forEach(candle => {
      const d = new Date(candle.date);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0 - 11

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(candle);
    });

    const monthlyReturns = [];
    const currentYear = new Date().getFullYear();

    // Iterate years in descending order
    for (let year = currentYear; year >= currentYear - 9; year--) {
      if (!grouped[year]) continue;

      const yearRow = { year };
      let yearlyReturnSum = 0;
      let monthCount = 0;

      for (let month = 0; month < 12; month++) {
        const monthCandles = grouped[year][month];
        if (monthCandles && monthCandles.length > 0) {
          // Monthly return is (Close of last day - Close of day before first day/open of first day)
          // To make it simple and clean, we take Close of last candle - Open of first candle
          const firstCandle = monthCandles[0];
          const lastCandle = monthCandles[monthCandles.length - 1];
          const mReturn = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
          
          yearRow[month] = Number(mReturn.toFixed(2));
          yearlyReturnSum += mReturn;
          monthCount++;
        } else {
          yearRow[month] = null; // No data (e.g. future months in current year)
        }
      }

      // Calculate total year return (using last day of year vs first day of year open)
      const yearCandles = Object.values(grouped[year]).flat().sort((a, b) => new Date(a.date) - new Date(b.date));
      if (yearCandles.length > 0) {
        const first = yearCandles[0];
        const last = yearCandles[yearCandles.length - 1];
        yearRow.yearlyTotal = Number((((last.close - first.open) / first.open) * 100).toFixed(2));
      } else {
        yearRow.yearlyTotal = 0;
      }

      monthlyReturns.push(yearRow);
    }

    saveLocalData(`monthly-returns-${index}`, monthlyReturns);
    setCache(cacheKey, monthlyReturns);
    res.json(monthlyReturns);

  } catch (error) {
    console.error(`Error in /api/monthly-returns/${index}:`, error);
    const fallback = loadLocalData(`monthly-returns-${index}`);
    if (fallback) {
      console.log(`[OFFLINE MODE] Serving cached monthly-returns for ${index} from local database.`);
      setCache(cacheKey, fallback);
      return res.json(fallback);
    }
    res.status(500).json({ error: error.message || 'Failed to calculate monthly returns' });
  }
});

// Endpoint 4: Aggregate instant market overview scans and technical ratings
app.get('/api/insights', async (req, res) => {
  const cacheKey = 'insights';
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const indices = ['nifty50', 'banknifty', 'sensex'];
    const results = await Promise.all(indices.map(async (idx) => {
      const symbol = INDEX_SYMBOLS[idx];
      
      // Fetch 1 year of history
      const { start, end } = getTimeframeDates('1Y');
      const bufferedStart = new Date(start);
      bufferedStart.setDate(bufferedStart.getDate() - 300);

      const result = await yahooFinance.chart(symbol, {
        period1: bufferedStart,
        period2: end,
        interval: '1d'
      }, {
        fetchOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        }
      });

      const history = result.quotes || [];

      const cleanHistory = history
        .filter(d => d.close && d.high && d.low && d.open)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const closes = cleanHistory.map(c => c.close);
      const sma50 = calculateSMA(closes, 50);
      const sma200 = calculateSMA(closes, 200);
      const rsi14 = calculateRSI(closes, 14);

      const lastIdx = cleanHistory.length - 1;
      const currentPrice = closes[lastIdx];
      const p50 = sma50[lastIdx];
      const p200 = sma200[lastIdx];
      const rsi = rsi14[lastIdx];

      // Quote for current metrics
      let quote = {};
      try {
        quote = await yahooFinance.quote(symbol, {}, {
          fetchOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
          }
        });
      } catch (e) {
        const prevClose = closes[lastIdx - 1];
        quote = {
          regularMarketPrice: currentPrice,
          regularMarketChangePercent: ((currentPrice - prevClose) / prevClose) * 100
        };
      }

      // Trend rating
      let trend = 'Neutral';
      if (currentPrice > p50 && p50 > p200) trend = 'Strong Bullish';
      else if (currentPrice > p200 && currentPrice < p50) trend = 'Mild Bullish / Consolidation';
      else if (currentPrice < p50 && p50 < p200) trend = 'Strong Bearish';
      else if (currentPrice < p200 && currentPrice > p50) trend = 'Mild Bearish / Reversal';

      // Momentum rating
      let momentum = 'Normal';
      if (rsi > 70) momentum = 'Overbought (Extended)';
      else if (rsi < 30) momentum = 'Oversold (Value)';
      else if (rsi > 55) momentum = 'Bullish Momentum';
      else if (rsi < 45) momentum = 'Bearish Momentum';

      // Latest patterns
      const patterns = detectCandlestickPatterns(cleanHistory, 5);

      return {
        index: idx,
        name: INDEX_NAMES[idx],
        price: quote.regularMarketPrice || currentPrice,
        changePercent: quote.regularMarketChangePercent || 0,
        rsi: Number(rsi.toFixed(2)),
        trend,
        momentum,
        patterns: patterns.slice(-2) // Last 2 patterns
      };
    }));

    const globalInsights = {
      indices: results,
      timestamp: new Date().toISOString(),
      commentary: compileGlobalCommentary(results)
    };

    saveLocalData('insights', globalInsights);
    setCache(cacheKey, globalInsights);
    res.json(globalInsights);

  } catch (error) {
    console.error('Error in /api/insights:', error);
    const fallback = loadLocalData('insights');
    if (fallback) {
      console.log(`[OFFLINE MODE] Serving cached insights from local database.`);
      setCache(cacheKey, fallback);
      return res.json(fallback);
    }
    res.status(500).json({ error: error.message || 'Failed to fetch global insights' });
  }
});

// Endpoint 5: Dedicated Friday-Evening → Tuesday-Close Analysis
// Uses MAX historical data (~5 years) for robust statistical sampling.
app.get('/api/friday-tuesday/:index', async (req, res) => {
  const { index } = req.params;
  const symbol = INDEX_SYMBOLS[index.toLowerCase()];

  if (!symbol) {
    return res.status(400).json({ error: 'Invalid index.' });
  }

  const cacheKey = `friday-tuesday-${index}`;
  const forceRefresh = req.query.refresh === '1';
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    // Validate cache has VIX history fields before serving it
    if (cached && cached.pairs && cached.pairs.length > 0 && cached.pairs[0].fridayVIX !== undefined) {
      return res.json(cached);
    }
  }

  try {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 5); // 5 years of data for robust sample

    const fetchOptions = {
      fetchOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }
    };

    // Fetch Nifty + India VIX in parallel
    const [chartResult, vixResult] = await Promise.allSettled([
      yahooFinance.chart(symbol, { period1: start, period2: end, interval: '1d' }, fetchOptions),
      yahooFinance.chart('^INDIAVIX', { period1: start, period2: end, interval: '1d' }, fetchOptions)
    ]);

    const rawQuotes = (chartResult.status === 'fulfilled' ? chartResult.value?.quotes : null) || [];
    const candles = rawQuotes
      .filter(d => d.close && d.open && d.high && d.low)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Build a date → VIX close map  (YYYY-MM-DD → number)
    const vixByDate = new Map();
    if (vixResult.status === 'fulfilled' && vixResult.value?.quotes) {
      for (const q of vixResult.value.quotes) {
        if (q.close && q.date) {
          const d = new Date(q.date);
          d.setHours(0, 0, 0, 0);
          vixByDate.set(d.toISOString().slice(0, 10), q.close);
        }
      }
      console.log(`[VIX] Loaded ${vixByDate.size} India VIX data points for ${index}`);
    } else {
      console.warn(`[VIX] Could not fetch India VIX data: ${vixResult.reason?.message || 'unknown error'}. Premiums will use slider VIX.`);
    }

    const analysis = calculateFridayTuesdayAnalysis(candles, vixByDate.size > 0 ? vixByDate : null);

    const payload = {
      indexName: INDEX_NAMES[index.toLowerCase()],
      symbol,
      hasVIXHistory: vixByDate.size > 0,
      ...analysis
    };

    saveLocalData(`friday-tuesday-${index}`, payload);
    setCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error(`Error in /api/friday-tuesday/${index}:`, error);
    const fallback = loadLocalData(`friday-tuesday-${index}`);
    if (fallback) {
      console.log(`[OFFLINE MODE] Serving cached friday-tuesday data for ${index} from local database.`);
      setCache(cacheKey, fallback);
      return res.json(fallback);
    }
    res.status(500).json({ error: error.message || 'Failed to run Friday-Tuesday analysis' });
  }
});

// Endpoint 6: Dedicated Tuesday-Close → Thursday-Close Analysis
// Uses MAX historical data (~5 years) for robust statistical sampling.
app.get('/api/tuesday-thursday/:index', async (req, res) => {
  const { index } = req.params;
  const symbol = INDEX_SYMBOLS[index.toLowerCase()];

  if (!symbol) {
    return res.status(400).json({ error: 'Invalid index.' });
  }

  const cacheKey = `tuesday-thursday-${index}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 5); // 5 years of data for robust sample

    const chartResult = await yahooFinance.chart(symbol, {
      period1: start,
      period2: end,
      interval: '1d'
    }, {
      fetchOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }
    });

    const rawQuotes = chartResult.quotes || [];
    const candles = rawQuotes
      .filter(d => d.close && d.open && d.high && d.low)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const analysis = calculateTuesdayThursdayAnalysis(candles);

    const payload = {
      indexName: INDEX_NAMES[index.toLowerCase()],
      symbol,
      ...analysis
    };

    saveLocalData(`tuesday-thursday-${index}`, payload);
    setCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error(`Error in /api/tuesday-thursday/${index}:`, error);
    const fallback = loadLocalData(`tuesday-thursday-${index}`);
    if (fallback) {
      console.log(`[OFFLINE MODE] Serving cached tuesday-thursday data for ${index} from local database.`);
      setCache(cacheKey, fallback);
      return res.json(fallback);
    }
    res.status(500).json({ error: error.message || 'Failed to run Tuesday-Thursday analysis' });
  }
});

// Endpoint 6B: Dedicated Tuesday-Close → Thursday-Close Options Simulator Data
app.get('/api/options/tuesday-thursday/:index', async (req, res) => {
  const { index } = req.params;
  const symbol = INDEX_SYMBOLS[index.toLowerCase()];

  if (!symbol) {
    return res.status(400).json({ error: 'Invalid index.' });
  }

  const cacheKey = `options-tuesday-thursday-${index}`;
  const forceRefresh = req.query.refresh === '1';
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached && cached.pairs && cached.pairs.length > 0 && cached.pairs[0].tuesdayVIX !== undefined) {
      return res.json(cached);
    }
  }

  try {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 5); // 5 years of data for robust sample

    const fetchOptions = {
      fetchOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }
    };

    const [chartResult, vixResult] = await Promise.allSettled([
      yahooFinance.chart(symbol, { period1: start, period2: end, interval: '1d' }, fetchOptions),
      yahooFinance.chart('^INDIAVIX', { period1: start, period2: end, interval: '1d' }, fetchOptions)
    ]);

    const rawQuotes = (chartResult.status === 'fulfilled' ? chartResult.value?.quotes : null) || [];
    const candles = rawQuotes
      .filter(d => d.close && d.open && d.high && d.low)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const vixByDate = new Map();
    if (vixResult.status === 'fulfilled' && vixResult.value?.quotes) {
      for (const q of vixResult.value.quotes) {
        if (q.close && q.date) {
          const d = new Date(q.date);
          d.setHours(0, 0, 0, 0);
          vixByDate.set(d.toISOString().slice(0, 10), q.close);
        }
      }
      console.log(`[VIX] Loaded ${vixByDate.size} India VIX points for Options Tuesday-Thursday`);
    }

    const analysis = calculateTuesdayThursdayOptionsAnalysis(candles, vixByDate.size > 0 ? vixByDate : null);

    const payload = {
      indexName: INDEX_NAMES[index.toLowerCase()],
      symbol,
      hasVIXHistory: vixByDate.size > 0,
      ...analysis
    };

    saveLocalData(`options-tuesday-thursday-${index}`, payload);
    setCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error(`Error in /api/options/tuesday-thursday/${index}:`, error);
    const fallback = loadLocalData(`options-tuesday-thursday-${index}`);
    if (fallback) {
      console.log(`[OFFLINE MODE] Serving cached options-tuesday-thursday data for ${index} from local database.`);
      setCache(cacheKey, fallback);
      return res.json(fallback);
    }
    res.status(500).json({ error: error.message || 'Failed to run Tuesday-Thursday options analysis' });
  }
});

function compileGlobalCommentary(indices) {
  const bullishCount = indices.filter(i => i.trend.includes('Bullish')).length;
  const overboughtIndices = indices.filter(i => i.rsi > 70).map(i => i.name);
  const oversoldIndices = indices.filter(i => i.rsi < 30).map(i => i.name);

  let trendSum = '';
  if (bullishCount === 3) {
    trendSum = 'All major stock indices are currently showing bullish configurations, aligned above their key 50 and 200 daily moving averages.';
  } else if (bullishCount === 0) {
    trendSum = 'Bearish momentum dominates the landscape, with indices trading below major moving average support clusters. Caution is advised.';
  } else {
    trendSum = 'Mixed trend directions point to market divergence, with select pockets of strength (typically Nifty 50 relative to Bank Nifty).';
  }

  let warning = '';
  if (overboughtIndices.length > 0) {
    warning += ` Momentum indicators suggest short-term exhaustion with ${overboughtIndices.join(', ')} entering Overbought regions (>70 RSI), which historically precedes profit-taking pullbacks.`;
  }
  if (oversoldIndices.length > 0) {
    warning += ` Mean reversion candidates appear in ${oversoldIndices.join(', ')}, currently in Oversold territory (<30 RSI), signaling potential relief rallies.`;
  }

  return `${trendSum}${warning} Volatility profiles are typical for current segments. Monitor pivot resistances for breakouts.`;
}

// ==========================================
// Nifty Futures OI Change Simulator Engine
// ==========================================

let liveOITicks = [];
let currentNiftySpotPrice = 24334.30;
let lastPrice = currentNiftySpotPrice + 15;
let baseOI = 12500000;
let dailyOIChange = 150000;
let dailyVolume = 3500000;

// Timezone-safe India Standard Time (IST) market hours checker
function isIndianMarketOpen() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5)); // UTC+5:30
  
  const day = ist.getDay(); // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) return false;
  
  const hr = ist.getHours();
  const min = ist.getMinutes();
  const timeVal = hr * 100 + min; // 09:15 -> 915, 15:30 -> 1530
  
  return timeVal >= 915 && timeVal <= 1530;
}

// Sync All Index Spot Prices from Yahoo Finance every 5s
const liveSpotPrices = {
  nifty50:    { price: 24334.30, change: 0, changePercent: 0, dayHigh: 0, dayLow: 0 },
  banknifty:  { price: 52000.00, change: 0, changePercent: 0, dayHigh: 0, dayLow: 0 },
  sensex:     { price: 80000.00, change: 0, changePercent: 0, dayHigh: 0, dayLow: 0 },
};
const SPOT_SYNC_SYMBOLS = { nifty50: '^NSEI', banknifty: '^NSEBANK', sensex: '^BSESN' };

async function syncAllSpotPrices() {
  await Promise.allSettled(
    Object.entries(SPOT_SYNC_SYMBOLS).map(async ([key, sym]) => {
      try {
        const q = await yahooFinance.quote(sym, {}, {
          fetchOptions: {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
          }
        });
        if (q && q.regularMarketPrice) {
          const realPrice = q.regularMarketPrice;
          const prevClose = q.regularMarketPreviousClose || realPrice;
          const change = q.regularMarketChange !== undefined ? q.regularMarketChange : Number((realPrice - prevClose).toFixed(2));
          const changePercent = q.regularMarketChangePercent !== undefined ? q.regularMarketChangePercent : (prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0);

          liveSpotPrices[key] = {
            price:         realPrice,
            change:        change,
            changePercent: changePercent,
            dayHigh:       q.regularMarketDayHigh       || realPrice,
            dayLow:        q.regularMarketDayLow        || realPrice,
            volume:        q.regularMarketVolume        || 0,
            prevClose:     prevClose,
            lastSync:      new Date().toISOString(),
          };
          if (key === 'nifty50') {
            currentNiftySpotPrice = realPrice;
          }
        }
      } catch (e) {
        // Silent fallback — keep last valid price
      }
    })
  );
}
syncAllSpotPrices();
setInterval(syncAllSpotPrices, 5000); // Sync with Yahoo Finance every 5 seconds

// Intensity-based Derivatives Buildup Classifier
function classifyBuildup(priceChange, price, oiChangeDelta, isLive = false) {
  const prevPrice = price - priceChange;
  const pricePct = prevPrice > 0 ? Math.abs(priceChange / prevPrice) * 100 : 0;
  const absPrice = Math.abs(priceChange);
  const absOIDelta = Math.abs(oiChangeDelta);

  let direction = '';
  if (priceChange > 0 && oiChangeDelta > 0) direction = 'Long Buildup';
  else if (priceChange < 0 && oiChangeDelta > 0) direction = 'Short Buildup';
  else if (priceChange < 0 && oiChangeDelta < 0) direction = 'Long Unwinding';
  else if (priceChange > 0 && oiChangeDelta < 0) direction = 'Short Covering';
  else return 'Neutral';

  if (isLive) {
    if (absPrice >= 3.0 || absOIDelta >= 6000) {
      return `Extreme ${direction}`;
    } else if (absPrice < 0.8 && absOIDelta < 1500) {
      return `Mild ${direction}`;
    } else {
      return direction;
    }
  } else {
    if (pricePct >= 0.8 || absOIDelta >= 250000) {
      return `Extreme ${direction}`;
    } else if (pricePct < 0.3 && absOIDelta < 80000) {
      return `Mild ${direction}`;
    } else {
      return direction;
    }
  }
}

// Generate Live Ticks every 1 second (tightly anchored to real Yahoo spot price)
function simulateLiveTick() {
  const timestamp = new Date().toISOString();
  
  // 1. Nifty tick (fluctuates tightly around actual Yahoo Finance price, no compound drift)
  const priceNoise = (Math.random() - 0.5) * 0.40;
  const price = Number((currentNiftySpotPrice + priceNoise).toFixed(2));
  const priceChange = Number((price - lastPrice).toFixed(2));
  lastPrice = price;

  liveSpotPrices.nifty50.price = price;
  const niftyPrev = liveSpotPrices.nifty50.prevClose || price;
  liveSpotPrices.nifty50.change = Number((price - niftyPrev).toFixed(2));
  if (niftyPrev > 0) {
    liveSpotPrices.nifty50.changePercent = Number(((liveSpotPrices.nifty50.change / niftyPrev) * 100).toFixed(2));
  }

  // 2. Bank Nifty & Sensex ticks (anchored to Yahoo quotes)
  if (liveSpotPrices.banknifty.price > 0) {
    const bNoise = (Math.random() - 0.5) * 1.20;
    const bPrice = Number((liveSpotPrices.banknifty.price + bNoise).toFixed(2));
    liveSpotPrices.banknifty.price = bPrice;
    const bPrev = liveSpotPrices.banknifty.prevClose || bPrice;
    liveSpotPrices.banknifty.change = Number((bPrice - bPrev).toFixed(2));
    if (bPrev > 0) liveSpotPrices.banknifty.changePercent = Number(((liveSpotPrices.banknifty.change / bPrev) * 100).toFixed(2));
  }

  if (liveSpotPrices.sensex.price > 0) {
    const sNoise = (Math.random() - 0.5) * 1.60;
    const sPrice = Number((liveSpotPrices.sensex.price + sNoise).toFixed(2));
    liveSpotPrices.sensex.price = sPrice;
    const sPrev = liveSpotPrices.sensex.prevClose || sPrice;
    liveSpotPrices.sensex.change = Number((sPrice - sPrev).toFixed(2));
    if (sPrev > 0) liveSpotPrices.sensex.changePercent = Number(((liveSpotPrices.sensex.change / sPrev) * 100).toFixed(2));
  }

  // 3. Futures OI Tick
  const oiChangeDelta = Math.round((Math.random() - 0.48) * 12000);
  dailyOIChange += oiChangeDelta;
  const currentOI = baseOI + dailyOIChange;

  const volDelta = Math.round(1000 + Math.random() * 4000);
  dailyVolume += volDelta;

  const buildup = classifyBuildup(priceChange, price, oiChangeDelta, true);

  const tick = {
    timestamp,
    price,
    priceChange,
    oi: currentOI,
    oiChange: dailyOIChange,
    oiChangeDelta,
    volume: dailyVolume,
    volumeDelta: volDelta,
    buildup
  };

  liveOITicks.push(tick);
  if (liveOITicks.length > 120) {
    liveOITicks.shift();
  }

  // 4. Process 24/7 background signal engine for Nifty 50
  const niftyMockData = {
    indexName: 'Nifty 50',
    quote: { price: price, changePercent: liveSpotPrices.nifty50.changePercent },
    history: [{ close: price, open: price, high: price, low: price, rsi: 50, sma50: price - 10, sma200: price - 50 }],
    stats: { pivots: { camarilla: { s3: price - 20, r3: price + 20 } } }
  };
  processBackgroundSignal('nifty50', niftyMockData, liveOITicks);
}
setInterval(simulateLiveTick, 1000);

const DB_DIR = path.join(process.cwd(), 'local_database');
const MIN_HOLD_SECONDS = 15 * 60; // 15 minutes minimum hold duration (900 seconds)
const CONFIRM_REVERSAL_TICKS = 30; // 30 consecutive seconds required for confirmed reversal

const bgSignalStates = {
  nifty50:   { lockedRec: null, lockedSignal: null, lockStartMs: 0, pendingSignal: null, pendingTicks: 0, signalHistory: [], lastShiftAlert: null },
  banknifty: { lockedRec: null, lockedSignal: null, lockStartMs: 0, pendingSignal: null, pendingTicks: 0, signalHistory: [], lastShiftAlert: null },
  sensex:    { lockedRec: null, lockedSignal: null, lockStartMs: 0, pendingSignal: null, pendingTicks: 0, signalHistory: [], lastShiftAlert: null },
};

function getSignalHistoryFilePath(indexKey) {
  return path.join(DB_DIR, `signal_history_${indexKey.toLowerCase()}.json`);
}

function loadSignalHistoryFromDisk(indexKey) {
  const filePath = getSignalHistoryFilePath(indexKey);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.error(`Failed to read signal history for ${indexKey}:`, e);
  }
  return [];
}

function saveSignalHistoryToDisk(indexKey, history) {
  const filePath = getSignalHistoryFilePath(indexKey);
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error(`Failed to save signal history for ${indexKey}:`, e);
  }
}

// Load persisted signal history on startup
['nifty50', 'banknifty', 'sensex'].forEach(key => {
  const history = loadSignalHistoryFromDisk(key);
  bgSignalStates[key].signalHistory = history;
  if (history.length > 0) {
    const lastFlip = [...history].reverse().find(e => e.eventType === 'SIGNAL_FLIP' || e.eventType === 'INITIAL');
    if (lastFlip) {
      bgSignalStates[key].lockedRec = lastFlip;
      bgSignalStates[key].lockedSignal = lastFlip.signalType;
      bgSignalStates[key].lockStartMs = lastFlip.lockStartMs || Date.now();
      if (lastFlip.eventType === 'SIGNAL_FLIP') {
        bgSignalStates[key].lastShiftAlert = lastFlip;
      }
    }
  }
});

function processBackgroundSignal(indexKey, mockIndexData, ticks) {
  const state = bgSignalStates[indexKey];
  if (!state) return;

  const rec = generateLiveOptionRecommendation(mockIndexData, ticks, []);
  if (!rec || rec.status === 'LOADING') return;

  const nowMs = Date.now();
  const nowTime = new Date().toLocaleTimeString();
  const elapsedSeconds = state.lockStartMs > 0 ? Math.floor((nowMs - state.lockStartMs) / 1000) : 0;
  const is15MinLocked = elapsedSeconds < MIN_HOLD_SECONDS;

  // Initial signal lock
  if (!state.lockedSignal) {
    state.lockedSignal = rec.signalType;
    state.lockStartMs = nowMs;
    const initialEvent = {
      ...rec,
      time: nowTime,
      eventType: 'INITIAL',
      eventLabel: 'Session Start — Initial 15-Min Signal Lock',
      lockStartMs: nowMs,
    };
    state.lockedRec = initialEvent;
    state.signalHistory.push(initialEvent);
    saveSignalHistoryToDisk(indexKey, state.signalHistory);
    return;
  }

  // Direction matches current locked call
  if (rec.signalType === state.lockedSignal) {
    state.pendingSignal = null;
    state.pendingTicks = 0;
    const updatedLocked = {
      ...rec,
      signalType:      state.lockedRec.signalType,
      signalTitle:     state.lockedRec.signalTitle,
      badgeClass:      state.lockedRec.badgeClass,
      suggestedAction: state.lockedRec.suggestedAction,
      suggestedStrike: state.lockedRec.suggestedStrike,
      lockStartMs:     state.lockStartMs,
      elapsedSeconds,
      is15MinLocked,
    };
    state.lockedRec = updatedLocked;
    return;
  }

  // Different signal direction evaluated
  // If 15-minute lock is active, DO NOT flip signal direction under any circumstances!
  if (is15MinLocked) {
    state.pendingSignal = null;
    state.pendingTicks = 0;
    const updatedLocked = {
      ...rec,
      signalType:      state.lockedRec.signalType,
      signalTitle:     state.lockedRec.signalTitle,
      badgeClass:      state.lockedRec.badgeClass,
      suggestedAction: state.lockedRec.suggestedAction,
      suggestedStrike: state.lockedRec.suggestedStrike,
      lockStartMs:     state.lockStartMs,
      elapsedSeconds,
      is15MinLocked:   true,
    };
    state.lockedRec = updatedLocked;
    return;
  }

  // After 15 minutes have passed, accumulate confirmation ticks for reversal
  if (state.pendingSignal !== rec.signalType) {
    state.pendingSignal = rec.signalType;
    state.pendingTicks = 1;
  } else {
    state.pendingTicks++;
  }

  const updatedLockedPending = {
    ...rec,
    signalType:      state.lockedRec.signalType,
    signalTitle:     state.lockedRec.signalTitle,
    badgeClass:      state.lockedRec.badgeClass,
    suggestedAction: state.lockedRec.suggestedAction,
    suggestedStrike: state.lockedRec.suggestedStrike,
    lockStartMs:     state.lockStartMs,
    elapsedSeconds,
    is15MinLocked:   false,
  };
  state.lockedRec = updatedLockedPending;

  // Confirmed Flip (after 15 minutes hold + 30s sustained confirmation)
  if (state.pendingTicks >= CONFIRM_REVERSAL_TICKS) {
    const prevRec = state.lockedRec || {};
    const flipEvent = {
      ...rec,
      time: nowTime,
      eventType: 'SIGNAL_FLIP',
      eventLabel: '15-Min Hold Completed — Confirmed Trade Shift',
      fromSignalTitle: prevRec.signalTitle,
      fromBadge:       prevRec.badgeClass,
      fromPrice:       prevRec.spotPrice,
      fromScore:       prevRec.consensusScore,
      fromStrike:      prevRec.suggestedStrike,
      fromAction:      prevRec.suggestedAction,
      lockStartMs:     nowMs,
    };

    state.lockedSignal = rec.signalType;
    state.lockStartMs = nowMs;
    state.lockedRec = flipEvent;
    state.lastShiftAlert = flipEvent;
    state.pendingSignal = null;
    state.pendingTicks = 0;

    state.signalHistory.push(flipEvent);
    if (state.signalHistory.length > 100) state.signalHistory.shift();
    saveSignalHistoryToDisk(indexKey, state.signalHistory);
  }
}

// Historical Nifty Futures OI generator mapped to actual Nifty 50 spot history
const HISTORICAL_OI_PATH = path.join(DB_DIR, 'futures_oi_history.json');

function initHistoricalOIDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  console.log('Generating actual-spot based Nifty Futures historical OI database...');
  const history = [];

  const nifty1YPath = path.join(DB_DIR, 'index-data-nifty50-1Y.json');
  let dailyCandles = [];

  if (fs.existsSync(nifty1YPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(nifty1YPath, 'utf8'));
      if (parsed && parsed.history) {
        dailyCandles = parsed.history;
      }
    } catch (e) {
      console.error('Failed to read index-data-nifty50-1Y.json for historical OI:', e);
    }
  }

  // Expiry date calculation helper (last Thursday of each month)
  function getLastThursdayOfMonth(year, month) {
    const lastDay = new Date(year, month + 1, 0);
    let dayOfWeek = lastDay.getDay();
    let date = lastDay.getDate();
    let diff = dayOfWeek - 4;
    if (diff < 0) diff += 7;
    return new Date(year, month, date - diff);
  }

  const indexConfigs = [
    { key: 'nifty50', baseOI: 12000000, cycleOI: 5000000, defaultSpot: 24000 },
    { key: 'banknifty', baseOI: 3200000, cycleOI: 1200000, defaultSpot: 52000 },
    { key: 'sensex', baseOI: 2100000, cycleOI: 800000, defaultSpot: 80000 }
  ];

  function getDeterministicSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 10000) / 10000;
  }

  indexConfigs.forEach(cfg => {
    const targetPath = path.join(DB_DIR, `futures_oi_history_${cfg.key}.json`);
    if (fs.existsSync(targetPath)) {
      // File exists on disk, skip re-generating to preserve 100% exact parity between Localhost and Render
      return;
    }

    const history = [];
    const indexPath = path.join(DB_DIR, `index-data-${cfg.key}-1Y.json`);
    let dailyCandles = [];

    if (fs.existsSync(indexPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        if (parsed && parsed.history) {
          dailyCandles = parsed.history;
        }
      } catch (e) {
        console.error(`Failed to read index-data-${cfg.key}-1Y.json for historical OI:`, e);
      }
    }

    if (dailyCandles.length > 0) {
      let prevOI = cfg.baseOI;
      let prevPrice = dailyCandles[0].close + 15;

      dailyCandles.forEach((candle) => {
        const d = new Date(candle.date);
        let contractExpiry = getLastThursdayOfMonth(d.getFullYear(), d.getMonth());
        if (d.getTime() > contractExpiry.getTime()) {
          contractExpiry = getLastThursdayOfMonth(d.getFullYear(), d.getMonth() + 1);
        }
        
        const daysRemaining = Math.max(0, Math.round((contractExpiry.getTime() - d.getTime()) / (1000 * 3600 * 24)));
        const basis = 25 * (daysRemaining / 30);
        const futuresPrice = Number((candle.close + basis).toFixed(2));
        const dailyPriceChange = Number((futuresPrice - prevPrice).toFixed(2));
        prevPrice = futuresPrice;

        const x = Math.max(0, Math.min(1, (30 - daysRemaining) / 30));
        const cycleVol = cfg.cycleOI * Math.sin(Math.PI * x);
        const oiSeed = getDeterministicSeed(`oi-${cfg.key}-${candle.date}`);
        const variance = (oiSeed - 0.5) * (cfg.baseOI * 0.05);
        const currentOI = Math.round(cfg.baseOI + cycleVol + variance);
        const oiChangeDelta = currentOI - prevOI;
        prevOI = currentOI;

        let futuresVolume = Math.round((candle.volume || 100000) * 0.45);
        if (!futuresVolume || futuresVolume === 0) {
          const dailyRange = Math.abs(candle.high - candle.low) / (candle.close || cfg.defaultSpot);
          const volSeed = getDeterministicSeed(`vol-${cfg.key}-${candle.date}`);
          const baseVol = 80000 + Math.round(volSeed * 60000);
          futuresVolume = Math.round(baseVol * (1 + dailyRange * 12));
        }

        const buildup = classifyBuildup(dailyPriceChange, futuresPrice, oiChangeDelta, false);

        history.push({
          timestamp: `${candle.date}T15:30:00`,
          price: futuresPrice,
          priceChange: dailyPriceChange,
          oi: currentOI,
          oiChange: oiChangeDelta,
          oiChangeDelta: oiChangeDelta,
          volume: futuresVolume,
          volumeDelta: futuresVolume,
          buildup
        });
      });
    }

    try {
      const targetPath = path.join(DB_DIR, `futures_oi_history_${cfg.key}.json`);
      fs.writeFileSync(targetPath, JSON.stringify(history, null, 2), 'utf8');
      if (cfg.key === 'nifty50') {
        fs.writeFileSync(HISTORICAL_OI_PATH, JSON.stringify(history, null, 2), 'utf8');
      }
    } catch (error) {
      console.error(`Failed to write Futures historical OI database for ${cfg.key}:`, error);
    }
  });
  console.log('Generated multi-index Futures historical OI databases (Nifty, Bank Nifty, Sensex).');
}
initHistoricalOIDatabase();

// ── Live Quote Endpoints (returns in-memory synced spot prices, updated every 1s) ──
// GET /api/live-quote/all — returns all indices at once for real-time header cards sync
app.get('/api/live-quote/all', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    indices: liveSpotPrices
  });
});

// GET /api/live-quote/:index
app.get('/api/live-quote/:index', (req, res) => {
  const { index } = req.params;
  const key = index.toLowerCase();
  const spot = liveSpotPrices[key];
  if (!spot) {
    return res.status(400).json({ error: `Invalid index: ${index}. Use: nifty50, banknifty, sensex` });
  }
  res.json({ index: key, ...spot });
});

// Endpoints
app.get('/api/futures-oi/live', (req, res) => {
  res.json({
    status: 'OPEN',
    ticks: liveOITicks
  });
});

// GET /api/futures-oi/signal-state — returns 24/7 background-recorded 15-min locked signal and persisted history
app.get('/api/futures-oi/signal-state', (req, res) => {
  const indexKey = (req.query.index || 'nifty50').toLowerCase();
  const state = bgSignalStates[indexKey] || bgSignalStates['nifty50'];
  const nowMs = Date.now();
  const elapsedSeconds = state.lockStartMs > 0 ? Math.floor((nowMs - state.lockStartMs) / 1000) : 0;
  const remainingLockSeconds = Math.max(0, MIN_HOLD_SECONDS - elapsedSeconds);
  const is15MinLocked = remainingLockSeconds > 0;

  res.json({
    index: indexKey,
    lockedRec: state.lockedRec,
    signalHistory: state.signalHistory,
    lastShiftAlert: state.lastShiftAlert,
    is15MinLocked,
    elapsedSeconds,
    remainingLockSeconds,
    minHoldSeconds: MIN_HOLD_SECONDS,
  });
});

app.get('/api/futures-oi/historical', (req, res) => {
  const index = (req.query.index || 'nifty50').toLowerCase();
  const filePath = path.join(DB_DIR, `futures_oi_history_${index}.json`);
  const legacyPath = HISTORICAL_OI_PATH;

  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return res.json(data);
    } else if (fs.existsSync(legacyPath)) {
      const data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      return res.json(data);
    }
    res.status(404).json({ error: 'Historical database not found' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to read historical database' });
  }
});

// Endpoint to import official NSE daily Bhavcopy / OI records
app.post('/api/futures-oi/upload', (req, res) => {
  try {
    const { index = 'nifty50', records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of official OI records.' });
    }
    const targetPath = path.join(DB_DIR, `futures_oi_history_${index.toLowerCase()}.json`);
    fs.writeFileSync(targetPath, JSON.stringify(records, null, 2), 'utf8');
    if (index.toLowerCase() === 'nifty50') {
      fs.writeFileSync(HISTORICAL_OI_PATH, JSON.stringify(records, null, 2), 'utf8');
    }
    res.json({ status: 'SUCCESS', message: `Imported ${records.length} official OI records for ${index}.` });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to upload official OI records' });
  }
});

app.post('/api/backtest', async (req, res) => {
  try {
    const { index = 'nifty50', timeframe = '1Y', ...config } = req.body;
    const symbol = INDEX_SYMBOLS[index] || '^NSEI';

    // Fetch index candle history
    let candles = [];
    const localData = loadLocalData(`index-data-${index}-${timeframe}`);
    if (localData && localData.history) {
      candles = localData.history;
    } else {
      // Fallback: fetch historical range
      const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095, '5Y': 1825, 'MAX': 3650 };
      const days = daysMap[timeframe] || 365;
      const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await yahooFinance.historical(symbol, { period1, interval: '1d' });
      candles = result.map(c => ({
        date: c.date.toISOString().split('T')[0],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
    }

    const backtestResult = runBacktest(candles, config);
    res.json(backtestResult);
  } catch (error) {
    console.error('Backtest Endpoint Error:', error);
    res.status(500).json({ error: error.message || 'Failed to execute backtest' });
  }
});

// ── Intraday Candle Endpoint ─────────────────────────────────────────────────
// GET /api/intraday?index=nifty50&interval=5m
// interval: 1m | 5m | 15m | 1h | 1d
app.get('/api/intraday', async (req, res) => {
  const index    = (req.query.index    || 'nifty50').toLowerCase();
  const interval = (req.query.interval || '15m').toLowerCase();
  const symbol   = INDEX_SYMBOLS[index];

  if (!symbol) {
    return res.status(400).json({ error: `Invalid index. Choose: ${Object.keys(INDEX_SYMBOLS).join(', ')}` });
  }

  const VALID_INTERVALS = ['1m', '2m', '5m', '15m', '30m', '60m', '1h', '1d'];
  const yfInterval = interval === '1h' ? '60m' : interval;
  if (!VALID_INTERVALS.includes(yfInterval)) {
    return res.status(400).json({ error: `Invalid interval. Choose: 1m, 5m, 15m, 1h, 1d` });
  }

  // Cache key
  const cacheKey = `intraday_${index}_${interval}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Determine lookback window
    const end   = new Date();
    const start = new Date();
    if      (interval === '1m')  start.setHours(start.getHours() - 6);   // last 6h
    else if (interval === '5m')  start.setDate(start.getDate() - 5);     // last 5 days
    else if (interval === '15m') start.setDate(start.getDate() - 10);    // last 10 days
    else if (interval === '1h' || interval === '60m') start.setDate(start.getDate() - 30);  // last 30 days
    else if (interval === '1d')  start.setDate(start.getDate() - 90);    // last 90 days (daily)

    const result = await yahooFinance.chart(symbol, {
      period1:  start,
      period2:  end,
      interval: yfInterval,
    });

    const quotes = result?.quotes || [];
    const candles = quotes
      .filter(q => q.open != null && q.close != null)
      .map(q => {
        // lightweight-charts needs unix timestamp (number) for intraday
        const ts = Math.floor(new Date(q.date).getTime() / 1000);
        return {
          time:   ts,
          open:   Number(q.open.toFixed(2)),
          high:   Number(q.high.toFixed(2)),
          low:    Number(q.low.toFixed(2)),
          close:  Number(q.close.toFixed(2)),
          volume: q.volume || 0,
        };
      })
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time); // dedup

    const payload = {
      index,
      interval,
      symbol,
      candles,
      generatedAt: new Date().toISOString(),
    };

    // Short cache for intraday (60s for 1m, 5min for others)
    const ttl = interval === '1m' ? 60_000 : 5 * 60_000;
    cache.set(cacheKey, { timestamp: Date.now() - (CACHE_DURATION - ttl), data: payload });

    return res.json(payload);
  } catch (err) {
    console.error(`[intraday] Error fetching ${symbol} ${interval}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Serve React production build files

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Market Analyzer Web App running on http://localhost:${PORT}`);
});

/**
 * Math and analysis helper utilities for Indian index data analysis.
 */

// Simple Moving Average (SMA)
export function calculateSMA(prices, period) {
  const sma = new Array(prices.length).fill(null);
  if (prices.length < period) return sma;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  sma[period - 1] = sum / period;

  for (let i = period; i < prices.length; i++) {
    sum = sum - prices[i - period] + prices[i];
    sma[i] = sum / period;
  }
  return sma;
}

// Exponential Moving Average (EMA)
export function calculateEMA(prices, period) {
  const ema = new Array(prices.length).fill(null);
  if (prices.length < period) return ema;

  // First EMA is the SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  let currentEma = sum / period;
  ema[period - 1] = currentEma;

  const k = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    ema[i] = currentEma;
  }
  return ema;
}

// Relative Strength Index (RSI) - 14-period
export function calculateRSI(prices, period = 14) {
  const rsi = new Array(prices.length).fill(null);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  // Calculate first average gain and loss
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    let gain = 0;
    let loss = 0;
    if (diff > 0) {
      gain = diff;
    } else {
      loss = -diff;
    }

    // Wilder's smoothing
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

// Moving Average Convergence Divergence (MACD) - 12/26/9
export function calculateMACD(prices, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const shortEma = calculateEMA(prices, shortPeriod);
  const longEma = calculateEMA(prices, longPeriod);
  
  const macdLine = new Array(prices.length).fill(null);
  const signalLine = new Array(prices.length).fill(null);
  const histogram = new Array(prices.length).fill(null);

  // Compute MACD Line = EMA(12) - EMA(26)
  for (let i = 0; i < prices.length; i++) {
    if (shortEma[i] !== null && longEma[i] !== null) {
      macdLine[i] = shortEma[i] - longEma[i];
    }
  }

  // Calculate Signal Line = EMA(9) of MACD Line
  // Filter out nulls to run EMA on the valid MACD subset
  const firstValidIndex = macdLine.findIndex(val => val !== null);
  if (firstValidIndex !== -1 && macdLine.length - firstValidIndex >= signalPeriod) {
    const macdSubset = macdLine.slice(firstValidIndex);
    const macdSubsetSignal = calculateEMA(macdSubset, signalPeriod);
    
    for (let i = 0; i < macdSubsetSignal.length; i++) {
      const originalIdx = i + firstValidIndex;
      signalLine[originalIdx] = macdSubsetSignal[i];
      if (macdLine[originalIdx] !== null && signalLine[originalIdx] !== null) {
        histogram[originalIdx] = macdLine[originalIdx] - signalLine[originalIdx];
      }
    }
  }

  return { macdLine, signalLine, histogram };
}

// Bollinger Bands (20-day SMA, 2x StdDev)
export function calculateBollingerBands(prices, period = 20, multiplier = 2) {
  const middleBand = calculateSMA(prices, period);
  const upperBand = new Array(prices.length).fill(null);
  const lowerBand = new Array(prices.length).fill(null);

  for (let i = period - 1; i < prices.length; i++) {
    // Slice previous 20 close prices
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = middleBand[i];
    
    // Variance
    const sumSqDiff = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    const stdDev = Math.sqrt(sumSqDiff / period);

    upperBand[i] = mean + multiplier * stdDev;
    lowerBand[i] = mean - multiplier * stdDev;
  }

  return { upperBand, middleBand, lowerBand };
}

// Standard Pivot Points based on a single candle (usually last completed daily candle)
export function calculatePivotPoints(high, low, close) {
  const p = (high + low + close) / 3;

  // Classic Pivot Points
  const r1Classic = 2 * p - low;
  const s1Classic = 2 * p - high;
  const r2Classic = p + (high - low);
  const s2Classic = p - (high - low);
  const r3Classic = high + 2 * (p - low);
  const s3Classic = low - 2 * (high - p);

  // Fibonacci Pivot Points
  const r1Fib = p + 0.382 * (high - low);
  const s1Fib = p - 0.382 * (high - low);
  const r2Fib = p + 0.618 * (high - low);
  const s2Fib = p - 0.618 * (high - low);
  const r3Fib = p + 1.000 * (high - low);
  const s3Fib = p - 1.000 * (high - low);

  // Camarilla Pivot Points
  const diff = high - low;
  const r1Cam = close + diff * 1.1 / 12;
  const r2Cam = close + diff * 1.1 / 6;
  const r3Cam = close + diff * 1.1 / 4;
  const r4Cam = close + diff * 1.1 / 2;
  const s1Cam = close - diff * 1.1 / 12;
  const s2Cam = close - diff * 1.1 / 6;
  const s3Cam = close - diff * 1.1 / 4;
  const s4Cam = close - diff * 1.1 / 2;

  return {
    classic: { p, r1: r1Classic, s1: s1Classic, r2: r2Classic, s2: s2Classic, r3: r3Classic, s3: s3Classic },
    fibonacci: { p, r1: r1Fib, s1: s1Fib, r2: r2Fib, s2: s2Fib, r3: r3Fib, s3: s3Fib },
    camarilla: { p, r1: r1Cam, s1: s1Cam, r2: r2Cam, s2: s2Cam, r3: r3Cam, s3: s3Cam, r4: r4Cam, s4: s4Cam }
  };
}

// Calculate Pearson Correlation Coefficient between two arrays
export function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0;
  let sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return den === 0 ? 0 : num / den;
}

// Calculate Drawdown Statistics (returns drawdown timeline, max drawdown %, current drawdown %)
export function calculateDrawdown(prices) {
  if (prices.length === 0) return { drawdowns: [], maxDrawdown: 0, currentDrawdown: 0 };
  
  const drawdowns = new Array(prices.length).fill(0);
  let peak = -Infinity;
  let maxDrawdown = 0;

  for (let i = 0; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
    }
    const drawdown = peak === 0 ? 0 : ((prices[i] - peak) / peak) * 100;
    drawdowns[i] = drawdown;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const currentDrawdown = drawdowns[drawdowns.length - 1];

  return {
    drawdowns,
    maxDrawdown: Math.abs(maxDrawdown), // Return as positive number for stats
    currentDrawdown: Math.abs(currentDrawdown)
  };
}

// Candlestick pattern detection in last few periods
export function detectCandlestickPatterns(candles, count = 5) {
  if (candles.length < 3) return [];
  
  const patterns = [];
  const startIdx = Math.max(1, candles.length - count);

  // Compute average candle body range to compare scale
  let bodySum = 0;
  for (let i = 0; i < candles.length; i++) {
    bodySum += Math.abs(candles[i].close - candles[i].open);
  }
  const avgBody = bodySum / candles.length;

  for (let i = startIdx; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const open = curr.open;
    const close = curr.close;
    const high = curr.high;
    const low = curr.low;

    const body = Math.abs(close - open);
    const range = high - low;
    
    if (range === 0) continue;

    const isBullish = close > open;
    const isBearish = close < open;

    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;

    // Doji (Tiny body relative to entire trading range)
    if (body <= range * 0.1) {
      patterns.push({
        date: curr.date,
        pattern: 'Doji',
        type: 'Neutral / Indecision',
        description: 'Open and close are almost equal, signifying buyer/seller equilibrium.'
      });
      continue;
    }

    // Hammer (Bullish Reversal: small body at top, long lower shadow, small/no upper shadow)
    if (lowerShadow >= body * 2 && upperShadow <= range * 0.1 && body > avgBody * 0.3) {
      patterns.push({
        date: curr.date,
        pattern: 'Hammer',
        type: 'Bullish Reversal',
        description: 'Small body near the high, with a long lower shadow suggesting strong intraday recovery.'
      });
    }

    // Inverted Hammer (Bullish Reversal: small body at bottom, long upper shadow)
    if (upperShadow >= body * 2 && lowerShadow <= range * 0.1 && body > avgBody * 0.3) {
      patterns.push({
        date: curr.date,
        pattern: 'Inverted Hammer',
        type: 'Bullish Reversal',
        description: 'Small body near the low, with a long upper shadow showing buyers pushed up but met resistance.'
      });
    }

    // Hanging Man / Shooting Star (Bearish Reversal: small body, long upper shadow, at top of a range)
    // Here we simplify: if it looks like a shooting star (long upper shadow, small body, small lower shadow)
    if (upperShadow >= body * 2 && lowerShadow <= range * 0.1 && body > avgBody * 0.3 && isBearish) {
      patterns.push({
        date: curr.date,
        pattern: 'Shooting Star',
        type: 'Bearish Reversal',
        description: 'Bearish signal with a long upper wick and small body near the low, showing rejection of higher prices.'
      });
    }

    // Bullish Engulfing (Current bullish body fully engulfs previous bearish body)
    if (prev.close < prev.open && isBullish && open < prev.close && close > prev.open) {
      patterns.push({
        date: curr.date,
        pattern: 'Bullish Engulfing',
        type: 'Strong Bullish Reversal',
        description: 'Large green candle completely engulfs the body of the previous red candle, showing buyers took control.'
      });
    }

    // Bearish Engulfing (Current bearish body fully engulfs previous bullish body)
    if (prev.close > prev.open && isBearish && open > prev.close && close < prev.open) {
      patterns.push({
        date: curr.date,
        pattern: 'Bearish Engulfing',
        type: 'Strong Bearish Reversal',
        description: 'Large red candle completely engulfs the body of the previous green candle, indicating intense selling pressure.'
      });
    }
  }

  return patterns;
}

/**
 * Friday Close → Tuesday Close Analysis
 *
 * For each Friday in the candle series, finds the next Tuesday close
 * (within a 3–7 calendar day window, i.e., the first trading day
 * that falls on Monday or Tuesday after the weekend).
 *
 * "Holiday fallback" rules:
 *   - If a candle marked Friday is missing (exchange holiday), we use
 *     the last available candle from that week (Thursday or earlier).
 *   - If Tuesday is missing, we use the first available candle of the
 *     following week (Monday or Wednesday).
 *
 * @param {Array<{date: string|Date, open: number, high: number, low: number, close: number}>} candles
 *   Sorted ascending by date.
 * @returns {{pairs: Array, summary: Object}}
 */
export function calculateFridayTuesdayAnalysis(candles, vixByDate = null) {
  if (!candles || candles.length < 5) {
    return { pairs: [], summary: null };
  }

  // Helper: get VIX close for a given JS Date (YYYY-MM-DD key)
  const getVIX = (d) => {
    if (!vixByDate || !d) return null;
    const key = d instanceof Date
      ? d.toISOString().slice(0, 10)
      : String(d).slice(0, 10);
    const v = vixByDate.get(key);
    return (v != null) ? Number(v.toFixed(2)) : null;
  };

  // Normalize each candle's date to a JS Date object + dayOfWeek (0=Sun … 6=Sat)
  const enriched = candles.map(c => {
    const d = c.date instanceof Date ? new Date(c.date) : new Date(c.date);
    // Strip time component to compare dates cleanly
    d.setHours(0, 0, 0, 0);
    return { ...c, _d: d, _dow: d.getDay() };
  });

  const pairs = [];

  // Index enriched candles by ISO date string for O(1) lookup
  const byDate = new Map();
  enriched.forEach(c => byDate.set(c._d.toISOString().slice(0, 10), c));

  // Iterate – when we hit a Friday (or Thursday as fallback), look ahead for the Tuesday
  const processed = new Set(); // avoid duplicate Friday picks in the same week

  for (let i = 0; i < enriched.length; i++) {
    const candle = enriched[i];

    // We consider Friday (5) candles as weekend anchors.
    // Also accept Thursday (4) only when the very next market day is Monday/Tuesday
    // (meaning Friday was a holiday — we detect this by checking if the next candle
    //  after candle[i] is >= 3 days away).
    const isFriday = candle._dow === 5;
    const isThursdayFallback =
      candle._dow === 4 &&
      i + 1 < enriched.length &&
      (enriched[i + 1]._d - candle._d) / 86400000 >= 3;

    if (!isFriday && !isThursdayFallback) continue;

    // Compute a week key (year + ISO week) to prevent duplicates
    const weekKey = `${candle._d.getFullYear()}-W${getISOWeek(candle._d)}`;
    if (processed.has(weekKey)) continue;
    processed.add(weekKey);

    const fridayCandle = candle;

    // Now search forward for the matching Tuesday (or Monday fallback, or Wednesday fallback)
    // The Tuesday should be 3–7 calendar days after the Friday candle
    let tuesdayCandle = null;
    let mondayCandle  = null;  // ← always capture Monday even when Tuesday exists

    for (let j = i + 1; j < enriched.length; j++) {
      const diffDays = (enriched[j]._d - fridayCandle._d) / 86400000;

      // Stop searching if we've gone past 8 calendar days (too far into next week)
      if (diffDays > 8) break;

      const dow = enriched[j]._dow;

      // Capture Monday regardless (used for Monday-close display in UI)
      if (dow === 1 && !mondayCandle) {
        mondayCandle = enriched[j];
      }

      // Accept Monday(1), Tuesday(2) — Tuesday preferred, Monday as last resort
      if (dow === 2) {
        // Ideal: actual Tuesday
        tuesdayCandle = enriched[j];
        break;
      }
      if (dow === 1 && !tuesdayCandle) {
        // Monday fallback — keep searching in case Tuesday exists
        tuesdayCandle = enriched[j];
      }
      // Wednesday fallback only if nothing else found and diffDays <= 6
      if (dow === 3 && !tuesdayCandle && diffDays <= 6) {
        tuesdayCandle = enriched[j];
      }
    }

    if (!tuesdayCandle) continue; // No suitable closing day found this week

    const fridayClose  = fridayCandle.close;
    const fridayOpen   = fridayCandle.open;
    const tuesdayClose = tuesdayCandle.close;
    const tuesdayOpen  = tuesdayCandle.open;
    const mondayClose  = mondayCandle ? Number(mondayCandle.close.toFixed(2)) : null;
    const mondayOpen   = mondayCandle ? Number(mondayCandle.open.toFixed(2))  : null;
    const pointsMoved  = tuesdayClose - fridayClose;
    const pctMoved     = ((tuesdayClose - fridayClose) / fridayClose) * 100;

    pairs.push({
      fridayDate:   toLocalDateString(fridayCandle._d),
      fridayOpen:   Number(fridayOpen.toFixed(2)),
      fridayClose:  Number(fridayClose.toFixed(2)),
      fridayVIX:    getVIX(fridayCandle._d),
      mondayDate:   mondayCandle ? toLocalDateString(mondayCandle._d) : null,
      mondayOpen,
      mondayOpenVIX: mondayCandle ? getVIX(mondayCandle._d) : null,
      mondayClose,
      mondayVIX:    mondayCandle ? getVIX(mondayCandle._d) : null,
      tuesdayDate:  toLocalDateString(tuesdayCandle._d),
      tuesdayOpen:  Number(tuesdayOpen.toFixed(2)),
      tuesdayOpenVIX: getVIX(tuesdayCandle._d),
      tuesdayClose: Number(tuesdayClose.toFixed(2)),
      tuesdayVIX:   getVIX(tuesdayCandle._d),
      pointsMoved:  Number(pointsMoved.toFixed(2)),
      pctMoved:     Number(pctMoved.toFixed(3)),
      direction:    pointsMoved >= 0 ? 'UP' : 'DOWN',
      // Human-readable day names (for the fallback indicator in UI)
      fridayDay:    getDayName(fridayCandle._dow),
      tuesdayDay:   getDayName(tuesdayCandle._dow),
      mondayDay:    mondayCandle ? getDayName(mondayCandle._dow) : null,
    });
  }

  if (pairs.length === 0) return { pairs: [], summary: null };

  // ── Summary statistics ──────────────────────────────────────────────
  const totalWeeks   = pairs.length;
  const upWeeks      = pairs.filter(p => p.direction === 'UP').length;
  const downWeeks    = totalWeeks - upWeeks;
  const winRate      = (upWeeks / totalWeeks) * 100;

  const sumPoints    = pairs.reduce((s, p) => s + p.pointsMoved, 0);
  const sumPct       = pairs.reduce((s, p) => s + p.pctMoved, 0);
  const avgPoints    = sumPoints / totalWeeks;
  const avgPct       = sumPct / totalWeeks;

  const absPoints    = pairs.map(p => Math.abs(p.pointsMoved));
  const avgAbsPoints = absPoints.reduce((s, v) => s + v, 0) / totalWeeks;

  // Extremes
  const maxGain = pairs.reduce((best, p) => p.pointsMoved > best.pointsMoved ? p : best, pairs[0]);
  const maxLoss = pairs.reduce((worst, p) => p.pointsMoved < worst.pointsMoved ? p : worst, pairs[0]);

  // Streak tracking (current streak from most-recent week)
  let currentStreak = 0;
  let streakDir = pairs[pairs.length - 1].direction;
  for (let i = pairs.length - 1; i >= 0; i--) {
    if (pairs[i].direction === streakDir) currentStreak++;
    else break;
  }

  // Monthly win-rate breakdown (last 12 months buckets)
  const monthBuckets = {};
  pairs.forEach(p => {
    const month = p.fridayDate.slice(0, 7); // "YYYY-MM"
    if (!monthBuckets[month]) monthBuckets[month] = { up: 0, total: 0 };
    monthBuckets[month].total++;
    if (p.direction === 'UP') monthBuckets[month].up++;
  });
  const monthlyBreakdown = Object.entries(monthBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      winRate: Number(((v.up / v.total) * 100).toFixed(1)),
      count: v.total,
      up: v.up,
      down: v.total - v.up,
    }));

  const summary = {
    totalWeeks,
    upWeeks,
    downWeeks,
    winRate:      Number(winRate.toFixed(2)),
    avgPoints:    Number(avgPoints.toFixed(2)),
    avgAbsPoints: Number(avgAbsPoints.toFixed(2)),
    avgPct:       Number(avgPct.toFixed(3)),
    maxGain,
    maxLoss,
    currentStreak,
    streakDirection: streakDir,
    monthlyBreakdown,
  };

  const extra = calculateExtendedMetrics(pairs, 'fridayDate');
  return { pairs, summary, ...extra };
}

/**
 * Tuesday Close → Thursday Close Analysis
 *
 * For each Tuesday in the candle series, finds the next Thursday close
 * within the same calendar week (2 trading days later).
 *
 * "Holiday fallback" rules:
 *   - If Tuesday is missing (market holiday), use Wednesday as anchor
 *     (detected by a gap of ≥ 2 days from the previous trading candle).
 *   - If Thursday is missing, use Friday as the target.
 *
 * @param {Array<{date: string|Date, open: number, high: number, low: number, close: number}>} candles
 *   Sorted ascending by date.
 * @returns {{pairs: Array, summary: Object}}
 */
export function calculateTuesdayThursdayAnalysis(candles) {
  if (!candles || candles.length < 5) {
    return { pairs: [], summary: null };
  }

  // Normalize each candle's date to a JS Date + dayOfWeek (0=Sun…6=Sat)
  const enriched = candles.map(c => {
    const d = c.date instanceof Date ? new Date(c.date) : new Date(c.date);
    d.setHours(0, 0, 0, 0);
    return { ...c, _d: d, _dow: d.getDay() };
  });

  const pairs = [];
  const processed = new Set(); // prevent duplicate picks in same week

  for (let i = 0; i < enriched.length; i++) {
    const candle = enriched[i];

    // Anchor on Tuesday (2).
    // Wednesday (3) fallback: previous candle was ≥ 2 days ago,
    // meaning Tuesday was a market holiday.
    const isTuesday = candle._dow === 2;
    const isWednesdayFallback =
      candle._dow === 3 &&
      i > 0 &&
      (candle._d - enriched[i - 1]._d) / 86400000 >= 2;

    if (!isTuesday && !isWednesdayFallback) continue;

    // Use ISO week to deduplicate (one pair per calendar week)
    const weekKey = `${candle._d.getFullYear()}-W${getISOWeek(candle._d)}`;
    if (processed.has(weekKey)) continue;
    processed.add(weekKey);

    const tuesdayCandle = candle;

    // Search forward for Thursday (4) within 5 calendar days.
    // Friday (5) is accepted as fallback if Thursday was a holiday.
    let thursdayCandle = null;

    for (let j = i + 1; j < enriched.length; j++) {
      const diffDays = (enriched[j]._d - tuesdayCandle._d) / 86400000;
      if (diffDays > 5) break; // Too far — next week

      const dow = enriched[j]._dow;

      if (dow === 4) {
        thursdayCandle = enriched[j];
        break; // Ideal: actual Thursday
      }
      if (dow === 5 && !thursdayCandle && diffDays <= 4) {
        // Friday fallback (Thursday was market holiday)
        thursdayCandle = enriched[j];
      }
    }

    if (!thursdayCandle) continue;

    const tuesdayClose  = tuesdayCandle.close;
    const thursdayClose = thursdayCandle.close;
    const pointsMoved   = thursdayClose - tuesdayClose;
    const pctMoved      = ((thursdayClose - tuesdayClose) / tuesdayClose) * 100;

    pairs.push({
      tuesdayDate:   toLocalDateString(tuesdayCandle._d),
      tuesdayClose:  Number(tuesdayClose.toFixed(2)),
      thursdayDate:  toLocalDateString(thursdayCandle._d),
      thursdayClose: Number(thursdayClose.toFixed(2)),
      pointsMoved:   Number(pointsMoved.toFixed(2)),
      pctMoved:      Number(pctMoved.toFixed(3)),
      direction:     pointsMoved >= 0 ? 'UP' : 'DOWN',
      tuesdayDay:    getDayName(tuesdayCandle._dow),  // fallback indicator
      thursdayDay:   getDayName(thursdayCandle._dow),
    });
  }

  if (pairs.length === 0) return { pairs: [], summary: null };

  // ── Summary statistics ──────────────────────────────────────────────
  const totalWeeks   = pairs.length;
  const upWeeks      = pairs.filter(p => p.direction === 'UP').length;
  const downWeeks    = totalWeeks - upWeeks;
  const winRate      = (upWeeks / totalWeeks) * 100;

  const sumPoints    = pairs.reduce((s, p) => s + p.pointsMoved, 0);
  const sumPct       = pairs.reduce((s, p) => s + p.pctMoved, 0);
  const avgPoints    = sumPoints / totalWeeks;
  const avgPct       = sumPct / totalWeeks;

  const absPoints    = pairs.map(p => Math.abs(p.pointsMoved));
  const avgAbsPoints = absPoints.reduce((s, v) => s + v, 0) / totalWeeks;

  const maxGain = pairs.reduce((best, p)  => p.pointsMoved > best.pointsMoved ? p : best, pairs[0]);
  const maxLoss = pairs.reduce((worst, p) => p.pointsMoved < worst.pointsMoved ? p : worst, pairs[0]);

  // Current streak (from the most-recent week backwards)
  let currentStreak = 0;
  let streakDir = pairs[pairs.length - 1].direction;
  for (let i = pairs.length - 1; i >= 0; i--) {
    if (pairs[i].direction === streakDir) currentStreak++;
    else break;
  }

  // Monthly win-rate breakdown
  const monthBuckets = {};
  pairs.forEach(p => {
    const month = p.tuesdayDate.slice(0, 7); // "YYYY-MM"
    if (!monthBuckets[month]) monthBuckets[month] = { up: 0, total: 0 };
    monthBuckets[month].total++;
    if (p.direction === 'UP') monthBuckets[month].up++;
  });
  const monthlyBreakdown = Object.entries(monthBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      winRate: Number(((v.up / v.total) * 100).toFixed(1)),
      count: v.total,
      up: v.up,
      down: v.total - v.up,
    }));

  const summary = {
    totalWeeks,
    upWeeks,
    downWeeks,
    winRate:      Number(winRate.toFixed(2)),
    avgPoints:    Number(avgPoints.toFixed(2)),
    avgAbsPoints: Number(avgAbsPoints.toFixed(2)),
    avgPct:       Number(avgPct.toFixed(3)),
    maxGain,
    maxLoss,
    currentStreak,
    streakDirection: streakDir,
    monthlyBreakdown,
  };

  const extra = calculateExtendedMetrics(pairs, 'tuesdayDate');
  return { pairs, summary, ...extra };
}

function calculateExtendedMetrics(pairs, dateKey) {
  if (!pairs || pairs.length === 0) {
    return {
      distribution: { absolute: [], signed: [] },
      yearlySeasonality: [],
      monthlySeasonality: [],
      streaks: []
    };
  }

  // 1. Absolute distribution (7 buckets)
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
    const count = pairs.filter(p => {
      const absVal = Math.abs(p.pctMoved);
      return absVal >= b.min && absVal < b.max;
    }).length;
    return {
      label: b.label,
      count,
      percentage: Number(((count / pairs.length) * 100).toFixed(2))
    };
  });

  // 2. Signed distribution (10 buckets)
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
    const count = pairs.filter(p => p.pctMoved >= b.min && p.pctMoved < b.max).length;
    return {
      label: b.label,
      count,
      percentage: Number(((count / pairs.length) * 100).toFixed(2))
    };
  });

  // 3. Yearly seasonality breakdown
  const yearlyGroup = {};
  pairs.forEach(p => {
    const year = p[dateKey].slice(0, 4);
    if (!yearlyGroup[year]) yearlyGroup[year] = [];
    yearlyGroup[year].push(p);
  });

  const yearlySeasonality = Object.keys(yearlyGroup)
    .sort((a, b) => b - a) // Year descending
    .map(year => {
      const yrPairs = yearlyGroup[year];
      const total = yrPairs.length;
      const up = yrPairs.filter(p => p.direction === 'UP').length;
      const winRate = Number(((up / total) * 100).toFixed(2));
      const avgPct = Number((yrPairs.reduce((sum, p) => sum + p.pctMoved, 0) / total).toFixed(3));
      const avgAbsPct = Number((yrPairs.reduce((sum, p) => sum + Math.abs(p.pctMoved), 0) / total).toFixed(3));
      return {
        year,
        totalWeeks: total,
        upWeeks: up,
        downWeeks: total - up,
        winRate,
        avgPct,
        avgAbsPct
      };
    });

  // 4. Monthly seasonality breakdown
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthlyGroups = Array.from({ length: 12 }, () => []);
  pairs.forEach(p => {
    const mIdx = new Date(p[dateKey]).getMonth(); // 0-11
    if (mIdx >= 0 && mIdx < 12) {
      monthlyGroups[mIdx].push(p);
    }
  });

  const monthlySeasonality = monthlyGroups
    .map((mPairs, mIdx) => {
      if (mPairs.length === 0) return null;
      const total = mPairs.length;
      const up = mPairs.filter(p => p.direction === 'UP').length;
      const winRate = Number(((up / total) * 100).toFixed(2));
      const avgPct = Number((mPairs.reduce((sum, p) => sum + p.pctMoved, 0) / total).toFixed(3));
      const avgAbsPct = Number((mPairs.reduce((sum, p) => sum + Math.abs(p.pctMoved), 0) / total).toFixed(3));
      return {
        month: monthNames[mIdx],
        monthIndex: mIdx,
        totalWeeks: total,
        upWeeks: up,
        downWeeks: total - up,
        winRate,
        avgPct,
        avgAbsPct
      };
    })
    .filter(Boolean);

  // 5. Streak Analysis
  let streaks = [];
  let currentStreakCount = 1;
  let currentDir = pairs[0].direction;

  for (let i = 1; i < pairs.length; i++) {
    if (pairs[i].direction === currentDir) {
      currentStreakCount++;
    } else {
      streaks.push({ direction: currentDir, length: currentStreakCount });
      currentStreakCount = 1;
      currentDir = pairs[i].direction;
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
    distribution: { absolute: absoluteDist, signed: signedDist },
    yearlySeasonality,
    monthlySeasonality,
    streaks: streaksList
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function toLocalDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDayName(dow) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
}

export function calculateTuesdayThursdayOptionsAnalysis(candles, vixByDate = null) {
  if (!candles || candles.length < 3) {
    return { pairs: [], summary: null };
  }

  const getVIX = (d) => {
    if (!vixByDate || !d) return null;
    const key = d instanceof Date
      ? d.toISOString().slice(0, 10)
      : String(d).slice(0, 10);
    const v = vixByDate.get(key);
    return (v != null) ? Number(v.toFixed(2)) : null;
  };

  const enriched = candles.map(c => {
    const d = c.date instanceof Date ? new Date(c.date) : new Date(c.date);
    d.setHours(0, 0, 0, 0);
    return { ...c, _d: d, _dow: d.getDay() };
  });

  const pairs = [];
  const processed = new Set();

  for (let i = 0; i < enriched.length; i++) {
    const candle = enriched[i];

    const isTuesday = candle._dow === 2;
    const isWednesdayFallback =
      candle._dow === 3 &&
      i > 0 &&
      (candle._d - enriched[i - 1]._d) / 86400000 >= 2;

    if (!isTuesday && !isWednesdayFallback) continue;

    const weekKey = `${candle._d.getFullYear()}-W${getISOWeek(candle._d)}`;
    if (processed.has(weekKey)) continue;
    processed.add(weekKey);

    const tuesdayCandle = candle;

    let wednesdayCandle = null;
    let thursdayCandle = null;

    for (let j = i + 1; j < enriched.length; j++) {
      const diffDays = (enriched[j]._d - tuesdayCandle._d) / 86400000;
      if (diffDays > 5) break;

      const dow = enriched[j]._dow;

      if (dow === 3 && !wednesdayCandle) {
        wednesdayCandle = enriched[j];
      }

      if (dow === 4) {
        thursdayCandle = enriched[j];
        break;
      }
      if (dow === 5 && !thursdayCandle) {
        thursdayCandle = enriched[j];
      }
    }

    if (!thursdayCandle) continue;

    const tuesdayClose  = tuesdayCandle.close;
    const tuesdayOpen   = tuesdayCandle.open;
    const thursdayClose = thursdayCandle.close;
    const thursdayOpen  = thursdayCandle.open;
    
    const wednesdayClose = wednesdayCandle ? Number(wednesdayCandle.close.toFixed(2)) : null;
    const wednesdayOpen  = wednesdayCandle ? Number(wednesdayCandle.open.toFixed(2)) : null;
    
    const pointsMoved   = thursdayClose - tuesdayClose;
    const pctMoved      = ((thursdayClose - tuesdayClose) / tuesdayClose) * 100;

    pairs.push({
      tuesdayDate:   toLocalDateString(tuesdayCandle._d),
      tuesdayOpen:   Number(tuesdayOpen.toFixed(2)),
      tuesdayClose:  Number(tuesdayClose.toFixed(2)),
      tuesdayVIX:    getVIX(tuesdayCandle._d),
      wednesdayDate: wednesdayCandle ? toLocalDateString(wednesdayCandle._d) : null,
      wednesdayOpen,
      wednesdayOpenVIX: wednesdayCandle ? getVIX(wednesdayCandle._d) : null,
      wednesdayClose,
      wednesdayVIX:  wednesdayCandle ? getVIX(wednesdayCandle._d) : null,
      thursdayDate:  toLocalDateString(thursdayCandle._d),
      thursdayOpen:  Number(thursdayOpen.toFixed(2)),
      thursdayOpenVIX: getVIX(thursdayCandle._d),
      thursdayClose: Number(thursdayClose.toFixed(2)),
      thursdayVIX:   getVIX(thursdayCandle._d),
      pointsMoved:   Number(pointsMoved.toFixed(2)),
      pctMoved:      Number(pctMoved.toFixed(3)),
      direction:     pointsMoved >= 0 ? 'UP' : 'DOWN',
      tuesdayDay:    getDayName(tuesdayCandle._dow),
      thursdayDay:   getDayName(thursdayCandle._dow),
      wednesdayDay:  wednesdayCandle ? getDayName(wednesdayCandle._dow) : null,
    });
  }

  if (pairs.length === 0) return { pairs: [], summary: null };

  const totalWeeks   = pairs.length;
  const upWeeks      = pairs.filter(p => p.direction === 'UP').length;
  const downWeeks    = totalWeeks - upWeeks;
  const winRate      = (upWeeks / totalWeeks) * 100;

  const sumPoints    = pairs.reduce((s, p) => s + p.pointsMoved, 0);
  const sumPct       = pairs.reduce((s, p) => s + p.pctMoved, 0);
  const avgPoints    = sumPoints / totalWeeks;
  const avgPct       = sumPct / totalWeeks;

  const absPoints    = pairs.map(p => Math.abs(p.pointsMoved));
  const avgAbsPoints = absPoints.reduce((s, v) => s + v, 0) / totalWeeks;

  const maxGain = pairs.reduce((best, p)  => p.pointsMoved > best.pointsMoved ? p : best, pairs[0]);
  const maxLoss = pairs.reduce((worst, p) => p.pointsMoved < worst.pointsMoved ? p : worst, pairs[0]);

  let currentStreak = 0;
  let streakDir = pairs[pairs.length - 1].direction;
  for (let i = pairs.length - 1; i >= 0; i--) {
    if (pairs[i].direction === streakDir) currentStreak++;
    else break;
  }

  const monthBuckets = {};
  pairs.forEach(p => {
    const month = p.tuesdayDate.slice(0, 7);
    if (!monthBuckets[month]) monthBuckets[month] = { up: 0, total: 0 };
    monthBuckets[month].total++;
    if (p.direction === 'UP') monthBuckets[month].up++;
  });
  const monthlyBreakdown = Object.entries(monthBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      winRate: Number(((v.up / v.total) * 100).toFixed(1)),
      count: v.total,
      up: v.up,
      down: v.total - v.up,
    }));

  const summary = {
    totalWeeks,
    upWeeks,
    downWeeks,
    winRate:      Number(winRate.toFixed(2)),
    avgPoints:    Number(avgPoints.toFixed(2)),
    avgAbsPoints: Number(avgAbsPoints.toFixed(2)),
    avgPct:       Number(avgPct.toFixed(3)),
    maxGain,
    maxLoss,
    currentStreak,
    streakDirection: streakDir,
    monthlyBreakdown,
  };

  const extra = calculateExtendedMetrics(pairs, 'tuesdayDate');
  return { pairs, summary, ...extra };
}

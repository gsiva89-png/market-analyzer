# Market Historical Analyzer — Complete Project Context

> **Last Updated:** 2026-07-15
> **Location:** `d:\SIVA\MARKET`
> **Status:** Fully functional, production-ready dashboard

---

## 1. Project Overview

**Market Historical Analyzer** is a full-stack, dark-mode financial analytics dashboard for Indian stock market indices. It fetches live and historical data from Yahoo Finance, computes technical indicators server-side, and displays them in a rich, interactive React UI.

### Supported Indices
| Index | Yahoo Finance Symbol | Theme Color |
|-------|---------------------|-------------|
| Nifty 50 | `^NSEI` | Cyan (`#00f2fe`) |
| Bank Nifty | `^NSEBANK` | Purple (`#a855f7`) |
| Sensex | `^BSESN` | Orange (`#f97316`) |

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | `^18.3.1` |
| Build Tool | Vite | `^5.4.8` |
| Backend | Node.js + Express | `^4.21.0` |
| Data Source | yahoo-finance2 | `^2.14.2` |
| Charts | Recharts | `^2.12.7` |
| Icons | lucide-react | `^0.453.0` |
| Styling | Vanilla CSS (no Tailwind) | — |
| Fonts | Google Fonts — Outfit (UI) + JetBrains Mono (numbers) | — |
| Dev Runner | concurrently (frontend + backend) | `^9.0.1` |
| Environment | dotenv | `^16.4.5` |
| CORS | cors | `^2.8.5` |

---

## 3. Project File Structure

```
d:\SIVA\MARKET\
├── index.html              # HTML entry — loads Google Fonts, mounts #root
├── package.json            # npm config, scripts, all dependencies
├── vite.config.js          # Vite config — port 3000, API proxy to localhost:5000
├── server.js               # Express backend — all API endpoints (663 lines)
├── analysis.js             # Pure-JS math/analysis helpers (518 lines)
├── test-server.js          # Standalone server test script
├── PROJECT_CONTEXT.md      # This file — full project documentation
├── node_modules/
└── src/
    ├── main.jsx            # React entry — mounts <App /> to #root
    ├── App.jsx             # Main React component — all UI (829 lines)
    └── index.css           # Global CSS — design system, all styling (690 lines)
```

---

## 4. Running the Project

```bash
# Install dependencies (first time only)
npm install

# Start BOTH server (port 5000) + client (port 3000) concurrently
npm run dev

# Or start them separately:
npm run server    # node server.js  ->  http://localhost:5000
npm run client    # vite            ->  http://localhost:3000

# Production build
npm run build
```

**Dev URLs:**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Vite proxy: All `/api/*` requests from port 3000 are forwarded to port 5000

---

## 5. Backend — server.js

### Architecture
- Express.js server using ES Modules (`"type": "module"` in package.json)
- **In-memory cache** (5-minute TTL) keyed by a `Map` — no Redis/DB needed
- Custom `User-Agent` header on all Yahoo Finance fetches to avoid bot blocking
- All indicator math is imported from `analysis.js`

### Timeframe Mapping
| Param | Range |
|-------|-------|
| `1M` | 1 month back |
| `3M` | 3 months back |
| `6M` | 6 months back |
| `1Y` | 1 year back (default) |
| `3Y` | 3 years back |
| `5Y` | 5 years back |
| `MAX` | 12 years back |

---

### API Endpoint 1 — Index Data
**`GET /api/index-data/:index?timeframe=1Y`**

Full historical data + technical indicators for one index.

- **Path params:** `index` = `nifty50` | `banknifty` | `sensex`
- **Query params:** `timeframe` (see table above, default: `1Y`)
- **Cache key:** `data-{index}-{timeframe}`

**How it works:**
1. Fetches 300-day buffered history (to warm up SMA 200 lookback)
2. Computes on full buffered series: SMA(20), SMA(50), SMA(200), EMA(20), EMA(50), RSI(14), MACD(12/26/9), Bollinger Bands(20, 2)
3. Slices enriched candles back to the requested timeframe start date
4. Fetches live quote via `yahooFinance.quote()` — falls back to last candle if this fails
5. Computes: period return %, annualized volatility, drawdown timeline, max/current drawdown
6. Computes: Classic/Fibonacci/Camarilla pivot points from last candle
7. Detects candlestick patterns in last 10 sessions
8. Appends Friday-to-Tuesday weekend analysis

**Response shape:**
```js
{
  indexName: "Nifty 50",
  symbol: "^NSEI",
  quote: {
    price, change, changePercent,
    open, dayHigh, dayLow, prevClose, volume,
    fiftyTwoWeekHigh, fiftyTwoWeekLow
  },
  stats: {
    periodReturn,         // % return over selected timeframe
    annualizedVolatility, // annualized std dev of daily returns (%)
    maxDrawdown,          // absolute value (positive %)
    currentDrawdown,      // absolute value (positive %)
    pivots: {
      classic:   { p, r1, s1, r2, s2, r3, s3 },
      fibonacci: { p, r1, s1, r2, s2, r3, s3 },
      camarilla: { p, r1, s1, r2, s2, r3, s3, r4, s4 }
    },
    patterns: [{ date, pattern, type, description }]
  },
  history: [{
    date,                  // "YYYY-MM-DD"
    open, high, low, close, volume,
    sma20, sma50, sma200,
    ema20, ema50,
    rsi,
    macd, macdSignal, macdHist,
    bbUpper, bbMiddle, bbLower,
    drawdown               // % drawdown from peak at this date (negative number)
  }],
  weekendAnalysis: {
    pairs: [{ fridayDate, fridayClose, tuesdayDate, tuesdayClose, pointsMoved, pctMoved, direction, fridayDay, tuesdayDay }],
    summary: { totalWeeks, upWeeks, downWeeks, winRate, avgPoints, avgAbsPoints, avgPct, maxGain, maxLoss, currentStreak, streakDirection, monthlyBreakdown }
  },
  tuesdayThursdayAnalysis: {
    pairs: [{ tuesdayDate, tuesdayClose, thursdayDate, thursdayClose, pointsMoved, pctMoved, direction, tuesdayDay, thursdayDay }],
    summary: { totalWeeks, upWeeks, downWeeks, winRate, avgPoints, avgAbsPoints, avgPct, maxGain, maxLoss, currentStreak, streakDirection, monthlyBreakdown }
  }
}
```

---

### API Endpoint 2 — Correlation Matrix
**`GET /api/correlation?timeframe=1Y`**

Pearson correlation matrix between all 3 indices using daily returns.
- **Cache key:** `correlation-{timeframe}`

**Response:**
```js
{
  labels: ["Nifty 50", "Bank Nifty", "Sensex"],
  matrix: [
    [1, nifty_bank, nifty_sensex],
    [nifty_bank, 1, bank_sensex],
    [nifty_sensex, bank_sensex, 1]
  ],
  sampleSize: 252  // number of aligned trading days used
}
```

---

### API Endpoint 3 — Monthly Returns Heatmap
**`GET /api/monthly-returns/:index`**

Monthly return grid for last 10 years. Always fetches 10 years regardless of timeframe.
- **Cache key:** `monthly-returns-{index}`

**Response:** Array of year rows (descending, most recent first):
```js
[
  {
    year: 2026,
    0: 2.5,    // Jan return %
    1: -1.2,   // Feb return %
    ...
    11: null,  // Dec — null means no data (future month)
    yearlyTotal: 14.2
  },
  ...
]
```
- Month return = `(lastCandle.close - firstCandle.open) / firstCandle.open * 100`
- Year total = `(yearLastCandle.close - yearFirstCandle.open) / yearFirstCandle.open * 100`

---

### API Endpoint 4 — Market Insights
**`GET /api/insights`**

Aggregate instant scan across all 3 indices. Fetches 1Y + 300-day buffer each.
- **Cache key:** `insights`

**Trend classification logic (per index):**
- `Strong Bullish` — `price > sma50 > sma200`
- `Mild Bullish / Consolidation` — `price > sma200` but `price < sma50`
- `Strong Bearish` — `price < sma50 < sma200`
- `Mild Bearish / Reversal` — `price < sma200` but `price > sma50`
- `Neutral` — otherwise

**Momentum classification (RSI-based):**
- RSI > 70 → `Overbought (Extended)`
- RSI < 30 → `Oversold (Value)`
- RSI > 55 → `Bullish Momentum`
- RSI < 45 → `Bearish Momentum`
- else → `Normal`

**Response:**
```js
{
  indices: [{
    index,             // "nifty50" | "banknifty" | "sensex"
    name,              // "Nifty 50" etc.
    price,
    changePercent,
    rsi,
    trend,             // see classification above
    momentum,          // see classification above
    patterns           // last 2 detected candlestick patterns
  }],
  timestamp: "ISO string",
  commentary: "Generated text summary of market conditions"
}
```

**Commentary generation logic (`compileGlobalCommentary`):**
- Count bullish indices (0, 1–2, or 3)
- Append overbought/oversold warnings by index name
- Always ends with pivot monitoring note

---

### API Endpoint 5 — Friday→Tuesday Analysis
**`GET /api/friday-tuesday/:index`**

Dedicated weekend return analysis using 5 years of data for robust sample size.
- **Cache key:** `friday-tuesday-{index}`

**Response:**
```js
{
  indexName, symbol,
  pairs: [{
    fridayDate, fridayClose,
    tuesdayDate, tuesdayClose,
    pointsMoved, pctMoved,
    direction: "UP" | "DOWN",
    fridayDay,   // "Friday" or "Thursday" (if holiday fallback was used)
    tuesdayDay   // "Tuesday", "Monday", or "Wednesday" (fallback)
  }],
  summary: {
    totalWeeks, upWeeks, downWeeks,
    winRate,           // % of up weeks
    avgPoints,         // average signed points moved
    avgAbsPoints,      // average absolute magnitude
    avgPct,            // average signed % moved
    maxGain: { ...pair },   // best performing week
    maxLoss: { ...pair },   // worst performing week
    currentStreak,
    streakDirection: "UP" | "DOWN",
    monthlyBreakdown: [{ month, winRate, count, up, down }]
  }
}
```

---

### API Endpoint 6 — Tuesday→Thursday Analysis
**`GET /api/tuesday-thursday/:index`**

Dedicated midweek return analysis using 5 years of data for robust sample size.
- **Cache key:** `tuesday-thursday-{index}`

**Response:** Similar structure to Friday→Tuesday with Tuesday close date and Thursday close date.

---

### Caching
```js
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in ms
// Cache is an in-memory Map — cleared on server restart
// Cache keys:
//   data-{index}-{timeframe}
//   correlation-{timeframe}
//   monthly-returns-{index}
//   insights
//   friday-tuesday-{index}
//   tuesday-thursday-{index}
```

---

## 6. Analysis Engine — analysis.js

Pure ES Module, zero external dependencies. All functions exported.

### Function Reference

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `calculateSMA` | `(prices, period)` | `number[]` (nulls for warmup) | Sliding window |
| `calculateEMA` | `(prices, period)` | `number[]` (nulls for warmup) | Seeds from first SMA, then smoothing factor k = 2/(period+1) |
| `calculateRSI` | `(prices, period=14)` | `number[]` | Wilder's smoothing method |
| `calculateMACD` | `(prices, short=12, long=26, signal=9)` | `{ macdLine, signalLine, histogram }` | MACD = EMA12 - EMA26; Signal = EMA9 of MACD |
| `calculateBollingerBands` | `(prices, period=20, multiplier=2)` | `{ upperBand, middleBand, lowerBand }` | StdDev calculated on each rolling window |
| `calculatePivotPoints` | `(high, low, close)` | `{ classic, fibonacci, camarilla }` | Based on last completed daily candle |
| `calculateCorrelation` | `(x, y)` | `number` (-1 to 1) | Pearson correlation coefficient |
| `calculateDrawdown` | `(prices)` | `{ drawdowns, maxDrawdown, currentDrawdown }` | maxDrawdown and currentDrawdown are absolute (positive) values |
| `detectCandlestickPatterns` | `(candles, count=5)` | `Array<{ date, pattern, type, description }>` | Scans last `count` candles |
| `calculateFridayTuesdayAnalysis` | `(candles)` | `{ pairs, summary }` | Candles must be sorted ascending by date |
| `calculateTuesdayThursdayAnalysis` | `(candles)` | `{ pairs, summary }` | Candles must be sorted ascending by date |

### Pivot Point Formulas
**Classic:**
- P = (High + Low + Close) / 3
- R1 = 2P - Low, S1 = 2P - High
- R2 = P + (High - Low), S2 = P - (High - Low)
- R3 = High + 2*(P - Low), S3 = Low - 2*(High - P)

**Fibonacci:**
- R1 = P + 0.382*(High-Low), R2 = P + 0.618*(High-Low), R3 = P + 1.000*(High-Low)
- S1 = P - 0.382*(High-Low), S2 = P - 0.618*(High-Low), S3 = P - 1.000*(High-Low)

**Camarilla:**
- diff = High - Low
- R1 = Close + diff*1.1/12, R2 = Close + diff*1.1/6, R3 = Close + diff*1.1/4, R4 = Close + diff*1.1/2
- S1 = Close - diff*1.1/12, S2 = Close - diff*1.1/6, S3 = Close - diff*1.1/4, S4 = Close - diff*1.1/2

### Candlestick Pattern Detection Rules
| Pattern | Conditions |
|---------|-----------|
| Doji | `body <= range * 0.1` |
| Hammer | `lowerShadow >= body*2` AND `upperShadow <= range*0.1` AND `body > avgBody*0.3` |
| Inverted Hammer | `upperShadow >= body*2` AND `lowerShadow <= range*0.1` AND `body > avgBody*0.3` |
| Shooting Star | Same as Inverted Hammer but candle is bearish (`close < open`) |
| Bullish Engulfing | prev bearish + curr bullish + `open < prev.close` + `close > prev.open` |
| Bearish Engulfing | prev bullish + curr bearish + `open > prev.close` + `close < prev.open` |

*`avgBody` = mean absolute body size across entire candle series*

### Friday-Tuesday Holiday Fallbacks
- **Friday holiday:** If Friday is missing from exchange data, use Thursday if the next available candle is ≥ 3 calendar days away
- **Tuesday holiday:** Accept Monday (1), Wednesday (3, only within 6 days), or Tuesday (2) — Tuesday is preferred
- **Duplicate prevention:** Uses ISO week key (`{year}-W{isoWeek}`) to skip already-processed weeks

### Tuesday-Thursday Holiday Fallbacks
- **Tuesday holiday:** If Tuesday is missing, use Wednesday if previous trading candle was ≥ 2 calendar days away
- **Thursday holiday:** Accept Friday (5) as fallback if Thursday was holiday
- **Duplicate prevention:** Uses ISO week key (`{year}-W{isoWeek}`) to skip already-processed weeks

---

## 7. Frontend — src/App.jsx

Single-component React app. Uses only `useState` + `useEffect` — no Redux, Context, or external state library.

### State Variables
```js
// UI Control State
const [activeIndex, setActiveIndex] = useState('nifty50');     // 'nifty50' | 'banknifty' | 'sensex'
const [timeframe, setTimeframe] = useState('1Y');               // '1M'|'3M'|'6M'|'1Y'|'3Y'|'5Y'|'MAX'
const [activeTab, setActiveTab] = useState('charts');           // 'charts'|'analytics'|'scanner'|'dayReports'

// Chart Overlay Toggles
const [showSMA20, setShowSMA20] = useState(true);
const [showSMA50, setShowSMA50] = useState(false);
const [showSMA200, setShowSMA200] = useState(false);
const [showBB, setShowBB] = useState(false);

// API Data State
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [indexData, setIndexData] = useState(null);               // From /api/index-data/:index
const [correlationData, setCorrelationData] = useState(null);   // From /api/correlation
const [heatmapData, setHeatmapData] = useState(null);           // From /api/monthly-returns/:index
const [insightsData, setInsightsData] = useState(null);         // From /api/insights
const [fridayTuesdayReport, setFridayTuesdayReport] = useState(null); // From /api/friday-tuesday/:index
const [tuesdayThursdayReport, setTuesdayThursdayReport] = useState(null); // From /api/tuesday-thursday/:index
const [ftIndex, setFtIndex] = useState('nifty50');
const [ttIndex, setTtIndex] = useState('sensex');

const [lastRefreshed, setLastRefreshed] = useState(null);       // Time of last fetch
```

### useEffect Triggers
```js
// Runs whenever active index or timeframe changes
useEffect(() => {
  fetchIndexData(activeIndex, timeframe);
  fetchAnalyticsData(activeIndex, timeframe);
}, [activeIndex, timeframe]);

// Runs when custom reports configuration changes
useEffect(() => {
  fetchReportsData(ftIndex, ttIndex);
}, [ftIndex, ttIndex]);

// Runs once on component mount
useEffect(() => {
  fetchInsightsData();
}, []);
```

### Tab Content Structure
**Tab 1 — "Charts & Overlays"** (`activeTab === 'charts'`):
- `.dashboard-grid` (3fr + 1fr)
  - Left: `.chart-panel`
    - Header with chart title + overlay checkboxes (SMA20, SMA50, SMA200, Bollinger Bands)
    - Primary AreaChart (420px): close price + optional overlays
    - Volume BarChart sub-chart (150px)
  - Right: `.stats-panel`
    - Market Metrics card (price, change, OHLC, prev close)
    - Performance Analysis card (period return, vol, drawdown, 52w H/L)

**Tab 2 — "Analytics & Seasonality"** (`activeTab === 'analytics'`):
- Monthly Return Heatmap table (10 years × 13 columns including Year Total)
- Row beneath with 2-column grid:
  - Correlation Matrix 3×3 table
  - Drawdown Timeline AreaChart (240px)

**Tab 3 — "Technical Scanner"** (`activeTab === 'scanner'`):
- `.scanner-grid` (1fr + 1fr)
  - Pivot Points table (P, R1–R3, S1–S3 with formula column + price column)
  - Candlestick Pattern Alert cards list (scrollable, max-height 340px)

**Tab 4 — "Day-of-Week Reports"** (`activeTab === 'dayReports'`):
- Left Card: Friday to Tuesday Close Report (Index select dropdown, summary stats cards, recent moves table)
- Right Card: Tuesday to Thursday Close Report (Index select dropdown, summary stats cards, recent moves table)

### Recharts SVG Gradient IDs (defined inside AreaChart `<defs>`)
| ID | Used for |
|----|---------|
| `niftyGrad` | Nifty 50 area fill |
| `bankGrad` | Bank Nifty area fill |
| `sensexGrad` | Sensex area fill |
| `bbFill` | Bollinger Band shaded area |

### Color/Class Helper Functions
```js
// Returns CSS variable string for the active index
getThemeColor(index) // -> 'var(--nifty-color)' etc.

// Returns gradient ID for Recharts fill
getThemeGradient(index) // -> 'niftyGrad' | 'bankGrad' | 'sensexGrad'

// Returns CSS class for monthly return heatmap cell
getHeatmapColorClass(val)
// val > 5    -> 'cell-pos-high'
// val > 2    -> 'cell-pos-med'
// val > 0    -> 'cell-pos-low'
// val < -5   -> 'cell-neg-high'
// val < -2   -> 'cell-neg-med'
// val < 0    -> 'cell-neg-low'
// null/0     -> 'cell-neutral'

// Returns CSS class for correlation matrix cell
getCorrelationColorClass(val)
// val >= 0.8 -> 'corr-high'
// val >= 0.5 -> 'corr-med'
// else       -> 'corr-low'
```

### Number Formatting
```js
formatNumber(num, decimals = 2)
// Uses en-IN locale (Indian number system: 1,00,000 = 1 lakh)
// Returns '-' for null/undefined/NaN
```

---

## 8. Design System — src/index.css

### CSS Custom Properties (Design Tokens)
```css
:root {
  /* Background */
  --bg-main: #070b13;
  --bg-gradient: radial-gradient(circle at 50% 0%, #0d162a 0%, #060911 100%);

  /* Glass Panel */
  --glass-bg: rgba(255, 255, 255, 0.02);
  --glass-bg-hover: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.05);
  --glass-border-hover: rgba(255, 255, 255, 0.09);

  /* Text */
  --text-main: #f3f4f6;
  --text-muted: #9ca3af;
  --text-dim: #6b7280;

  /* Nifty 50 — Cyan */
  --nifty-color: #00f2fe;
  --nifty-glow: rgba(0, 242, 254, 0.15);
  --nifty-gradient: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);

  /* Bank Nifty — Purple */
  --banknifty-color: #a855f7;
  --banknifty-glow: rgba(168, 85, 247, 0.15);
  --banknifty-gradient: linear-gradient(135deg, #a855f7 0%, #d8b4fe 100%);

  /* Sensex — Orange */
  --sensex-color: #f97316;
  --sensex-glow: rgba(249, 115, 22, 0.15);
  --sensex-gradient: linear-gradient(135deg, #f97316 0%, #fdba74 100%);

  /* State Indicators */
  --color-up: #10b981;
  --color-down: #ef4444;
  --color-neutral: #eab308;
  --color-up-glow: rgba(16, 185, 129, 0.15);
  --color-down-glow: rgba(239, 68, 68, 0.15);
}
```

### Key CSS Classes Reference
| Class | Purpose | Key Properties |
|-------|---------|----------------|
| `.glass-panel` | Glassmorphism card base | backdrop-filter: blur(16px), border-radius: 16px |
| `.app-container` | Root layout wrapper | max-width: 1600px, centered, padding: 24px |
| `.header` | Top header bar | flex space-between, border-bottom |
| `.index-grid` | 3 index card grid | auto-fit, minmax(320px, 1fr) |
| `.index-card` | Individual index card | clickable, has ::after top-border accent |
| `.control-row` | Tab nav + timeframe row | flex space-between, flex-wrap |
| `.tabs-nav` | Tab buttons container | dark pill background |
| `.tab-btn` | Single tab / action button | transparent by default, white when .active |
| `.timeframe-selector` | Timeframe buttons container | dark pill, gap: 6px |
| `.timeframe-btn` | Single timeframe button | gradient when .active |
| `.dashboard-grid` | Charts tab main grid | grid-template-columns: 3fr 1fr (collapses at 1024px) |
| `.chart-panel` | Chart card container | flex column, padding: 24px |
| `.chart-container` | Recharts chart area | height: 420px |
| `.sub-chart-container` | Volume chart area | height: 150px |
| `.stats-panel` | Right sidebar | flex column, gap: 20px |
| `.stat-group-card` | Stats card | padding: 20px |
| `.stat-row` | Single stat row | flex space-between |
| `.heatmap-card` | Heatmap wrapper | padding: 24px, overflow-x: auto |
| `.heatmap-table` | Return heatmap table | min-width: 800px |
| `.scanner-grid` | Scanner tab grid | 1fr 1fr (collapses at 768px) |
| `.pivots-table` | Pivot points table | full width, JetBrains Mono cells |
| `.insights-strip` | Market commentary strip | flex, left border accent |
| `.loading-container` | Loading state center | flex column center, height: 400px |
| `.spinner` | Rotating loading indicator | 40px, cyan border-top animation |
| `.status-dot` | Live green pulsing dot | 8px circle, green glow |
| `.error-message` | Error state display | red background, centered |

### Index Card CSS Classes
```css
.index-card.nifty50     -- or -- .badge-nifty50
.index-card.banknifty   -- or -- .badge-banknifty
.index-card.sensex      -- or -- .badge-sensex

/* Active card glow states */
.index-card.active.nifty50     { box-shadow: 0 0 20px var(--nifty-glow); }
.index-card.active.banknifty   { box-shadow: 0 0 20px var(--banknifty-glow); }
.index-card.active.sensex      { box-shadow: 0 0 20px var(--sensex-glow); }
```

### Heatmap Cell Color Classes
| Class | Condition | Background | Text Color |
|-------|-----------|-----------|------------|
| `cell-pos-high` | val > 5% | `rgba(16,185,129, 0.25)` | `#34d399` |
| `cell-pos-med` | val > 2% | `rgba(16,185,129, 0.15)` | `#a7f3d0` |
| `cell-pos-low` | val > 0% | `rgba(16,185,129, 0.07)` | `#d1fae5` |
| `cell-neg-high` | val < -5% | `rgba(239,68,68, 0.25)` | `#f87171` |
| `cell-neg-med` | val < -2% | `rgba(239,68,68, 0.15)` | `#fecaca` |
| `cell-neg-low` | val < 0% | `rgba(239,68,68, 0.07)` | `#fee2e2` |
| `cell-neutral` | null/0 | `rgba(255,255,255, 0.02)` | `--text-muted` |

### CSS Animations
```css
@keyframes pulse {
  0%   { transform: scale(0.9); opacity: 0.6; }
  50%  { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.6; }
}
/* Used on: .status-dot (green live indicator) */

@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
/* Used on: .spinner (loading state) */
```

---

## 9. Vite Configuration — vite.config.js

```js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

All `/api/*` requests in the Vite dev server are transparently proxied to Express on port 5000.

---

## 10. npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `node server.js` | Production: run server only |
| `npm run server` | `node server.js` | Dev: Express backend (port 5000) |
| `npm run client` | `vite` | Dev: Vite frontend (port 3000) |
| `npm run dev` | `concurrently "npm run server" "npm run client"` | Dev: both together |
| `npm run build` | `vite build` | Production: build React to /dist |

---

## 11. Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Express server listening port |
| `NODE_ENV` | — | Set to `production` to serve built `/dist` files |

No `.env` file is required for development. To customize:
```
PORT=5000
NODE_ENV=development
```

---

## 12. Production Mode

In production (`NODE_ENV=production`), Express additionally:
1. Serves static files from `./dist` (the Vite build output)
2. Has a catch-all `GET *` route that serves `dist/index.html` (SPA fallback routing)

```bash
npm run build          # Creates ./dist
NODE_ENV=production node server.js
# Now serves both API + frontend on port 5000
```

---

## 13. Data Flow Diagram

```
Browser (localhost:3000)
    |
    |  React App (src/App.jsx)
    |  useEffect triggers fetch on index/timeframe change
    |
    +-- GET /api/index-data/:index?timeframe= ----------+
    +-- GET /api/correlation?timeframe=                 |
    +-- GET /api/monthly-returns/:index                 |  Vite proxy
    +-- GET /api/insights                               |  -> localhost:5000
    +-- GET /api/friday-tuesday/:index -----------------+
                                                        |
                                          Express (server.js)
                                                        |
                                          In-Memory Cache
                                          (Map, 5-min TTL)
                                                        |
                                          analysis.js
                                          (pure math, no deps)
                                                        |
                                          yahoo-finance2
                                          yahooFinance.chart()
                                          yahooFinance.quote()
                                                        |
                                          Yahoo Finance API
                                          (^NSEI, ^NSEBANK, ^BSESN)
```

---

## 14. Known Conventions

1. **ES Modules only** — All files use `import`/`export`. No `require()` anywhere.
2. **Yahoo Finance User-Agent** — All Yahoo API calls include a spoofed Chrome User-Agent to avoid 403 bot blocks.
3. **Quote fallback pattern** — Every `yahooFinance.quote()` call is wrapped in try/catch; failure constructs a synthetic quote from historical data.
4. **300-day warmup buffer** — Historical fetches always go 300 days before requested start to ensure SMA 200 has enough data.
5. **Number locale** — `en-IN` (Indian number system) used throughout via `formatNumber()`.
6. **Month indexing** — Monthly return data uses 0-indexed months (Jan=0, Dec=11).
7. **Sorted ascending** — All history arrays and candle arrays are sorted ascending by date before processing.
8. **Drawdown sign convention** — `maxDrawdown` and `currentDrawdown` in the API response are absolute (positive) values. Individual `drawdown` values in history candles are negative numbers (peak-to-trough decline).

---

## 15. Extension Guide — How to Add Features

### Adding a New Index
1. Add to `INDEX_SYMBOLS` and `INDEX_NAMES` objects in `server.js`
2. Add CSS custom properties in `:root` in `index.css` (`--newindex-color`, `--newindex-glow`, `--newindex-gradient`)
3. Add case to `getThemeColor()` and `getThemeGradient()` in `App.jsx`
4. Add badge and active card CSS rules in `index.css`
5. Add SVG gradient `<linearGradient>` in the `<defs>` block of AreaChart in `App.jsx`

### Adding a New Technical Indicator
1. Add pure calculation function to `analysis.js` and export it
2. Import the function in `server.js`
3. Call it in `/api/index-data/:index` handler and include result in `enrichedHistory`
4. Add toggle state in `App.jsx`: `const [showNew, setShowNew] = useState(false)`
5. Add checkbox label in chart controls UI
6. Add `<Line>` or `<Area>` inside AreaChart, conditionally rendered: `{showNew && <Line dataKey="newField" ... />}`

### Adding a New API Endpoint
1. Create Express route in `server.js` following the pattern:
   ```js
   app.get('/api/new-endpoint/:param', async (req, res) => {
     const cacheKey = `new-${param}`;
     const cached = getCache(cacheKey);
     if (cached) return res.json(cached);
     // ... compute data ...
     setCache(cacheKey, result);
     res.json(result);
   });
   ```
2. Add fetch function in `App.jsx` and state variable
3. Call in appropriate `useEffect` or `handleRefresh`

### Adding a New Dashboard Tab
1. Add tab button in `.tabs-nav` in `App.jsx`
2. Add new tab name to the `activeTab` values
3. Wrap new tab content: `{activeTab === 'newtab' && (...JSX...)}`
4. Add any required API fetch for the tab's data needs

---

## 16. Not Yet Implemented (Data Available but No UI)

These features have **backend data already computed** but no frontend rendering:

| Data | Where in API | Suggested Feature |
|------|-------------|-----------------|
| `ema20`, `ema50` | In `history[]` candles | Chart overlay toggles for EMA lines |
| `macd`, `macdSignal`, `macdHist` | In `history[]` candles | MACD sub-chart panel |
| `rsi` | In `history[]` candles | RSI chart panel with 30/70 reference lines |
| `bbMiddle` | In `history[]` candles | Middle Bollinger Band line (already upper/lower render) |
| `stats.pivots.fibonacci` | In `/api/index-data/:index` response | Fibonacci Pivot tab in scanner |
| `stats.pivots.camarilla` | In `/api/index-data/:index` response | Camarilla Pivot tab in scanner |

---

## 17. Potential Enhancements (Ideas)

- [ ] Candlestick (OHLC) chart — replace area chart with `lightweight-charts` (TradingView)
- [ ] Weekend Analysis tab — render `weekendAnalysis` data from existing backend endpoint
- [ ] EMA overlay lines — data is in history, just needs UI toggle + `<Line>` components
- [ ] MACD sub-chart — histogram bar chart below main price chart
- [ ] RSI sub-chart — line chart with 30/70 overbought/oversold reference lines
- [ ] Fibonacci + Camarilla pivot tables in Technical Scanner tab
- [ ] Multi-index comparison view — overlay all 3 indices on normalized chart
- [ ] Alert system — browser notification when RSI crosses threshold
- [ ] CSV export — download historical data as CSV file
- [ ] Light mode toggle — currently forced dark only
- [ ] Mobile UX improvements — breakpoints exist but mobile experience needs polish
- [ ] WebSocket live ticks — replace 5-min cache polling with real-time price streaming
- [ ] Date range picker — allow custom start/end date selection instead of preset timeframes

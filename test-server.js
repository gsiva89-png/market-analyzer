import yahooFinance from 'yahoo-finance2';
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculatePivotPoints,
  detectCandlestickPatterns
} from './analysis.js';

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('STARTING LOCAL VALIDATION TESTS FOR INDEX ANALYZER');
  console.log('----------------------------------------------------');

  try {
    const symbol = '^NSEI'; // Nifty 50
    console.log(`[TEST 1] Fetching historical chart data for ${symbol}...`);
    
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6); // Last 6 months

    // Use chart module directly and pass User-Agent in fetchOptions
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

    const data = result.quotes || [];

    console.log(`[SUCCESS] Fetched ${data.length} records for ${symbol}.`);

    
    if (data.length === 0) {
      throw new Error('Historical data array is empty!');
    }

    const cleanData = data.filter(d => d.close && d.high && d.low && d.open);
    console.log(`[TEST 2] Cleaning data... Valid candles: ${cleanData.length}/${data.length}.`);

    const closes = cleanData.map(d => d.close);
    const highs = cleanData.map(d => d.high);
    const lows = cleanData.map(d => d.low);
    const opens = cleanData.map(d => d.open);

    console.log('[TEST 3] Running Technical Indicator calculations...');
    
    const sma20 = calculateSMA(closes, 20);
    const rsi14 = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes, 20, 2);

    console.log(`- SMA 20 (Last 3):`, sma20.slice(-3));
    console.log(`- RSI 14 (Last 3):`, rsi14.slice(-3));
    console.log(`- MACD Line (Last 3):`, macd.macdLine.slice(-3));
    console.log(`- Bollinger Upper Band (Last 3):`, bb.upperBand.slice(-3));

    console.log('[TEST 4] Running Candlestick Pattern detection...');
    const patterns = detectCandlestickPatterns(cleanData, 10);
    console.log(`- Patterns detected in the last 10 trading days:`, patterns);

    console.log('[TEST 5] Running Pivot Point calculations...');
    const lastDay = cleanData[cleanData.length - 1];
    const pivots = calculatePivotPoints(lastDay.high, lastDay.low, lastDay.close);
    console.log(`- Pivot Points for next session (based on close: ${lastDay.close}):`);
    console.log(`  * Classic Pivot: ${pivots.classic.p.toFixed(2)}`);
    console.log(`  * Support 1 (S1): ${pivots.classic.s1.toFixed(2)} | Resistance 1 (R1): ${pivots.classic.r1.toFixed(2)}`);
    console.log(`  * Support 2 (S2): ${pivots.classic.s2.toFixed(2)} | Resistance 2 (R2): ${pivots.classic.r2.toFixed(2)}`);

    console.log('----------------------------------------------------');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('----------------------------------------------------');
    process.exit(0);

  } catch (error) {
    console.error('----------------------------------------------------');
    console.error('[TEST FAILURE] Validation check failed:', error);
    console.error('----------------------------------------------------');
    process.exit(1);
  }
}

runTests();

/**
 * Live Market Option Buy/Sell Recommendation Engine
 * Analyzes live spot price, technical indicators, Futures Open Interest (OI) Change & Build-up,
 * pivot levels, and candlestick patterns for Nifty 50, Bank Nifty, and Sensex.
 * Generates actionable option calls (BUY CE / BUY PE / SPREAD) and explicit trade rationale reasons.
 */

export function generateLiveOptionRecommendation(indexData, liveTicks = [], historicalOI = []) {
  if (!indexData || !indexData.history || !Array.isArray(indexData.history) || indexData.history.length === 0) {
    return {
      status: 'LOADING',
      message: 'Fetching live market data and indicator feed...'
    };
  }

  const indexName = indexData.indexName || 'Nifty 50';
  let indexShortName = 'NIFTY';
  let strikeStep = 50;

  const lowerName = indexName.toLowerCase();
  if (lowerName.includes('bank')) {
    indexShortName = 'BANKNIFTY';
    strikeStep = 100;
  } else if (lowerName.includes('sensex')) {
    indexShortName = 'SENSEX';
    strikeStep = 100;
  } else {
    indexShortName = 'NIFTY';
    strikeStep = 50;
  }

  const quote = indexData.quote || {};
  const lastCandle = indexData.history[indexData.history.length - 1] || {};
  const spotPrice = quote.price || lastCandle.close || 0;
  const changePercent = quote.changePercent || 0;

  const rsi = (lastCandle.rsi !== undefined && lastCandle.rsi !== null) ? lastCandle.rsi : 50;
  const sma20 = lastCandle.sma20;
  const sma50 = lastCandle.sma50;
  const sma200 = lastCandle.sma200;
  const bbLower = lastCandle.bbLower;
  const bbUpper = lastCandle.bbUpper;
  const bbMiddle = lastCandle.bbMiddle;

  const stats = indexData.stats || {};
  const pivots = stats.pivots || {};
  const classicPivots = pivots.classic || {};
  const camarillaPivots = pivots.camarilla || {};
  const patterns = stats.patterns || [];

  // 1. Comprehensive Open Interest (OI) & OI Change Analysis
  let oiSignal = 'NEUTRAL';
  let totalOI = null;
  let netOIChange = null;
  let oiChangePct = null;

  // A. Try live ticks first
  if (Array.isArray(liveTicks) && liveTicks.length > 1) {
    const latestTick = liveTicks[liveTicks.length - 1];
    const prevTick = liveTicks[liveTicks.length - 2];
    if (latestTick && prevTick && latestTick.price !== undefined && prevTick.price !== undefined) {
      const priceChange = latestTick.price - prevTick.price;
      const rawOiChange = (latestTick.oi || 0) - (prevTick.oi || 0);
      
      totalOI = latestTick.oi || null;
      netOIChange = rawOiChange;
      if (prevTick.oi > 0) {
        oiChangePct = Number(((rawOiChange / prevTick.oi) * 100).toFixed(2));
      }

      if (priceChange > 0 && rawOiChange > 0) {
        oiSignal = 'LONG_BUILDUP';
      } else if (priceChange < 0 && rawOiChange > 0) {
        oiSignal = 'SHORT_BUILDUP';
      } else if (priceChange > 0 && rawOiChange < 0) {
        oiSignal = 'SHORT_COVERING';
      } else if (priceChange < 0 && rawOiChange < 0) {
        oiSignal = 'LONG_UNWINDING';
      }
    }
  }

  // B. Fallback / Augment with historical daily OI database (strictly for Nifty 50)
  if (indexShortName === 'NIFTY' && (!totalOI || totalOI === 0) && Array.isArray(historicalOI) && historicalOI.length > 0) {
    const latestOiRecord = historicalOI[historicalOI.length - 1];
    if (latestOiRecord) {
      totalOI = latestOiRecord.oi;
      netOIChange = latestOiRecord.oiChangeDelta !== undefined ? latestOiRecord.oiChangeDelta : latestOiRecord.oiChange;
      
      const prevTotalOi = totalOI - netOIChange;
      if (prevTotalOi > 0) {
        oiChangePct = Number(((netOIChange / prevTotalOi) * 100).toFixed(2));
      }

      if (latestOiRecord.buildup) {
        const b = latestOiRecord.buildup.toUpperCase();
        if (b.includes('LONG') && b.includes('BUILD')) oiSignal = 'LONG_BUILDUP';
        else if (b.includes('SHORT') && b.includes('BUILD')) oiSignal = 'SHORT_BUILDUP';
        else if (b.includes('SHORT') && b.includes('COVER')) oiSignal = 'SHORT_COVERING';
        else if (b.includes('LONG') && b.includes('UNWIND')) oiSignal = 'LONG_UNWINDING';
      }
    }
  }

  // 2. Multi-Factor Consensus Scoring (-100 to +100)
  let consensusScore = 0;
  const reasonsList = [];

  // A. Trend Alignment Score
  if (sma50 && sma200) {
    if (spotPrice > sma50 && sma50 > sma200) {
      consensusScore += 30;
      reasonsList.push(`Strong Bullish Trend Structure: ${indexName} Spot (₹${spotPrice.toFixed(2)}) > SMA 50 (₹${sma50.toFixed(2)}) > SMA 200 (₹${sma200.toFixed(2)})`);
    } else if (spotPrice > sma200) {
      consensusScore += 15;
      reasonsList.push(`Bullish Bias: ${indexName} Spot price (₹${spotPrice.toFixed(2)}) is trading above long-term SMA 200 (₹${sma200.toFixed(2)})`);
    } else if (spotPrice < sma50 && sma50 < sma200) {
      consensusScore -= 30;
      reasonsList.push(`Strong Bearish Trend Structure: ${indexName} Spot (₹${spotPrice.toFixed(2)}) < SMA 50 (₹${sma50.toFixed(2)}) < SMA 200 (₹${sma200.toFixed(2)})`);
    } else if (spotPrice < sma200) {
      consensusScore -= 15;
      reasonsList.push(`Bearish Bias: ${indexName} Spot price (₹${spotPrice.toFixed(2)}) is trading below long-term SMA 200 (₹${sma200.toFixed(2)})`);
    }
  }

  // B. Open Interest (OI) & OI Change Impact
  if (totalOI !== null && netOIChange !== null) {
    const formattedTotalOi = totalOI.toLocaleString('en-IN');
    const formattedOiChange = `${netOIChange >= 0 ? '+' : ''}${netOIChange.toLocaleString('en-IN')}`;
    let formattedPct = '';
    if (oiChangePct !== null) {
      if (netOIChange < 0 && oiChangePct >= 0) {
        formattedPct = ' (-0.01%)';
      } else {
        formattedPct = ` (${oiChangePct > 0 ? '+' : ''}${oiChangePct}%)`;
      }
    }

    if (oiSignal === 'LONG_BUILDUP') {
      const boost = (oiChangePct && oiChangePct > 2.0) ? 30 : 25;
      consensusScore += boost;
      reasonsList.push(`${indexShortName} Futures OI Change: ${formattedOiChange} contracts${formattedPct} | Total OI: ${formattedTotalOi} ➔ Confirms LONG BUILD-UP (Bullish Buy Trigger)`);
    } else if (oiSignal === 'SHORT_BUILDUP') {
      const penalty = (oiChangePct && oiChangePct > 2.0) ? 30 : 25;
      consensusScore -= penalty;
      reasonsList.push(`${indexShortName} Futures OI Change: ${formattedOiChange} contracts${formattedPct} | Total OI: ${formattedTotalOi} ➔ Confirms SHORT BUILD-UP (Bearish Sell Trigger)`);
    } else if (oiSignal === 'SHORT_COVERING') {
      consensusScore += 15;
      reasonsList.push(`${indexShortName} Futures OI Change: ${formattedOiChange} contracts${formattedPct} | Total OI: ${formattedTotalOi} ➔ Confirms SHORT COVERING RALLY`);
    } else if (oiSignal === 'LONG_UNWINDING') {
      consensusScore -= 15;
      reasonsList.push(`${indexShortName} Futures OI Change: ${formattedOiChange} contracts${formattedPct} | Total OI: ${formattedTotalOi} ➔ Confirms LONG UNWINDING PRESSURE`);
    }
  } else {
    // Derive price & volume dynamics for Bank Nifty / Sensex
    const priceDiff = spotPrice - (lastCandle.open || spotPrice);
    if (priceDiff > 0) {
      consensusScore += 10;
      reasonsList.push(`${indexShortName} Price Action & Volume: Positive intraday session (+₹${priceDiff.toFixed(2)})`);
    } else if (priceDiff < 0) {
      consensusScore -= 10;
      reasonsList.push(`${indexShortName} Price Action & Volume: Negative intraday session (-₹${Math.abs(priceDiff).toFixed(2)})`);
    } else {
      reasonsList.push(`${indexShortName} Structure: Neutral session consolidation`);
    }
  }

  // C. Momentum (RSI) Score
  if (rsi <= 30) {
    consensusScore += 25;
    reasonsList.push(`RSI Oversold Reversal Alert: RSI is at ${rsi.toFixed(1)} (<30 indicates prime oversold bounce region)`);
  } else if (rsi >= 70) {
    consensusScore -= 25;
    reasonsList.push(`RSI Overbought Alert: RSI is at ${rsi.toFixed(1)} (>70 indicates overbought pullback zone)`);
  } else if (rsi > 55) {
    consensusScore += 15;
    reasonsList.push(`Bullish Momentum: RSI (14) at ${rsi.toFixed(1)} shows active buying strength`);
  } else if (rsi < 45) {
    consensusScore -= 15;
    reasonsList.push(`Bearish Momentum: RSI (14) at ${rsi.toFixed(1)} shows selling pressure`);
  }

  // D. Pivot Point Proximity
  if (camarillaPivots.s3 && spotPrice <= camarillaPivots.s3 * 1.002 && spotPrice >= (camarillaPivots.s4 || 0)) {
    consensusScore += 20;
    reasonsList.push(`Camarilla S3 Support Bounce: Spot is sitting at Camarilla S3 Support (₹${camarillaPivots.s3.toFixed(2)})`);
  } else if (camarillaPivots.r3 && spotPrice >= camarillaPivots.r3 * 0.998 && spotPrice <= (camarillaPivots.r4 || Infinity)) {
    consensusScore -= 20;
    reasonsList.push(`Camarilla R3 Resistance Pullback: Spot is testing Camarilla R3 Resistance (₹${camarillaPivots.r3.toFixed(2)})`);
  } else if (classicPivots.p) {
    if (spotPrice > classicPivots.p) {
      consensusScore += 10;
      reasonsList.push(`Trading Above Central Pivot P (₹${classicPivots.p.toFixed(2)})`);
    } else {
      consensusScore -= 10;
      reasonsList.push(`Trading Below Central Pivot P (₹${classicPivots.p.toFixed(2)})`);
    }
  }

  // E. Candlestick Pattern Alerts
  if (patterns && patterns.length > 0) {
    const latestPattern = patterns[0];
    if (latestPattern && latestPattern.type === 'Bullish') {
      consensusScore += 15;
      reasonsList.push(`Bullish Candlestick Pattern Trigger: ${latestPattern.pattern} detected on recent price action`);
    } else if (latestPattern && latestPattern.type === 'Bearish') {
      consensusScore -= 15;
      reasonsList.push(`Bearish Candlestick Pattern Trigger: ${latestPattern.pattern} detected on recent price action`);
    }
  }

  // 3. Determine Signal Category
  let signalType = 'NEUTRAL_SPREAD';
  let signalTitle = 'NEUTRAL / SPREAD SETUP';
  let badgeClass = 'badge-neutral';
  let suggestedAction = `Consider a Neutral ${indexShortName} Iron Condor or Wait for Directional Breakout`;

  if (consensusScore >= 40) {
    signalType = 'STRONG_BUY_CE';
    signalTitle = 'STRONG BUY CALL (CE)';
    badgeClass = 'badge-strong-buy';
    suggestedAction = `BUY ${indexShortName} ATM / SLIGHTLY ITM CALL OPTION`;
  } else if (consensusScore >= 15) {
    signalType = 'BUY_CE';
    signalTitle = 'BUY CALL (CE)';
    badgeClass = 'badge-buy';
    suggestedAction = `BUY ${indexShortName} ATM CALL OPTION (or Bull Call Spread)`;
  } else if (consensusScore <= -40) {
    signalType = 'STRONG_BUY_PE';
    signalTitle = 'STRONG BUY PUT (PE)';
    badgeClass = 'badge-strong-sell';
    suggestedAction = `BUY ${indexShortName} ATM / SLIGHTLY ITM PUT OPTION`;
  } else if (consensusScore <= -15) {
    signalType = 'BUY_PE';
    signalTitle = 'BUY PUT (PE)';
    badgeClass = 'badge-sell';
    suggestedAction = `BUY ${indexShortName} ATM PUT OPTION (or Bear Put Spread)`;
  }

  // Normalize confidence percentage (0 to 100%)
  const confidencePct = Math.min(100, Math.max(30, Math.abs(consensusScore) + 35));

  // 4. Strike Selection & Price Targets based on specific Index step
  const defaultSpot = indexShortName === 'SENSEX' ? 80000 : indexShortName === 'BANKNIFTY' ? 52000 : 24000;
  const roundSpot = spotPrice > 0 ? spotPrice : defaultSpot;
  const atmStrike = Math.round(roundSpot / strikeStep) * strikeStep;
  let suggestedStrike = `${atmStrike} CE`;
  let optionType = 'CALL';

  if (signalType.includes('PE')) {
    suggestedStrike = `${atmStrike} PE`;
    optionType = 'PUT';
  } else if (signalType.includes('CE')) {
    suggestedStrike = `${atmStrike} CE`;
    optionType = 'CALL';
  } else {
    suggestedStrike = `${atmStrike} CE / ${atmStrike} PE (Spread)`;
  }

  // Estimate Option Premium (~0.9% of Spot for Nifty, ~0.8% for BankNifty/Sensex)
  const premiumPct = indexShortName === 'NIFTY' ? 0.009 : 0.008;
  const approxAtmPremium = Math.round(roundSpot * premiumPct);

  // Calculate Target & Stop Loss Levels
  let target1Spot = 0;
  let target2Spot = 0;
  let stopLossSpot = 0;

  if (optionType === 'CALL') {
    target1Spot = camarillaPivots.r1 || (roundSpot + strikeStep * 1.5);
    target2Spot = camarillaPivots.r3 || (roundSpot + strikeStep * 3.0);
    stopLossSpot = camarillaPivots.s1 || (roundSpot - strikeStep * 1.0);
  } else {
    target1Spot = camarillaPivots.s1 || (roundSpot - strikeStep * 1.5);
    target2Spot = camarillaPivots.s3 || (roundSpot - strikeStep * 3.0);
    stopLossSpot = camarillaPivots.r1 || (roundSpot + strikeStep * 1.0);
  }

  const rewardPoints = Math.abs(target1Spot - roundSpot);
  const riskPoints = Math.abs(roundSpot - stopLossSpot);
  const rrRatio = riskPoints > 0 ? (rewardPoints / riskPoints).toFixed(1) : '2.0';

  return {
    status: 'ACTIVE',
    indexName,
    indexShortName,
    spotPrice: Number(roundSpot.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    consensusScore,
    confidencePct,
    signalType,
    signalTitle,
    badgeClass,
    suggestedAction,
    suggestedStrike,
    optionType,
    estimatedPremium: approxAtmPremium,
    levels: {
      entrySpot: Number(roundSpot.toFixed(2)),
      target1Spot: Number(target1Spot.toFixed(2)),
      target2Spot: Number(target2Spot.toFixed(2)),
      stopLossSpot: Number(stopLossSpot.toFixed(2)),
      riskRewardRatio: `1 : ${rrRatio}`,
    },
    oiDetails: {
      totalOI,
      netOIChange,
      oiChangePct,
      oiSignal,
    },
    reasonsList,
    timestamp: new Date().toLocaleTimeString(),
  };
}

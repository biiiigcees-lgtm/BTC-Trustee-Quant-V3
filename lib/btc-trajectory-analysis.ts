/**
 * BTC Trajectory Analysis — combined engine
 *
 * Exports:
 *  • BTCTrajectoryAnalyzer   — real-time 4-model scorer (instant, no API)
 *                              + static Kalshi ensemble method
 *  • KalshiIntegration       — round creation & countdown helpers
 *  • BTCDataGenerator        — mock data for UI demos / tests
 *
 * page.tsx uses:  new BTCTrajectoryAnalyzer().analyze(input)
 * btc-kalshi-analysis.tsx uses: BTCTrajectoryAnalyzer.analyzeBTCMarket(...)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Real-time interfaces (used by page.tsx INSTANT READ panel)
// ─────────────────────────────────────────────────────────────────────────────

export interface TrajectoryInput {
  price: number;
  target: number;
  secondsToExpiry: number;
  closes: number[];             // price history, newest last
  rsi: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  bb: { upper: number; middle: number; lower: number; pctB: number } | null;
  ema9: number | null;
  ema21: number | null;
  atr: number | null;
  stochRsi: { k: number; d: number } | null;
  obImbalance: number | null;   // 0–1, fraction of bids
  buyDelta: number | null;      // 0–100, % buys in last 60s
  cvd5m: number;                // cumulative volume delta (can be negative)
  largeBuys: number;
  largeSells: number;
  fearGreed: { value: number; label: string } | null;
  fundingRate: number | null;
  vwap: number | null;
  marketRegime: string | null;
}

export interface TrajectoryResult {
  verdict: "ABOVE" | "BELOW" | "PASS";
  confidence: number;                          // 50–95
  grade: "S" | "A" | "B" | "C" | "PASS";     // signal quality grade
  riskLevel: "LOW" | "MEDIUM" | "HIGH";

  /** Trajectory-physics snapshot — the heart of the prediction */
  trajectory: {
    velocity5: number | null;          // $/min, 5-period average
    velocity1: number | null;          // last 1-period move ($)
    acceleration: number | null;       // change in velocity (speeding up / slowing)
    projectedPrice: number | null;     // linear projection at expiry
    projectedOutcome: "ABOVE" | "BELOW" | null;
    movesNeeded: number | null;        // how many avg-abs-moves to flip strike
    crossingRisk: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "COINFLIP";
    momentumHelping: boolean;          // is momentum aligned with current position?
  };

  priceTargets: {
    bearCase: number;
    baseCase: number;
    bullCase: number;
  };

  modelScores: {
    trajectory: number;   // –1 to +1 (NEW — highest weight)
    technical: number;
    flow: number;
    sentiment: number;
  };

  /** Mentor section */
  signals: {
    aligned: number;        // 0–4 models agreeing with verdict
    driver: string;         // which model is driving the call
    flipTrigger: string;    // what would reverse this verdict
  };

  reasoning: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Kalshi / dashboard interfaces (used by btc-kalshi-analysis.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface BTCMarketData {
  price: number;
  volume: number;
  marketCap: number;
  dominance: number;
  fearGreedIndex: number;
  timestamp: number;
  exchangeFlow: {
    inflow: number;
    outflow: number;
    netFlow: number;
  };
  onChainMetrics: {
    activeAddresses: number;
    transactionCount: number;
    hashRate: number;
    difficulty: number;
  };
  derivativesData: {
    openInterest: number;
    fundingRate: number;
    longShortRatio: number;
    liquidations: {
      long: number;
      short: number;
    };
  };
}

export interface KalshiRound {
  id: string;
  targetPrice: number;
  startTime: number;
  duration: number;         // minutes
  timeRemaining: number;    // seconds
  isActive: boolean;
  progress?: number;        // 0–1
}

export interface BTCTrajectoryPrediction {
  prediction: "ABOVE" | "BELOW" | "UNCERTAIN";
  confidence: number;       // 0–100
  reasoning: string[];
  keyFactors: {
    factor: string;
    impact: "BULLISH" | "BEARISH" | "NEUTRAL";
    weight: number;         // 0–100
  }[];
  priceTargets: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
  riskAssessment: {
    volatility: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
    liquidity: "HIGH" | "MEDIUM" | "LOW";
    marketSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  };
  timeline: {
    currentPrice: number;
    expectedPrice: number;
    priceChange: number;
    timeToDeadline: number;
  };
}

export interface BTCAnalysisResult {
  currentMarket: BTCMarketData;
  kalshiRound: KalshiRound;
  trajectoryPrediction: BTCTrajectoryPrediction;
  technicalIndicators: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number };
    volumeProfile: { vwap: number; pocs: number[] };
  };
  marketSignals: {
    momentum: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
    trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS" | "CONSOLIDATION";
    volatility: "EXPANDING" | "CONTRACTING" | "STABLE";
    liquidity: "HIGH" | "MEDIUM" | "LOW";
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BTCTrajectoryAnalyzer
//   Instance  → analyze(TrajectoryInput): TrajectoryResult   (real-time panel)
//   Static    → analyzeBTCMarket(...)                        (Kalshi dashboard)
// ─────────────────────────────────────────────────────────────────────────────

export class BTCTrajectoryAnalyzer {

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTANCE API — real-time 4-model scorer, runs in <1ms, no API call
  // ═══════════════════════════════════════════════════════════════════════════

  analyze(input: TrajectoryInput): TrajectoryResult {
    const minutesLeft    = input.secondsToExpiry / 60;
    const strikeDistDollars = Math.abs(input.price - input.target);
    const strikeGapPct   = (strikeDistDollars / input.target) * 100;
    const priceAboveStrike = input.price > input.target;

    // ── 1. TRAJECTORY PHYSICS (highest weight — this is the core) ────────────
    const traj = this.trajectoryPhysics(input, minutesLeft, strikeDistDollars, priceAboveStrike);

    // ── 2. OTHER MODELS ───────────────────────────────────────────────────────
    const techScore = this.technicalScore(input);
    const flowScore = this.flowScore(input);
    const sentScore = this.sentimentScore(input);
    const volCtx    = this.volatilityContext(input);

    // ── 3. DYNAMIC WEIGHTS — trajectory leads, flow boosts in high-vol ────────
    const w = volCtx.isHighVol
      ? { traj: 0.35, flow: 0.35, tech: 0.20, sent: 0.10 }
      : minutesLeft < 5
      ? { traj: 0.50, flow: 0.25, tech: 0.15, sent: 0.10 }
      : { traj: 0.38, flow: 0.28, tech: 0.24, sent: 0.10 };

    const combined =
      traj.score * w.traj +
      flowScore  * w.flow +
      techScore  * w.tech +
      sentScore  * w.sent;

    // ── 4. CONFIDENCE — anchored to trajectory math ───────────────────────────
    // Number of signals agreeing with the combined direction
    const allScores = [traj.score, flowScore, techScore, sentScore];
    const aligned   = allScores.filter(s => Math.abs(s) > 0.12 && Math.sign(s) === Math.sign(combined)).length;
    const alignBonus = aligned * 2.5;

    // Trajectory-anchored base (z-score driven)
    let baseConf: number;
    const z = traj.crossingZ;
    if (z >= 2.5)      baseConf = 88 + Math.min(7, (z - 2.5) * 3);
    else if (z >= 1.5) baseConf = 76 + (z - 1.5) * 12;
    else if (z >= 1.0) baseConf = 66 + (z - 1.0) * 20;
    else if (z >= 0.5) baseConf = 56 + (z - 0.5) * 20;
    else               baseConf = 50;

    const volPenalty  = volCtx.isHighVol ? 7 : volCtx.isMedVol ? 3 : 0;
    const timePenalty = minutesLeft < 3 && strikeGapPct < 0.05 ? 14 : 0;
    const rawConf     = baseConf + alignBonus - volPenalty - timePenalty;
    const confidence  = Math.round(Math.max(50, Math.min(95, rawConf)));

    // ── 5. VERDICT ────────────────────────────────────────────────────────────
    let verdict: "ABOVE" | "BELOW" | "PASS";
    const isCoinflip  = traj.crossingRisk === "COINFLIP";
    const tooClose    = strikeGapPct < 0.05 && minutesLeft < 5;
    const weakSignal  = Math.abs(combined) < 0.08;

    if (confidence < 58 || isCoinflip || tooClose || weakSignal) {
      verdict = "PASS";
    } else {
      // Trajectory projection gets veto power
      if (traj.projectedOutcome && Math.abs(traj.score) > 0.4) {
        verdict = traj.projectedOutcome;
      } else {
        verdict = combined > 0 ? "ABOVE" : "BELOW";
      }
    }

    // ── 6. GRADE ──────────────────────────────────────────────────────────────
    let grade: "S" | "A" | "B" | "C" | "PASS";
    if (verdict === "PASS") {
      grade = "PASS";
    } else if (confidence >= 87 && aligned >= 3 && z >= 2.0) {
      grade = "S";
    } else if (confidence >= 76 && aligned >= 2) {
      grade = "A";
    } else if (confidence >= 66) {
      grade = "B";
    } else {
      grade = "C";
    }

    // ── 7. RISK LEVEL ─────────────────────────────────────────────────────────
    const riskLevel: "LOW" | "MEDIUM" | "HIGH" = volCtx.isHighVol
      ? "HIGH" : volCtx.isMedVol ? "MEDIUM" : "LOW";

    // ── 8. PRICE TARGETS ─────────────────────────────────────────────────────
    const atr          = input.atr ?? input.price * 0.002;
    const expectedMove = atr * Math.sqrt(Math.max(1, minutesLeft) / 14);
    const priceTargets = {
      bearCase: input.price - expectedMove * 1.5,
      baseCase: traj.projectedPrice ?? (input.price + combined * expectedMove),
      bullCase: input.price + expectedMove * 1.5,
    };

    // ── 9. DRIVER & FLIP TRIGGER ──────────────────────────────────────────────
    const modelMap: Record<string, number> = {
      trajectory: Math.abs(traj.score),
      flow: Math.abs(flowScore),
      technical: Math.abs(techScore),
      sentiment: Math.abs(sentScore),
    };
    const driver = Object.entries(modelMap).sort((a, b) => b[1] - a[1])[0][0];
    const flipTrigger = this.buildFlipTrigger(input, driver, verdict, traj, flowScore, techScore);

    // ── 10. REASONING ─────────────────────────────────────────────────────────
    const reasoning = this.buildReasoning(
      input, traj, techScore, sentScore, flowScore, combined, volCtx, minutesLeft
    );

    return {
      verdict,
      confidence,
      grade,
      riskLevel,
      trajectory: {
        velocity5:        traj.velocity5,
        velocity1:        traj.velocity1,
        acceleration:     traj.acceleration,
        projectedPrice:   traj.projectedPrice,
        projectedOutcome: traj.projectedOutcome,
        movesNeeded:      traj.movesNeeded,
        crossingRisk:     traj.crossingRisk,
        momentumHelping:  traj.momentumHelping,
      },
      priceTargets,
      modelScores: {
        trajectory: traj.score,
        technical:  techScore,
        flow:       flowScore,
        sentiment:  sentScore,
      },
      signals: {
        aligned,
        driver,
        flipTrigger,
      },
      reasoning,
    };
  }

  // ── Trajectory physics engine ────────────────────────────────────────────────
  private trajectoryPhysics(
    input: TrajectoryInput,
    minutesLeft: number,
    strikeDistDollars: number,
    priceAboveStrike: boolean
  ) {
    const c = input.closes;

    // Velocity: $/min over last 5 periods
    const velocity5 = c.length >= 6
      ? (c.at(-1)! - c.at(-6)!) / 5
      : null;
    const velocity1 = c.length >= 2
      ? c.at(-1)! - c.at(-2)!
      : null;

    // Acceleration: change in 5-period velocity vs 5 periods ago
    let acceleration: number | null = null;
    if (c.length >= 11) {
      const vNow   = (c.at(-1)! - c.at(-6)!)  / 5;
      const vPrior = (c.at(-6)! - c.at(-11)!) / 5;
      acceleration = vNow - vPrior;
    }

    // Linear projection at expiry
    let projectedPrice:   number | null = null;
    let projectedOutcome: "ABOVE" | "BELOW" | null = null;
    if (velocity5 != null && minutesLeft > 0) {
      // Use acceleration-adjusted projection when available
      const accelAdj = acceleration != null
        ? 0.5 * acceleration * Math.min(minutesLeft, 10)  // cap accel contribution
        : 0;
      projectedPrice   = input.price + velocity5 * minutesLeft + accelAdj;
      projectedOutcome = projectedPrice > input.target ? "ABOVE" : "BELOW";
    }

    // Average absolute 1-period move (last 5 candles)
    let avgAbsMove: number | null = null;
    let movesNeeded: number | null = null;
    if (c.length >= 6) {
      const moves: number[] = [];
      for (let i = c.length - 5; i < c.length; i++) moves.push(Math.abs(c[i] - c[i - 1]));
      avgAbsMove  = moves.reduce((a, b) => a + b, 0) / moves.length;
      if (avgAbsMove > 0) movesNeeded = strikeDistDollars / avgAbsMove;
    }

    // Z-score: strike distance in ATR-expected-move units
    const atr          = input.atr ?? input.price * 0.002;
    const expectedMove = atr * Math.sqrt(Math.max(1, minutesLeft) / 14);
    const crossingZ    = expectedMove > 0 ? strikeDistDollars / expectedMove : 0;

    const crossingRisk: TrajectoryResult["trajectory"]["crossingRisk"] =
      crossingZ < 0.5  ? "COINFLIP" :
      crossingZ < 1.0  ? "HIGH"     :
      crossingZ < 1.8  ? "MODERATE" :
      crossingZ < 2.8  ? "LOW"      : "VERY_LOW";

    // Is momentum helping keep price on the right side?
    const momentumHelping = velocity5 != null
      ? (priceAboveStrike ? velocity5 >= 0 : velocity5 <= 0)
      : true;

    // Trajectory score: direction × z-score confidence, capped at ±1
    // Positive = bullish (price staying/moving ABOVE), negative = bearish
    let score = 0;
    if (projectedOutcome != null) {
      const direction = projectedOutcome === "ABOVE" ? 1 : -1;
      const zConfidence = Math.min(1, crossingZ / 2.5); // saturates at z=2.5
      score = direction * zConfidence;
    }
    // Amplify when momentum aligns with trajectory
    if (momentumHelping && Math.abs(score) > 0.1) score = Math.max(-1, Math.min(1, score * 1.2));

    // ── Mean reversion dampener ───────────────────────────────────────────
    // When RSI is at extremes and momentum is pushing further into that extreme,
    // fade the trajectory score — exhaustion / snap-back risk is elevated.
    if (input.rsi != null) {
      const bullishExhaustion = input.rsi > 75 && score > 0.2;   // overbought + up momentum
      const bearishExhaustion = input.rsi < 25 && score < -0.2;  // oversold + down momentum
      if (bullishExhaustion || bearishExhaustion) {
        // Scale dampening with RSI distance from extreme: more extreme = stronger fade
        const rsiFactor = bullishExhaustion
          ? Math.min(1, (input.rsi - 75) / 15)   // 0→1 as RSI goes 75→90
          : Math.min(1, (25 - input.rsi) / 15);  // 0→1 as RSI goes 25→10
        score *= (1 - rsiFactor * 0.45);          // max 45% dampening at extreme RSI
      }
    }

    return {
      velocity5, velocity1, acceleration,
      projectedPrice, projectedOutcome,
      movesNeeded, crossingZ, crossingRisk,
      momentumHelping, score,
    };
  }

  // ── Technical model (RSI / MACD / BB / EMA / VWAP / StochRSI) ──────────────
  private technicalScore(input: TrajectoryInput): number {
    let score = 0, weight = 0;

    if (input.rsi != null) {
      // Stronger signal at extremes; gentler linear in neutral zone
      const s =
        input.rsi > 78 ? -0.90 :
        input.rsi > 70 ? -0.55 :
        input.rsi > 60 ? -0.20 :
        input.rsi < 22 ?  0.90 :
        input.rsi < 30 ?  0.55 :
        input.rsi < 40 ?  0.20 :
        (input.rsi - 50) / 50 * 0.25;
      score += s * 1.3; weight += 1.3;
    }
    if (input.macd != null) {
      // Histogram direction + magnitude; also reward MACD line crossing zero
      const histS = Math.sign(input.macd.histogram) * Math.min(1, Math.abs(input.macd.histogram) / 40);
      const lineS = input.macd.macd > 0 ? 0.25 : -0.25;
      score += (histS * 0.75 + lineS * 0.25) * 1.1; weight += 1.1;
    }
    if (input.bb != null) {
      const pctB = input.bb.pctB;
      // Squeeze detection (tight band = coiled spring — don't fight it yet)
      const bandwidth = (input.bb.upper - input.bb.lower) / input.bb.middle;
      const isSqueeze = bandwidth < 0.01;
      const s = isSqueeze ? 0 :
        pctB > 0.95 ? -0.80 :
        pctB > 0.80 ? -0.35 :
        pctB < 0.05 ?  0.80 :
        pctB < 0.20 ?  0.35 : 0;
      score += s * 1.0; weight += 1.0;
    }
    if (input.ema9 != null && input.ema21 != null) {
      // Weight by gap size — bigger gap = stronger signal
      const gap = Math.abs(input.ema9 - input.ema21) / input.price;
      const dir = input.ema9 > input.ema21 ? 1 : -1;
      score += dir * Math.min(1, gap / 0.002) * 0.85; weight += 0.85;
    }
    if (input.vwap != null) {
      const vwapGap = (input.price - input.vwap) / input.price;
      score += Math.sign(vwapGap) * Math.min(1, Math.abs(vwapGap) / 0.003) * 0.75;
      weight += 0.75;
    }
    if (input.stochRsi != null) {
      const { k, d } = input.stochRsi;
      // Cross detection is more meaningful than absolute level
      const crossS = k > d ? 0.30 : -0.30;
      const extremeS = k > 88 ? -0.65 : k < 12 ? 0.65 : 0;
      score += (extremeS !== 0 ? extremeS : crossS) * 0.65; weight += 0.65;
    }
    return weight > 0 ? Math.max(-1, Math.min(1, score / weight)) : 0;
  }

  // ── Flow model (CVD / buy delta / whale imbalance / OB) ─────────────────────
  private flowScore(input: TrajectoryInput): number {
    let score = 0, weight = 0;

    if (input.cvd5m !== 0) {
      // Normalise at $300K — anything above that is "very strong"
      const s = Math.sign(input.cvd5m) * Math.min(1, Math.abs(input.cvd5m) / 300_000);
      score += s * 1.8; weight += 1.8;
    }
    if (input.buyDelta != null) {
      // Non-linear: 70%+ buys is much stronger than 60%
      const excess = (input.buyDelta - 50) / 50;
      const s = Math.sign(excess) * Math.min(1, Math.abs(excess) * 1.4);
      score += s * 1.3; weight += 1.3;
    }
    if (input.obImbalance != null) {
      // OB imbalance: 0.65+ bid-heavy = bullish, 0.35- ask-heavy = bearish
      const s = (input.obImbalance - 0.5) * 2.2;
      score += Math.max(-1, Math.min(1, s)) * 1.0; weight += 1.0;
    }
    const whaleNet = input.largeBuys - input.largeSells;
    if (whaleNet !== 0) {
      score += Math.sign(whaleNet) * Math.min(1, Math.abs(whaleNet) / 4) * 0.9; weight += 0.9;
    }
    return weight > 0 ? Math.max(-1, Math.min(1, score / weight)) : 0;
  }

  // ── Sentiment model (contrarian at extremes) ─────────────────────────────────
  private sentimentScore(input: TrajectoryInput): number {
    let score = 0, weight = 0;

    if (input.fearGreed != null) {
      const fng = input.fearGreed.value;
      const s =
        fng <= 15 ?  0.80 :  // extreme fear → contrarian long
        fng <= 30 ?  0.35 :
        fng >= 85 ? -0.80 :  // extreme greed → contrarian short
        fng >= 70 ? -0.35 :
        (fng - 50) / 120;    // gentle linear in middle
      score += s * 1.0; weight += 1.0;
    }
    if (input.fundingRate != null) {
      const fr = input.fundingRate;
      const s =
        fr > 0.0006  ? -0.85 :  // very longs over-leveraged
        fr > 0.0003  ? -0.45 :
        fr > 0.0001  ? -0.15 :
        fr < -0.0006 ?  0.85 :  // shorts over-leveraged = squeeze risk
        fr < -0.0003 ?  0.45 :
        fr < -0.0001 ?  0.15 : -fr * 400;
      score += s * 1.1; weight += 1.1;
    }
    return weight > 0 ? Math.max(-1, Math.min(1, score / weight)) : 0;
  }

  // ── Volatility context ────────────────────────────────────────────────────────
  private volatilityContext(input: TrajectoryInput): { isHighVol: boolean; isMedVol: boolean } {
    const atrPct  = input.atr != null ? input.atr / input.price : 0.002;
    const bbWidth = input.bb  != null ? (input.bb.upper - input.bb.lower) / input.bb.middle : 0.02;
    const isHighVol = atrPct > 0.003 || bbWidth > 0.03;
    const isMedVol  = !isHighVol && (atrPct > 0.0012 || bbWidth > 0.015);
    return { isHighVol, isMedVol };
  }

  // ── Flip trigger (mentor: what to watch) ─────────────────────────────────────
  private buildFlipTrigger(
    input: TrajectoryInput,
    driver: string,
    verdict: "ABOVE" | "BELOW" | "PASS",
    traj: ReturnType<BTCTrajectoryAnalyzer["trajectoryPhysics"]>,
    flowScore: number,
    techScore: number
  ): string {
    if (verdict === "PASS") return "Wait for momentum to commit in one direction before entering";

    if (driver === "trajectory") {
      if (traj.velocity5 != null) {
        const rev = traj.velocity5 >= 0 ? "drops below" : "pushes above";
        const vAbs = Math.abs(traj.velocity5);
        return `If velocity reverses (currently ${traj.velocity5 >= 0 ? "+" : ""}$${vAbs.toFixed(1)}/min) and price ${rev} $${input.target.toLocaleString("en-US", { maximumFractionDigits: 0 })}, flip to PASS`;
      }
      return "If price accelerates toward the strike, confidence drops sharply — watch velocity";
    }
    if (driver === "flow") {
      const cvdDir = input.cvd5m > 0 ? "goes negative" : "turns positive";
      return `If CVD ${cvdDir} or buy delta flips ${flowScore > 0 ? "below 40%" : "above 60%"}, this call weakens`;
    }
    if (driver === "technical") {
      if (input.rsi != null) {
        const threshold = verdict === "ABOVE" ? "drops below 45" : "pushes above 55";
        return `RSI at ${input.rsi.toFixed(0)} — if it ${threshold} and MACD histogram ${verdict === "ABOVE" ? "flips negative" : "turns positive"}, re-evaluate`;
      }
      return techScore > 0
        ? "Watch EMA cross — if EMA9 dips under EMA21, bullish tech case weakens"
        : "Watch EMA cross — if EMA9 reclaims EMA21, bearish case needs reassessment";
    }
    return "No dominant flip signal — maintain sizing discipline";
  }

  // ── Reasoning bullets (specific numbers, mentoring tone) ─────────────────────
  private buildReasoning(
    input: TrajectoryInput,
    traj: ReturnType<BTCTrajectoryAnalyzer["trajectoryPhysics"]>,
    techScore: number,
    sentScore: number,
    flowScore: number,
    combined: number,
    volCtx: { isHighVol: boolean; isMedVol: boolean },
    minutesLeft: number
  ): string[] {
    const bullets: string[] = [];
    const strikeGapDollars = Math.abs(input.price - input.target);
    const above = input.price > input.target;

    // 1. Trajectory — always first
    if (traj.velocity5 != null && traj.projectedPrice != null) {
      const vStr = `${traj.velocity5 >= 0 ? "+" : ""}$${Math.abs(traj.velocity5).toFixed(1)}/min`;
      const proj = traj.projectedPrice.toLocaleString("en-US", { maximumFractionDigits: 0 });
      const accelStr = traj.acceleration != null
        ? (Math.abs(traj.acceleration) > 0.5 ? ` — ${traj.acceleration > 0 ? "speeding up" : "slowing down"}` : "")
        : "";
      bullets.push(
        `Moving at ${vStr}${accelStr}, projecting $${proj} at expiry → ${traj.projectedOutcome ?? "unclear"}`
      );
    } else {
      const gapPct = (strikeGapDollars / input.target * 100).toFixed(3);
      bullets.push(
        `Price $${strikeGapDollars.toFixed(0)} ${above ? "above" : "below"} strike (${gapPct}%) — ${parseFloat(gapPct) > 0.2 ? "solid buffer" : "dangerously close"}`
      );
    }

    // 2. Moves needed / crossing risk
    if (traj.movesNeeded != null) {
      const moves = traj.movesNeeded.toFixed(1);
      const risk  = traj.crossingRisk;
      bullets.push(
        risk === "COINFLIP"   ? `Only ${moves}× the avg candle needed to flip — total 50/50, avoid this trade` :
        risk === "HIGH"       ? `${moves}× avg moves to flip — reachable, don't sleep on this` :
        risk === "MODERATE"   ? `${moves}× avg moves to flip — doable with momentum shift, stay sharp` :
        risk === "LOW"        ? `${moves}× avg moves needed — would take a real catalyst to flip this` :
        `${moves}× avg moves to flip — strike is far, this is as locked-in as it gets`
      );
    }

    // 3. Flow
    if (Math.abs(input.cvd5m) > 50_000) {
      const cvdK = (Math.abs(input.cvd5m) / 1000).toFixed(0);
      bullets.push(
        input.cvd5m > 0
          ? `CVD +$${cvdK}K — real buying pressure, not just noise`
          : `CVD -$${cvdK}K — sellers in control of the tape rn`
      );
    } else if (input.buyDelta != null) {
      if (input.buyDelta > 65)       bullets.push(`${input.buyDelta.toFixed(0)}% of 60s volume hitting the ask — buyers are aggressive`);
      else if (input.buyDelta < 35)  bullets.push(`Only ${input.buyDelta.toFixed(0)}% buys last 60s — sellers got the wheel`);
      else if (input.obImbalance != null) {
        const pct = (input.obImbalance * 100).toFixed(0);
        bullets.push(
          input.obImbalance > 0.62 ? `OB ${pct}% bids — bid support stacked, sellers finding it hard to push through`
          : input.obImbalance < 0.38 ? `OB ${pct}% bids — ask wall heavy, buyers struggling to break up`
          : `OB ${pct}% bids — balanced book, flow needs to show direction`
        );
      } else {
        bullets.push(`Flow at ${input.buyDelta.toFixed(0)}% buys — neutral, let trajectory lead here`);
      }
    }

    // 4. Technical context
    if (input.rsi != null) {
      if (input.rsi > 72)       bullets.push(`RSI ${input.rsi.toFixed(0)} — overbought territory, pullback risk is real even in uptrends`);
      else if (input.rsi < 28)  bullets.push(`RSI ${input.rsi.toFixed(0)} — oversold, snap bounce possible but confirm with flow`);
      else if (techScore > 0.4) bullets.push(`RSI ${input.rsi.toFixed(0)} + EMA/MACD all pointing up — technicals are clean`);
      else if (techScore < -0.4)bullets.push(`RSI ${input.rsi.toFixed(0)} + tech signals rolling over — chart is weak`);
      else                       bullets.push(`RSI ${input.rsi.toFixed(0)} + ${input.macd ? (input.macd.histogram > 0 ? "MACD positive" : "MACD fading") : "neutral tech"} — no extreme signals, follow trajectory`);
    }

    // 5. Risk / time context
    if (volCtx.isHighVol) {
      bullets.push(`Vol is HIGH — expected move is bigger, both targets farther out. Size down.`);
    } else if (minutesLeft < 4) {
      const distStr = `$${strikeGapDollars.toFixed(0)} from strike`;
      bullets.push(`Only ${minutesLeft.toFixed(1)} min left and ${distStr} — ${strikeGapDollars > (input.atr ?? 50) ? "distance is the edge, hold" : "this is a last-second race"}`);
    } else if (input.fundingRate != null && Math.abs(input.fundingRate) > 0.0002) {
      const fr = (input.fundingRate * 100).toFixed(4);
      bullets.push(
        input.fundingRate > 0
          ? `Funding +${fr}% — longs paying, perpetuals leaning long. Squeeze exhaustion risk.`
          : `Funding ${fr}% — shorts piling in, squeeze risk elevated. Careful fading.`
      );
    } else {
      bullets.push(`${minutesLeft.toFixed(1)} min on the clock — ${minutesLeft > 8 ? "plenty of time, trust the setup" : "mid-game, stay focused on velocity"}`);
    }

    return bullets.slice(0, 5);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC API — full Kalshi ensemble (used by btc-kalshi-analysis.tsx)
  // ═══════════════════════════════════════════════════════════════════════════

  private static readonly BTC_MARKET_FACTORS = {
    HALVING_IMPACT:      0.15,
    INSTITUTIONAL_FLOW:  0.25,
    RETAIL_SENTIMENT:    0.20,
    TECHNICAL_ANALYSIS:  0.30,
    MACRO_ECONOMIC:      0.10,
  };

  static async analyzeBTCMarket(
    currentData: BTCMarketData,
    kalshiRound: KalshiRound,
    historicalData: BTCMarketData[]
  ): Promise<BTCAnalysisResult> {
    const technicalIndicators = this._calcTechnicalIndicators(historicalData);
    const marketSignals       = this._genMarketSignals(currentData, technicalIndicators);
    const trajectoryPrediction = await this._genTrajectoryPrediction(
      currentData, kalshiRound, historicalData, technicalIndicators, marketSignals
    );
    return { currentMarket: currentData, kalshiRound, trajectoryPrediction, technicalIndicators, marketSignals };
  }

  private static _calcTechnicalIndicators(data: BTCMarketData[]) {
    const prices  = data.map(d => d.price);
    const volumes = data.map(d => d.volume);
    return {
      rsi:           this._rsi(prices, 14),
      macd:          this._macd(prices),
      bollinger:     this._bollinger(prices, 20, 2),
      volumeProfile: this._volumeProfile(prices, volumes),
    };
  }

  private static _rsi(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = prices[i] - prices[i - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    const rs = (gains / period) / (losses / period || 0.0001);
    return 100 - 100 / (1 + rs);
  }

  private static _ema(prices: number[], period: number): number {
    if (!prices.length) return 0;
    const k = 2 / (period + 1);
    return prices.reduce((ema, p, i) => i === 0 ? p : (p - ema) * k + ema, prices[0]);
  }

  private static _macd(prices: number[]) {
    const macd      = this._ema(prices, 12) - this._ema(prices, 26);
    const signal    = this._ema([macd], 9);
    return { macd, signal, histogram: macd - signal };
  }

  private static _bollinger(prices: number[], period: number, stdMult: number) {
    if (prices.length < period) {
      const p = prices.at(-1) ?? 0;
      return { upper: p * 1.02, middle: p, lower: p * 0.98 };
    }
    const recent  = prices.slice(-period);
    const middle  = recent.reduce((s, p) => s + p, 0) / period;
    const std     = Math.sqrt(recent.reduce((s, p) => s + (p - middle) ** 2, 0) / period);
    return { upper: middle + std * stdMult, middle, lower: middle - std * stdMult };
  }

  private static _volumeProfile(prices: number[], volumes: number[]) {
    const total = volumes.reduce((s, v) => s + v, 0);
    const vwap  = prices.reduce((s, p, i) => s + p * volumes[i], 0) / (total || 1);
    const map   = new Map<number, number>();
    prices.forEach((p, i) => {
      const r = Math.round(p / 100) * 100;
      map.set(r, (map.get(r) ?? 0) + volumes[i]);
    });
    const pocs = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
    return { vwap, pocs };
  }

  private static _genMarketSignals(data: BTCMarketData, ind: ReturnType<typeof BTCTrajectoryAnalyzer._calcTechnicalIndicators>) {
    return {
      momentum:   this._momentum(ind.rsi, ind.macd),
      trend:      this._trend(data, ind),
      volatility: this._volState(data, ind),
      liquidity:  this._liquidity(data),
    };
  }

  private static _momentum(rsi: number, macd: { macd: number; signal: number }): BTCAnalysisResult["marketSignals"]["momentum"] {
    if (rsi > 70 && macd.macd > macd.signal) return "STRONG_BULLISH";
    if (rsi > 60 && macd.macd > macd.signal) return "BULLISH";
    if (rsi < 30 && macd.macd < macd.signal) return "STRONG_BEARISH";
    if (rsi < 40 && macd.macd < macd.signal) return "BEARISH";
    return "NEUTRAL";
  }

  private static _trend(data: BTCMarketData, ind: ReturnType<typeof BTCTrajectoryAnalyzer._calcTechnicalIndicators>): BTCAnalysisResult["marketSignals"]["trend"] {
    const pVwap = data.price - ind.volumeProfile.vwap;
    const pBB   = data.price - ind.bollinger.middle;
    if (pVwap > 0 && pBB > 0) return "UPTREND";
    if (pVwap < 0 && pBB < 0) return "DOWNTREND";
    if (Math.abs(pVwap) < ind.bollinger.upper * 0.01) return "SIDEWAYS";
    return "CONSOLIDATION";
  }

  private static _volState(data: BTCMarketData, ind: ReturnType<typeof BTCTrajectoryAnalyzer._calcTechnicalIndicators>): BTCAnalysisResult["marketSignals"]["volatility"] {
    const bbW = (ind.bollinger.upper - ind.bollinger.lower) / ind.bollinger.middle;
    const fr  = Math.abs(data.derivativesData.fundingRate);
    if (bbW > 0.1 || fr > 0.01) return "EXPANDING";
    if (bbW < 0.05 && fr < 0.001) return "CONTRACTING";
    return "STABLE";
  }

  private static _liquidity(data: BTCMarketData): BTCAnalysisResult["marketSignals"]["liquidity"] {
    const vr = data.volume / data.marketCap;
    const oi = data.derivativesData.openInterest / data.marketCap;
    if (vr > 0.02 && oi > 0.1) return "HIGH";
    if (vr > 0.01 && oi > 0.05) return "MEDIUM";
    return "LOW";
  }

  private static async _genTrajectoryPrediction(
    current: BTCMarketData,
    round: KalshiRound,
    historical: BTCMarketData[],
    ind: ReturnType<typeof BTCTrajectoryAnalyzer._calcTechnicalIndicators>,
    signals: BTCAnalysisResult["marketSignals"]
  ): Promise<BTCTrajectoryPrediction> {
    const tech      = this._techModel(current, ind, round.targetPrice);
    const sentiment = this._sentModel(current, historical, round.targetPrice);
    const flow      = this._flowModel(current, round.targetPrice);
    const vol       = this._volModel(current, ind, round.targetPrice);

    const ensemble = (tech.score + sentiment.score + flow.score + vol.score) / 4;
    const confidence = Math.min(95, Math.abs(ensemble) * 100);

    const prediction: "ABOVE" | "BELOW" | "UNCERTAIN" =
      ensemble > 0.1 ? "ABOVE" : ensemble < -0.1 ? "BELOW" : "UNCERTAIN";

    const priceTargets = {
      conservative: current.price * (1 + ensemble * 0.01),
      realistic:    current.price * (1 + ensemble * 0.015),
      optimistic:   current.price * (1 + ensemble * 0.02),
    };

    return {
      prediction,
      confidence,
      reasoning: [...tech.reasoning, ...sentiment.reasoning, ...flow.reasoning, ...vol.reasoning],
      keyFactors: [
        { factor: "Technical Analysis",  impact: tech.score      > 0 ? "BULLISH" : "BEARISH", weight: 35 },
        { factor: "Market Sentiment",    impact: sentiment.score > 0 ? "BULLISH" : "BEARISH", weight: 25 },
        { factor: "Exchange Flows",      impact: flow.score      > 0 ? "BULLISH" : "BEARISH", weight: 25 },
        { factor: "Volatility Dynamics", impact: vol.score       > 0 ? "BULLISH" : "BEARISH", weight: 15 },
      ],
      priceTargets,
      riskAssessment: this._riskAssess(current, ind),
      timeline: {
        currentPrice:  current.price,
        expectedPrice: priceTargets.realistic,
        priceChange:   (priceTargets.realistic - current.price) / current.price,
        timeToDeadline: round.timeRemaining / 60,
      },
    };
  }

  private static _techModel(data: BTCMarketData, ind: ReturnType<typeof BTCTrajectoryAnalyzer._calcTechnicalIndicators>, target: number) {
    const gap    = (data.price - target) / target;
    const rsiS   = ind.rsi > 50 ? 1 : -1;
    const macdS  = ind.macd.macd > ind.macd.signal ? 1 : -1;
    const bbS    = data.price > ind.bollinger.middle ? 1 : -1;
    const score  = (rsiS * 0.3 + macdS * 0.4 + bbS * 0.3) * (1 - Math.abs(gap));
    return {
      score,
      reasoning: [
        `RSI ${ind.rsi.toFixed(1)} — ${ind.rsi > 50 ? "bullish" : "bearish"} momentum`,
        `MACD ${ind.macd.macd > ind.macd.signal ? "above" : "below"} signal line`,
        `Price ${Math.abs(gap * 100).toFixed(2)}% ${gap > 0 ? "above" : "below"} target`,
      ],
    };
  }

  private static _sentModel(data: BTCMarketData, _historical: BTCMarketData[], _target: number) {
    const fng    = (data.fearGreedIndex - 50) / 50;
    const flow   = data.exchangeFlow.netFlow > 0 ? 1 : -1;
    const deriv  = data.derivativesData.longShortRatio > 1 ? 1 : -1;
    const score  = fng * 0.4 + flow * 0.3 + deriv * 0.3;
    return {
      score,
      reasoning: [
        `Fear & Greed ${data.fearGreedIndex} — ${data.fearGreedIndex > 50 ? "greedy" : "fearful"}`,
        `Net flow ${data.exchangeFlow.netFlow > 0 ? "positive" : "negative"}`,
      ],
    };
  }

  private static _flowModel(data: BTCMarketData, _target: number) {
    const netM  = data.exchangeFlow.netFlow / 1_000_000;
    const score = Math.tanh(netM * 0.1);
    return {
      score,
      reasoning: [`Net exchange flow ${netM.toFixed(2)}M BTC`],
    };
  }

  private static _volModel(data: BTCMarketData, ind: ReturnType<typeof BTCTrajectoryAnalyzer._calcTechnicalIndicators>, _target: number) {
    const fr     = data.derivativesData.fundingRate;
    const liqR   = data.derivativesData.liquidations.long /
      (data.derivativesData.liquidations.long + data.derivativesData.liquidations.short + 1);
    const bbW    = (ind.bollinger.upper - ind.bollinger.lower) / ind.bollinger.middle;
    const score  = Math.sign(fr) * ((Math.abs(fr) + bbW + liqR) / 3) * 0.5;
    return {
      score,
      reasoning: [
        `Funding ${(fr * 100).toFixed(3)}% — ${fr > 0 ? "longs paying" : "shorts paying"}`,
        `BB width ${(bbW * 100).toFixed(1)}%`,
      ],
    };
  }

  private static _riskAssess(data: BTCMarketData, ind: ReturnType<typeof BTCTrajectoryAnalyzer._calcTechnicalIndicators>): BTCTrajectoryPrediction["riskAssessment"] {
    const bbW  = (ind.bollinger.upper - ind.bollinger.lower) / ind.bollinger.middle;
    const fr   = Math.abs(data.derivativesData.fundingRate);
    const vr   = data.volume / data.marketCap;
    const vol  = (bbW + fr + vr) / 3;

    const volatility = vol > 0.03 ? "EXTREME" : vol > 0.02 ? "HIGH" : vol > 0.01 ? "MEDIUM" : "LOW";
    const liquidity  = this._liquidity(data);
    const mkt        = data.fearGreedIndex > 60 ? "BULLISH" : data.fearGreedIndex < 40 ? "BEARISH" : "NEUTRAL";

    return { volatility, liquidity, marketSentiment: mkt };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KalshiIntegration — round lifecycle helpers
// ─────────────────────────────────────────────────────────────────────────────

export class KalshiIntegration {
  static createKalshiRound(targetPrice: number, durationMinutes = 15): KalshiRound {
    const now = Date.now();
    return {
      id:            `round-${now}`,
      targetPrice,
      startTime:     now - Math.floor(Math.random() * 60_000),
      duration:      durationMinutes,
      timeRemaining: durationMinutes * 60,
      isActive:      true,
      progress:      0,
    };
  }

  static updateCountdown(round: KalshiRound): KalshiRound {
    const elapsed   = (Date.now() - round.startTime) / 1000;
    const remaining = Math.max(0, round.duration * 60 - elapsed);
    if (remaining === 0) return this.createKalshiRound(round.targetPrice, round.duration);
    return {
      ...round,
      timeRemaining: remaining,
      isActive:      remaining > 0,
      progress:      Math.min(1, elapsed / (round.duration * 60)),
    };
  }

  static formatTimeRemaining(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BTCDataGenerator — mock data for demos / tests
// ─────────────────────────────────────────────────────────────────────────────

export class BTCDataGenerator {
  static generateCurrentBTCData(): BTCMarketData {
    const price  = 65_000 + (Math.random() - 0.5) * 5_000;
    const volume = 20_000_000_000 + (Math.random() - 0.5) * 10_000_000_000;
    return {
      price,
      volume,
      marketCap:     price * 19_500_000,
      dominance:     52 + (Math.random() - 0.5) * 4,
      fearGreedIndex: 30 + Math.random() * 40,
      timestamp:     Date.now(),
      exchangeFlow: {
        inflow:  Math.random() * 1_000,
        outflow: Math.random() * 1_000,
        netFlow: (Math.random() - 0.5) * 1_000,
      },
      onChainMetrics: {
        activeAddresses:  800_000 + Math.floor(Math.random() * 200_000),
        transactionCount: 250_000 + Math.floor(Math.random() * 50_000),
        hashRate:         4e14    + Math.floor(Math.random() * 1e14),
        difficulty:       7.2e13  + Math.floor(Math.random() * 1e12),
      },
      derivativesData: {
        openInterest:    15_000_000_000 + Math.floor(Math.random() * 5_000_000_000),
        fundingRate:     (Math.random() - 0.5) * 0.02,
        longShortRatio:  1.2 + (Math.random() - 0.5) * 0.4,
        liquidations: {
          long:  Math.floor(Math.random() * 100_000_000),
          short: Math.floor(Math.random() * 100_000_000),
        },
      },
    };
  }

  static generateHistoricalData(points = 100): BTCMarketData[] {
    let price = 65_000;
    return Array.from({ length: points }, (_, i) => {
      price *= 1 + (Math.random() - 0.5) * 0.02;
      const d = this.generateCurrentBTCData();
      d.price     = price;
      d.timestamp = Date.now() - (points - i) * 5 * 60_000;
      return d;
    });
  }
}

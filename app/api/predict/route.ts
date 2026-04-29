import Groq from "groq-sdk";
import OpenAI from "openai";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-AI ENSEMBLE PREDICTION ENGINE v3.0
// Fallback Chain + Ensemble Voting + Smart Routing
// ═══════════════════════════════════════════════════════════════════════════

// Simple server-side rate limiter — one prediction per 5 seconds
let lastPredictionAt = 0;
const COOLDOWN_MS = 5000;
const MODEL_TIMEOUT_MS = 14_000;

// Multi-provider AI configuration — ordered by fallback priority
const AI_PROVIDERS = [
  {
    name: "groq" as const,
    models: [
      { id: "llama-3.3-70b-versatile", weight: 3 },
      { id: "llama-3.1-8b-instant", weight: 1 },
      { id: "gemma2-9b-it", weight: 2 },
    ],
    priority: 1,
    envKey: "GROQ_API_KEY",
  },
  {
    name: "openai" as const,
    models: [{ id: "gpt-4o", weight: 3 }],
    priority: 2,
    envKey: "OPENAI_API_KEY",
  },
  {
    name: "anthropic" as const,
    models: [{ id: "claude-3-5-sonnet-20241022", weight: 3 }],
    priority: 3,
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    name: "gemini" as const,
    models: [{ id: "gemini-1.5-pro", weight: 2 }],
    priority: 4,
    envKey: "GEMINI_API_KEY",
  },
  {
    name: "together" as const,
    models: [{ id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", weight: 2 }],
    priority: 5,
    envKey: "TOGETHER_API_KEY",
  },
];

type AIProvider = typeof AI_PROVIDERS[number]["name"];

interface ModelResult {
  provider: AIProvider;
  modelId: string;
  weight: number;
  verdict: "ABOVE" | "BELOW" | "PASS";
  confidence: number;
  reasoning: string[];
  latency: number;
  error?: string;
}

interface EnsembleResult {
  verdict: "ABOVE" | "BELOW" | "PASS";
  confidence: number;
  ev: number;
  kelly: number;
  reasoning: string[];
  providersUsed: AIProvider[];
  modelVotes: string[];
  modelAgreement: number;
  ensembleConfidence: number;
  passReason?: string;
  latency: number;
}

// AI only returns verdict + confidence + reasoning; we compute EV & Kelly server-side
const SingleOutputSchema = z.object({
  verdict:    z.enum(["ABOVE", "BELOW", "PASS"]),
  confidence: z.number().min(50).max(99),
  reasoning:  z.array(z.string()),
});

const RequestSchema = z.object({
  symbol:            z.string().default("BTC"),
  price:             z.number(),
  ema9:              z.number().nullable().optional(),
  ema21:             z.number().nullable().optional(),
  rsi:               z.number().nullable().optional(),
  macd:              z.object({ macd: z.number(), signal: z.number(), histogram: z.number() }).nullable().optional(),
  bb:                z.object({ upper: z.number(), middle: z.number(), lower: z.number(), pctB: z.number() }).nullable().optional(),
  windowBias:        z.number().nullable().optional(),
  closes:            z.array(z.number()),
  target:            z.string(),
  expiryLabel:       z.string().optional(),
  secondsToExpiry:   z.number().optional(),
  fearGreed:         z.object({ value: z.number(), label: z.string() }).nullable().optional(),
  fundingRate:       z.number().nullable().optional(),
  change24h:         z.number().nullable().optional(),
  openInterest:      z.number().nullable().optional(),
  atr:               z.number().nullable().optional(),
  stochRsi:          z.object({ k: z.number(), d: z.number() }).nullable().optional(),
  marketRegime:      z.string().nullable().optional(),
  obImbalance:       z.number().nullable().optional(),
  buyDelta:          z.number().nullable().optional(),
  largeBuys:         z.number().int().nullable().optional(),
  largeSells:        z.number().int().nullable().optional(),
  pcRatio:           z.number().nullable().optional(),
  eventsImminent:    z.array(z.string()).nullable().optional(),
  vwap:              z.number().nullable().optional(),
  cvd5m:             z.number().nullable().optional(),
  session:           z.string().nullable().optional(),
  recentLiquidations: z.array(z.object({
    side:   z.enum(["LONG", "SHORT"]),
    amount: z.number(),
    price:  z.number(),
  })).nullable().optional(),
});

// Kelly criterion for ~90% Kalshi binary payout
// f* = max(0, min(10, ((1.9p - 1) / 0.9) × 100))
function calcKelly(confidence: number): number {
  const p = confidence / 100;
  return Math.max(0, Math.min(10, ((1.9 * p - 1) / 0.9) * 100));
}

// Expected value for ~90% Kalshi payout: EV% = 190p - 100
function calcEV(confidence: number): number {
  const p = confidence / 100;
  return Math.round(190 * p - 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-AI PROVIDER QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function queryGroq(
  prompt: string,
  toolDef: unknown,
  timeoutMs: number
): Promise<ModelResult | null> {
  if (!process.env.GROQ_API_KEY) return null;
  const start = Date.now();
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const models = AI_PROVIDERS.find((p) => p.name === "groq")!.models;

  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const completion = await client.chat.completions.create(
        {
          model: model.id,
          messages: [{ role: "user", content: prompt }],
          tools: [toolDef as any],
          tool_choice: "required",
          max_tokens: 768,
        },
        { signal: ctrl.signal }
      );
      clearTimeout(timer);

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || (toolCall as any).type !== 'function') continue;

      const raw = JSON.parse((toolCall as any).function.arguments);
      const parsed = SingleOutputSchema.safeParse(raw);
      if (parsed.success) {
        return {
          provider: "groq",
          modelId: model.id,
          weight: model.weight,
          verdict: parsed.data.verdict,
          confidence: parsed.data.confidence,
          reasoning: parsed.data.reasoning,
          latency: Date.now() - start,
        };
      }
    } catch (e) {
      clearTimeout(timer);
      continue;
    }
  }
  return null;
}

async function queryOpenAI(
  prompt: string,
  toolDef: unknown,
  timeoutMs: number
): Promise<ModelResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const start = Date.now();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const models = AI_PROVIDERS.find((p) => p.name === "openai")!.models;

  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const completion = await client.chat.completions.create(
        {
          model: model.id,
          messages: [{ role: "user", content: prompt }],
          tools: [toolDef as any],
          tool_choice: "required",
          max_tokens: 768,
        },
        { signal: ctrl.signal }
      );
      clearTimeout(timer);

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== 'function') continue;

      const raw = JSON.parse(toolCall.function.arguments);
      const parsed = SingleOutputSchema.safeParse(raw);
      if (parsed.success) {
        return {
          provider: "openai",
          modelId: model.id,
          weight: model.weight,
          verdict: parsed.data.verdict,
          confidence: parsed.data.confidence,
          reasoning: parsed.data.reasoning,
          latency: Date.now() - start,
        };
      }
    } catch (e) {
      clearTimeout(timer);
      continue;
    }
  }
  return null;
}

async function queryAnthropic(
  prompt: string,
  timeoutMs: number
): Promise<ModelResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const start = Date.now();

  const models = AI_PROVIDERS.find((p) => p.name === "anthropic")!.models;

  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // Anthropic uses different API format - use native fetch
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `${prompt}\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "verdict": "ABOVE|BELOW|PASS",\n  "confidence": 75,\n  "reasoning": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"]\n}`,
            },
          ],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) continue;

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = SingleOutputSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (parsed.success) {
        return {
          provider: "anthropic",
          modelId: model.id,
          weight: model.weight,
          verdict: parsed.data.verdict,
          confidence: parsed.data.confidence,
          reasoning: parsed.data.reasoning,
          latency: Date.now() - start,
        };
      }
    } catch (e) {
      clearTimeout(timer);
      continue;
    }
  }
  return null;
}

async function queryGemini(
  prompt: string,
  timeoutMs: number
): Promise<ModelResult | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const start = Date.now();

  const models = AI_PROVIDERS.find((p) => p.name === "gemini")!.models;

  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${prompt}\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "verdict": "ABOVE|BELOW|PASS",\n  "confidence": 75,\n  "reasoning": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"]\n}`,
                  },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 1024 },
          }),
          signal: ctrl.signal,
        }
      );
      clearTimeout(timer);

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) continue;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = SingleOutputSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (parsed.success) {
        return {
          provider: "gemini",
          modelId: model.id,
          weight: model.weight,
          verdict: parsed.data.verdict,
          confidence: parsed.data.confidence,
          reasoning: parsed.data.reasoning,
          latency: Date.now() - start,
        };
      }
    } catch (e) {
      clearTimeout(timer);
      continue;
    }
  }
  return null;
}

async function queryTogether(
  prompt: string,
  timeoutMs: number
): Promise<ModelResult | null> {
  if (!process.env.TOGETHER_API_KEY) return null;
  const start = Date.now();

  const models = AI_PROVIDERS.find((p) => p.name === "together")!.models;

  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const response = await fetch("https://api.together.xyz/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            {
              role: "user",
              content: `${prompt}\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "verdict": "ABOVE|BELOW|PASS",\n  "confidence": 75,\n  "reasoning": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"]\n}`,
            },
          ],
          max_tokens: 1024,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = SingleOutputSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (parsed.success) {
        return {
          provider: "together",
          modelId: model.id,
          weight: model.weight,
          verdict: parsed.data.verdict,
          confidence: parsed.data.confidence,
          reasoning: parsed.data.reasoning,
          latency: Date.now() - start,
        };
      }
    } catch (e) {
      clearTimeout(timer);
      continue;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENSEMBLE VOTING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export function computeEnsembleResult(results: ModelResult[]): EnsembleResult | null {
  if (results.length === 0) return null;

  // Calculate weighted scores for each verdict
  let aboveScore = 0;
  let belowScore = 0;
  let passScore = 0;
  let totalWeight = 0;

  for (const r of results) {
    const weightedScore = r.weight * r.confidence;
    totalWeight += r.weight;

    if (r.verdict === "ABOVE") aboveScore += weightedScore;
    else if (r.verdict === "BELOW") belowScore += weightedScore;
    else passScore += weightedScore;
  }

  const totalScore = aboveScore + belowScore + passScore;

  // Determine winner
  let finalVerdict: "ABOVE" | "BELOW" | "PASS";
  let passReason: string | undefined;
  let winningResults: ModelResult[];

  if (passScore > totalScore * 0.4) {
    finalVerdict = "PASS";
    passReason = "Multiple models see no clear edge (ensemble consensus)";
    winningResults = results;
  } else if (aboveScore > belowScore && aboveScore > passScore) {
    finalVerdict = "ABOVE";
    winningResults = results.filter((r) => r.verdict === "ABOVE");
  } else if (belowScore > aboveScore && belowScore > passScore) {
    finalVerdict = "BELOW";
    winningResults = results.filter((r) => r.verdict === "BELOW");
  } else {
    finalVerdict = "PASS";
    passReason = "Ensemble split — no clear consensus";
    winningResults = results;
  }

  // Calculate ensemble confidence
  const winningWeight = winningResults.reduce((s, r) => s + r.weight, 0);
  const avgConfidence = Math.round(
    winningResults.reduce((s, r) => s + r.confidence * r.weight, 0) / winningWeight
  );

  // Count model agreement (how many models agree with final verdict)
  const agreeingCount = results.filter((r) => r.verdict === finalVerdict).length;
  const modelAgreement = agreeingCount;

  // Build provider list and votes
  const providersUsed = [...new Set(results.map((r) => r.provider))];
  const modelVotes = results.map((r) => `${r.provider}:${r.verdict}`);

  // Select best reasoning from highest confidence result
  const primary = [...winningResults].sort((a, b) =>
    b.weight !== a.weight ? b.weight - a.weight : b.confidence - a.confidence
  )[0];

  // Calculate latency metrics
  const totalLatency = results.reduce((s, r) => s + r.latency, 0);

  return {
    verdict: finalVerdict,
    confidence: finalVerdict === "PASS" ? 50 : avgConfidence,
    ev: finalVerdict === "PASS" ? 0 : calcEV(avgConfidence),
    kelly: finalVerdict === "PASS" ? 0 : parseFloat(calcKelly(avgConfidence).toFixed(2)),
    reasoning: primary.reasoning,
    providersUsed,
    modelVotes,
    modelAgreement,
    ensembleConfidence: avgConfidence,
    passReason,
    latency: totalLatency,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  // Check at least one API key is configured
  const hasAnyKey = AI_PROVIDERS.some((p) => process.env[p.envKey]);
  if (!hasAnyKey) {
    return Response.json({ error: "Server misconfigured: no AI API keys set" }, { status: 500 });
  }

  const now = Date.now();
  if (now - lastPredictionAt < COOLDOWN_MS) {
    return Response.json(
      { error: `Rate limited. Wait ${Math.ceil((COOLDOWN_MS - (now - lastPredictionAt)) / 1000)}s.` },
      { status: 429 }
    );
  }
  lastPredictionAt = now;

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      symbol, price, ema9, ema21, rsi, macd, bb, windowBias, closes, target,
      expiryLabel, secondsToExpiry,
      fearGreed, fundingRate, change24h, openInterest, atr, stochRsi, marketRegime,
      obImbalance, buyDelta, largeBuys, largeSells, pcRatio, eventsImminent,
      vwap, cvd5m, session, recentLiquidations,
    } = parsed.data;

    const assetName = symbol === "ETH" ? "Ethereum" : "Bitcoin";

    const recentPrices = closes.slice(-30);
    const fmt = (n: number) =>
      n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const targetNum = parseFloat(target);
    if (isNaN(targetNum) || targetNum <= 0)
      return Response.json({ error: "Invalid strike price" }, { status: 400 });

    const strikeGapPct    = ((price - targetNum) / targetNum) * 100;
    const strikeAbove     = price > targetNum;
    const strikeDistDollars = Math.abs(price - targetNum);
    const minutesToExpiry = secondsToExpiry != null ? (secondsToExpiry / 60).toFixed(1) : "N/A";
    const minutesLeft     = secondsToExpiry != null ? secondsToExpiry / 60 : null;

    const change1  = recentPrices.length >= 2  ? (((recentPrices.at(-1)! - recentPrices.at(-2)!)  / recentPrices.at(-2)!)  * 100).toFixed(4) : "N/A";
    const change5  = recentPrices.length >= 6  ? (((recentPrices.at(-1)! - recentPrices.at(-6)!)  / recentPrices.at(-6)!)  * 100).toFixed(4) : "N/A";
    const change15 = recentPrices.length >= 16 ? (((recentPrices.at(-1)! - recentPrices.at(-16)!) / recentPrices.at(-16)!) * 100).toFixed(4) : "N/A";

    const volatility = recentPrices.length >= 5
      ? (Math.sqrt(
          recentPrices.slice(-5).reduce((acc, p, i, arr) => {
            if (i === 0) return 0;
            const ret = (p - arr[i - 1]) / arr[i - 1];
            return acc + ret * ret;
          }, 0) / 4
        ) * 100).toFixed(5)
      : "N/A";

    // ── Trajectory analytics (server-side math — injected as Tier 0) ────────

    // Price velocity: $/min over last 5 and 1 periods
    const velocity5 = recentPrices.length >= 6
      ? (recentPrices.at(-1)! - recentPrices.at(-6)!) / 5
      : null;
    const velocity1 = recentPrices.length >= 2
      ? recentPrices.at(-1)! - recentPrices.at(-2)!
      : null;

    // Acceleration: change in velocity (5-period velocity now vs 5 periods ago)
    let acceleration: number | null = null;
    if (recentPrices.length >= 11) {
      const recentVel = (recentPrices.at(-1)!  - recentPrices.at(-6)!)  / 5;
      const priorVel  = (recentPrices.at(-6)!  - recentPrices.at(-11)!) / 5;
      acceleration = recentVel - priorVel;
    }

    // Linear price projection at expiry
    let projectedPrice:   number | null = null;
    let projectedOutcome: "ABOVE" | "BELOW" | null = null;
    if (velocity5 != null && minutesLeft != null) {
      projectedPrice   = price + velocity5 * minutesLeft;
      projectedOutcome = projectedPrice > targetNum ? "ABOVE" : "BELOW";
    }

    // Average absolute 1-min move (last 5 ticks) → how many of those to flip outcome
    let avgMinMove:        number | null = null;
    let movesNeededToFlip: number | null = null;
    if (recentPrices.length >= 6) {
      const moves: number[] = [];
      for (let i = recentPrices.length - 5; i < recentPrices.length; i++) {
        moves.push(Math.abs(recentPrices[i] - recentPrices[i - 1]));
      }
      avgMinMove = moves.reduce((a, b) => a + b, 0) / moves.length;
      if (avgMinMove > 0) movesNeededToFlip = strikeDistDollars / avgMinMove;
    }

    // Is momentum moving toward or away from the strike?
    // strikeAbove = price is above strike; falling price (velocity5<0) → toward strike
    let momentumDir: string | null = null;
    if (velocity5 != null) {
      const towardStrike = strikeAbove ? velocity5 < 0 : velocity5 > 0;
      const sign = velocity5 >= 0 ? "+" : "";
      momentumDir = towardStrike
        ? `TOWARD strike at ${sign}$${velocity5.toFixed(2)}/min`
        : `AWAY from strike at ${sign}$${velocity5.toFixed(2)}/min`;
    }

    // Z-score crossing probability: how many ATR-sized expected moves to flip?
    // Expected move in N min ≈ ATR * sqrt(minutesLeft / 14)
    // z < 0.5 → high risk, z > 2 → very unlikely
    let crossingRisk: string | null = null;
    if (atr != null && minutesLeft != null && atr > 0) {
      const expectedMove = atr * Math.sqrt(minutesLeft / 14);
      const z = strikeDistDollars / expectedMove;
      crossingRisk =
        z < 0.5 ? `HIGH flip risk (z=${z.toFixed(2)}) — strike easily reachable at current vol`
        : z < 1.0 ? `MODERATE flip risk (z=${z.toFixed(2)}) — strike within reach`
        : z < 2.0 ? `LOW flip risk (z=${z.toFixed(2)}) — needs a big move`
        : `VERY LOW flip risk (z=${z.toFixed(2)}) — crossing highly unlikely`;
    }

    // Dollar-per-minute needed to flip before expiry
    let dollarPerMinNeeded: string | null = null;
    if (minutesLeft != null && minutesLeft > 0) {
      const needed = strikeDistDollars / minutesLeft;
      dollarPerMinNeeded = `$${needed.toFixed(2)}/min sustained to flip before expiry`;
    }

    // ── Pre-compute signal strings ──────────────────────────────────────────

    const emaSignal = ema9 != null && ema21 != null
      ? ema9 > ema21
        ? `BULLISH — EMA9 $${ema9.toFixed(2)} above EMA21 $${ema21.toFixed(2)}, gap $${Math.abs(ema9 - ema21).toFixed(2)}`
        : `BEARISH — EMA9 $${ema9.toFixed(2)} below EMA21 $${ema21.toFixed(2)}, gap $${Math.abs(ema9 - ema21).toFixed(2)}`
      : "N/A";

    const macdSignal = macd != null
      ? `Line ${macd.macd.toFixed(3)}, Signal ${macd.signal.toFixed(3)}, Hist ${macd.histogram.toFixed(3)} (${macd.histogram > 0 ? "BULLISH" : "BEARISH"})`
      : "N/A";

    const bbSignal = bb != null
      ? `Upper $${bb.upper.toFixed(2)}, Mid $${bb.middle.toFixed(2)}, Lower $${bb.lower.toFixed(2)}, %B ${bb.pctB.toFixed(3)} — ${bb.pctB > 0.85 ? "near upper / overbought" : bb.pctB < 0.15 ? "near lower / oversold" : (bb.upper - bb.lower) / bb.middle < 0.002 ? "SQUEEZE" : "mid-band"}`
      : "N/A";

    const windowBiasStr = windowBias != null
      ? `${windowBias.toFixed(1)}% up-ticks (${windowBias > 55 ? "bullish" : windowBias < 45 ? "bearish" : "neutral"})`
      : "N/A";

    const fngSignal = fearGreed != null
      ? `${fearGreed.value}/100 — ${fearGreed.label.toUpperCase()} (${fearGreed.value <= 25 ? "extreme fear = contrarian BUY" : fearGreed.value >= 75 ? "extreme greed = contrarian SELL" : "moderate"})`
      : "N/A";

    const fundingSignal = fundingRate != null
      ? `${fundingRate >= 0 ? "+" : ""}${(fundingRate * 100).toFixed(4)}% — ${fundingRate > 0.0003 ? "VERY HIGH: longs overleveraged" : fundingRate > 0 ? "positive: longs paying" : fundingRate < -0.0003 ? "VERY NEGATIVE: shorts overleveraged" : "negative: shorts paying"}`
      : "N/A";

    const oiSignal = openInterest != null
      ? `$${(openInterest / 1e9).toFixed(2)}B open ${symbol} futures` : "N/A";

    const atrSignal = atr != null
      ? `$${atr.toFixed(0)} avg move (${((atr / price) * 100).toFixed(3)}%) — ${atr / price > 0.003 ? "HIGH volatility" : atr / price > 0.001 ? "MODERATE" : "LOW volatility"}`
      : "N/A";

    const stochSignal = stochRsi != null
      ? `K=${stochRsi.k.toFixed(1)}, D=${stochRsi.d.toFixed(1)} — ${stochRsi.k > 80 ? "OVERBOUGHT" : stochRsi.k < 20 ? "OVERSOLD" : stochRsi.k > stochRsi.d ? "K>D bullish" : "K<D bearish"}`
      : "N/A";

    const pcSignal = pcRatio != null
      ? `${pcRatio.toFixed(3)} — ${pcRatio > 1.2 ? "high put demand / bearish hedge" : pcRatio < 0.7 ? "low puts / call euphoria" : "neutral"}`
      : "N/A";

    const obSignal = obImbalance != null
      ? `${(obImbalance * 100).toFixed(1)}% bids — ${obImbalance > 0.65 ? "STRONG BID WALL: bullish" : obImbalance < 0.35 ? "STRONG ASK WALL: bearish" : obImbalance > 0.55 ? "bid-heavy" : obImbalance < 0.45 ? "ask-heavy" : "balanced"}`
      : "N/A";

    const deltaSignal = buyDelta != null
      ? `${buyDelta.toFixed(1)}% buys last 60s — ${buyDelta > 65 ? "STRONG BUY FLOW" : buyDelta < 35 ? "STRONG SELL FLOW" : "balanced"}`
      : "N/A";

    const whaleSignal = (largeBuys != null || largeSells != null)
      ? `${largeBuys ?? 0} large buys, ${largeSells ?? 0} large sells (>$50K) last 60s`
      : "N/A";

    const eventsStr = eventsImminent && eventsImminent.length > 0
      ? `⚠ IMMINENT: ${eventsImminent.join(", ")} — STRONGLY CONSIDER PASS`
      : "None";

    const vwapSignal = vwap != null
      ? `$${vwap.toFixed(2)} — price is $${Math.abs(price - vwap).toFixed(2)} ${price > vwap ? "ABOVE (bullish institutional bias)" : "BELOW (bearish institutional bias)"}`
      : "N/A";

    const cvdSignal = cvd5m != null
      ? `${cvd5m >= 0 ? "+" : ""}$${(cvd5m / 1000).toFixed(0)}K — ${Math.abs(cvd5m) > 500_000 ? (cvd5m > 0 ? "STRONG BUYING PRESSURE" : "STRONG SELLING PRESSURE") : cvd5m > 0 ? "net buy flow" : "net sell flow"}`
      : "N/A";

    const liqSignal = recentLiquidations && recentLiquidations.length > 0
      ? recentLiquidations.slice(-5).map((l) =>
          `${l.side} LIQ $${(l.amount / 1000).toFixed(0)}K @$${l.price.toFixed(0)}`
        ).join(", ")
      : "None recent";

    // ── Build elite trajectory-first prompt ────────────────────────────────

    const prompt = `You are an elite ${symbol} binary options specialist. Real Kalshi money is on the line. Your ONLY job is to predict where ${symbol} price will physically BE when the countdown hits zero — not whether the market is "bullish" in general.

=== THE TRADE ===
${symbol}/USD now: $${fmt(price)}
Strike: $${fmt(targetNum)}
Price is: ${strikeAbove ? "ABOVE" : "BELOW"} strike by $${strikeDistDollars.toFixed(2)} (${Math.abs(strikeGapPct).toFixed(4)}%)
Expiry: ${expiryLabel ?? "N/A"} (${minutesToExpiry} min away)
24h Change: ${change24h != null ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%` : "N/A"}

=== TIER 0 — TRAJECTORY MATH (read this first — it's the most important section) ===
To FLIP the current outcome, price must move $${strikeDistDollars.toFixed(2)} ${strikeAbove ? "DOWN" : "UP"} in ${minutesToExpiry} min.
That requires: ${dollarPerMinNeeded ?? "N/A"}

Velocity (last 5 min): ${velocity5 != null ? `${velocity5 >= 0 ? "+" : ""}$${velocity5.toFixed(2)}/min` : "N/A"}
Last 1-min move: ${velocity1 != null ? `${velocity1 >= 0 ? "+" : ""}$${velocity1.toFixed(2)}` : "N/A"}
Acceleration: ${acceleration != null ? (acceleration > 0 ? `speeding up +$${acceleration.toFixed(2)}/min²` : `slowing down $${acceleration.toFixed(2)}/min²`) : "N/A"}
Momentum direction: ${momentumDir ?? "N/A"}
Linear price projection at expiry: ${projectedPrice != null ? `$${fmt(projectedPrice)} → trajectory predicts ${projectedOutcome}` : "N/A"}
Moves to flip: ${movesNeededToFlip != null ? `${movesNeededToFlip.toFixed(1)}× the avg 1-min move ($${avgMinMove!.toFixed(2)})` : "N/A"}
Crossing probability: ${crossingRisk ?? "N/A"}

TRAJECTORY RULES — apply these mechanically:
• "Moves to flip" ≥ 15 AND momentum AWAY from strike → near-certain, 85-95% confidence
• "Moves to flip" 8-14 AND momentum AWAY → very likely, 75-85%
• "Moves to flip" 4-7 → moderate edge, factor Tier 1 signals heavily
• "Moves to flip" < 4 OR momentum strongly TOWARD strike → tight race, 55-65% or PASS
• "Moves to flip" < 2 → coinflip, output PASS

=== TIER 1 — REAL-TIME FLOW (confirms or denies trajectory) ===
VWAP: ${vwapSignal}
5-min CVD: ${cvdSignal}
Order Book imbalance: ${obSignal}
Recent Liquidations: ${liqSignal}

=== TIER 2 — MOMENTUM & FLOW DETAIL ===
Trading Session: ${session ?? "N/A"}
60s Buy/Sell Delta: ${deltaSignal}
Whale Trades >$50K: ${whaleSignal}
EMA Cross: ${emaSignal}
Market Regime: ${marketRegime ?? "N/A"}

=== TIER 3 — TECHNICAL INDICATORS ===
RSI(14): ${rsi != null ? `${rsi.toFixed(2)} — ${rsi >= 70 ? "OVERBOUGHT" : rsi <= 30 ? "OVERSOLD" : "NEUTRAL"}` : "N/A"}
Stoch RSI: ${stochSignal}
MACD(12,26,9): ${macdSignal}
Bollinger Bands(20): ${bbSignal}
ATR(14): ${atrSignal}
1-tick Δ: ${change1}%  |  5-tick Δ: ${change5}%  |  15-tick Δ: ${change15}%
Window bias: ${windowBiasStr}
Short-term volatility: ${volatility}%

=== TIER 4 — MACRO (context only, low weight) ===
Fear & Greed: ${fngSignal}
Funding Rate: ${fundingSignal}
Open Interest: ${oiSignal}
Put/Call Ratio: ${pcSignal}
Upcoming events: ${eventsStr}

=== DECISION RULES ===
Priority: Tier 0 (trajectory math) > Tier 1 (flow) > Tier 2 (momentum) > Tier 3 (technicals) > Tier 4 (macro)

IMPORTANT LOGIC:
- A "bearish" market does NOT mean BELOW wins if price is $800 above strike with 10 min left. Price needs to fall fast enough to cross — use the trajectory math.
- A "bullish" market does NOT override strong TOWARD momentum with 1 min left and price $20 from strike.
- Always anchor your verdict to the trajectory data first, then use Tier 1 to confirm.

OUTPUT PASS when:
- "Moves to flip" < 2 (coinflip)
- Strike within 0.05% of price AND < 5 min left
- Imminent economic event (< 15 min)
- Tier 0 trajectory and Tier 1 flow strongly disagree with no resolution
- Genuine no-edge: confidence would be under 58%

=== REASONING STYLE ===
Write exactly 5 casual bullets. Sound like a sharp trader texting a buddy — real numbers, plain English, zero jargon.

Good examples:
- "Price is $340 above strike and moving away at $12/min — needs a miracle drop to flip"
- "CVD up $520K this candle, buyers are loading up hard, this ain't slowing down"
- "Order book 71% bids right now — sellers just aren't showing up"
- "RSI at 69, still got room, not overbought yet"
- "Shorts got wiped at $83.1K — that squeeze just added fuel to the move"

Bad (do NOT write like these):
- "Bullish momentum confluence supports upside bias" ← no numbers, pure jargon
- "Market structure remains constructive" ← meaningless filler

Use the prediction_output function. Set verdict=PASS, confidence=50 if genuinely no edge.`;

    const toolDef = {
      type: "function" as const,
      function: {
        name: "prediction_output",
        description: "Return structured binary options prediction with casual reasoning",
        parameters: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["ABOVE", "BELOW", "PASS"], description: "Direction or PASS if no edge" },
            confidence: { type: "number", description: "50-99 integer. Anchor to trajectory math first" },
            reasoning: {
              type: "array",
              items: { type: "string" },
              description: "Exactly 5 bullets. Casual English, specific numbers.",
            },
          },
          required: ["verdict", "confidence", "reasoning"],
        },
      },
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MULTI-AI PARALLEL QUERY — FALLBACK CHAIN + ENSEMBLE VOTING
    // ═══════════════════════════════════════════════════════════════════════════

    // Query ALL available AI providers in parallel
    const timeoutPerProvider = Math.floor(MODEL_TIMEOUT_MS / 2); // 7s per provider

    const providerPromises = [
      queryGroq(prompt, toolDef, timeoutPerProvider),
      queryOpenAI(prompt, toolDef, timeoutPerProvider),
      queryAnthropic(prompt, timeoutPerProvider),
      queryGemini(prompt, timeoutPerProvider),
      queryTogether(prompt, timeoutPerProvider),
    ];

    const providerResults = await Promise.allSettled(providerPromises);

    // Collect successful results
    const successfulResults: ModelResult[] = [];
    for (const result of providerResults) {
      if (result.status === "fulfilled" && result.value !== null) {
        successfulResults.push(result.value);
      }
    }

    if (successfulResults.length === 0) {
      return Response.json(
        { error: "All AI providers failed. Please try again." },
        { status: 503 }
      );
    }

    // Compute ensemble result from all successful providers
    const ensemble = computeEnsembleResult(successfulResults);
    if (!ensemble) {
      return Response.json({ error: "Failed to compute ensemble result" }, { status: 500 });
    }

    // ── Business-rule PASS overrides ────────────────────────────────────────
    let finalVerdict = ensemble.verdict;
    let passReason = ensemble.passReason;

    if (finalVerdict !== "PASS" && ensemble.confidence < 58) {
      finalVerdict = "PASS";
      passReason = `Low conviction — ensemble confidence ${ensemble.confidence}% is under 58% threshold`;
    }
    if (finalVerdict !== "PASS" && eventsImminent && eventsImminent.length > 0) {
      finalVerdict = "PASS";
      passReason = `High-impact event imminent: ${eventsImminent[0]}`;
    }
    // Too close to strike near expiry
    if (
      finalVerdict !== "PASS" &&
      secondsToExpiry != null && secondsToExpiry < 300 &&
      Math.abs(strikeGapPct) < 0.05
    ) {
      finalVerdict = "PASS";
      passReason = `Strike within 0.05% of price with <5 min left — it's too close to call`;
    }

    // Recalculate EV/Kelly if we overrode to PASS
    const finalConfidence = finalVerdict === "PASS" ? 50 : ensemble.confidence;
    const ev = finalVerdict === "PASS" ? 0 : calcEV(finalConfidence);
    const kelly = finalVerdict === "PASS" ? 0 : parseFloat(calcKelly(finalConfidence).toFixed(2));

    return Response.json({
      verdict: finalVerdict,
      confidence: finalConfidence,
      ev,
      kelly,
      reasoning: ensemble.reasoning,
      providersUsed: ensemble.providersUsed,
      modelVotes: ensemble.modelVotes,
      modelAgreement: ensemble.modelAgreement,
      ensembleConfidence: ensemble.ensembleConfidence,
      passReason,
      latency: ensemble.latency,
      // Trajectory snapshot for frontend display
      trajectory: {
        movesNeeded: movesNeededToFlip != null ? parseFloat(movesNeededToFlip.toFixed(1)) : null,
        velocity: velocity5 != null ? parseFloat(velocity5.toFixed(2)) : null,
        projectedOutcome,
        momentumDir: momentumDir ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prediction failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

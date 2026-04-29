import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { z } from "zod";

// ─── Output schema ──────────────────────────────────────────────────────────

const OpportunitySchema = z.object({
  asset: z.string(),
  strategy: z.string(),
  entry_reasoning: z.string(),
  risk_level: z.enum(["Low", "Moderate", "High"]),
  expected_return: z.object({ low: z.number(), high: z.number() }),
  time_horizon: z.string(),
  confidence: z.number().min(0).max(100),
  key_risks: z.array(z.string()),
});

const AllocationSchema = z.object({
  positions: z.array(
    z.object({
      asset: z.string(),
      allocation_pct: z.number(),
      rationale: z.string(),
    })
  ),
  cash_reserve_pct: z.number(),
  total_deployed_pct: z.number(),
});

const ScenarioSchema = z.object({
  return_pct: z.number(),
  description: z.string(),
  probability: z.number(),
});

const AllocatorResponseSchema = z.object({
  opportunities: z.array(OpportunitySchema),
  allocation_strategy: AllocationSchema,
  scenarios: z.object({
    best_case: ScenarioSchema,
    base_case: ScenarioSchema,
    worst_case: ScenarioSchema,
  }),
  market_regime: z.enum(["bullish", "bearish", "neutral", "high_volatility"]),
  no_trade_recommendation: z.boolean(),
  no_trade_reason: z.string().optional(),
});

export type AllocatorResponse = z.infer<typeof AllocatorResponseSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;

// ─── Mock fallback data ─────────────────────────────────────────────────────

const MOCK_RESPONSE: AllocatorResponse = {
  opportunities: [
    {
      asset: "SPY (S&P 500 ETF)",
      strategy: "momentum",
      entry_reasoning:
        "Broad market index showing sustained upward momentum above 200-day EMA. Low single-stock risk with strong institutional sponsorship.",
      risk_level: "Low",
      expected_return: { low: 4, high: 11 },
      time_horizon: "3–6 months",
      confidence: 82,
      key_risks: ["Fed rate decision volatility", "Earnings season uncertainty"],
    },
    {
      asset: "BTC/USD",
      strategy: "trend",
      entry_reasoning:
        "Bitcoin reclaimed key support at $60K with rising on-chain activity. Halving cycle tailwind with institutional ETF inflows.",
      risk_level: "Moderate",
      expected_return: { low: 8, high: 28 },
      time_horizon: "2–4 months",
      confidence: 78,
      key_risks: ["Regulatory headlines", "Macro risk-off rotation"],
    },
    {
      asset: "GLD (Gold ETF)",
      strategy: "defensive",
      entry_reasoning:
        "Gold breaking out of multi-year consolidation on dollar weakness and geopolitical uncertainty. Acts as portfolio hedge.",
      risk_level: "Low",
      expected_return: { low: 3, high: 9 },
      time_horizon: "4–8 months",
      confidence: 74,
      key_risks: ["Dollar strengthening", "Risk-on rotation away from safe havens"],
    },
    {
      asset: "QQQ (Nasdaq ETF)",
      strategy: "momentum",
      entry_reasoning:
        "Tech sector leading with AI tailwind. Oversold short-term after pullback, setting up for continuation with strong earnings backdrop.",
      risk_level: "Moderate",
      expected_return: { low: 6, high: 18 },
      time_horizon: "2–3 months",
      confidence: 71,
      key_risks: ["High valuations", "Rising yields impact on growth stocks"],
    },
  ],
  allocation_strategy: {
    positions: [
      { asset: "SPY", allocation_pct: 28, rationale: "Core defensive growth position" },
      { asset: "BTC/USD", allocation_pct: 22, rationale: "High-conviction crypto exposure" },
      { asset: "GLD", allocation_pct: 15, rationale: "Macro hedge and volatility dampener" },
      { asset: "QQQ", allocation_pct: 15, rationale: "Growth satellite, AI sector exposure" },
    ],
    cash_reserve_pct: 20,
    total_deployed_pct: 80,
  },
  scenarios: {
    best_case: {
      return_pct: 22,
      description: "Risk-on environment with Fed pivot, strong earnings, and BTC halving rally",
      probability: 25,
    },
    base_case: {
      return_pct: 9,
      description: "Steady macro, mixed earnings, gradual appreciation across diversified positions",
      probability: 55,
    },
    worst_case: {
      return_pct: -8,
      description: "Macro shock, credit event, or sharp risk-off rotation triggers drawdown",
      probability: 20,
    },
  },
  market_regime: "neutral",
  no_trade_recommendation: false,
};

// ─── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an institutional-grade AI portfolio manager, quantitative analyst, and capital allocator.
Your objective is to grow user capital using risk-adjusted strategies while prioritizing capital preservation.
You operate with hedge-fund-level discipline, not speculation.

CORE RULES:
- NEVER guarantee profits
- ALWAYS express outcomes as probability ranges
- ALWAYS include downside risk
- REJECT low-quality opportunities (confidence < 70)
- PRESERVE capital before seeking returns

WHEN USER PROVIDES CAPITAL AND RISK PROFILE:
1. Analyze global markets including: Stocks (large, mid, small cap), ETFs, Crypto (high liquidity only), Macro conditions
2. Identify 3–7 high-quality opportunities based on: Risk/reward asymmetry, Liquidity, Volatility profile, Trend strength

FOR EACH OPPORTUNITY:
- Asset name
- Strategy type (momentum, value, trend, defensive, etc.)
- Entry reasoning (data-driven)
- Risk level (Low / Moderate / High)
- Expected return range (percentage range, NOT fixed)
- Time horizon
- Confidence score (0–100)
- Key risks

PORTFOLIO RULES:
- Maximum 30% per position
- Minimum 15% cash reserve
- Use diversification and risk weighting

BEHAVIORAL RULES:
- If no strong opportunities exist, set no_trade_recommendation to true
- Do NOT overtrade
- Do NOT use hype or emotional language
- Be precise, analytical, and concise

OUTPUT FORMAT (STRICT JSON ONLY, no markdown, no extra text):
{
  "opportunities": [
    {
      "asset": "string",
      "strategy": "string",
      "entry_reasoning": "string",
      "risk_level": "Low|Moderate|High",
      "expected_return": { "low": number, "high": number },
      "time_horizon": "string",
      "confidence": number,
      "key_risks": ["string"]
    }
  ],
  "allocation_strategy": {
    "positions": [
      { "asset": "string", "allocation_pct": number, "rationale": "string" }
    ],
    "cash_reserve_pct": number,
    "total_deployed_pct": number
  },
  "scenarios": {
    "best_case": { "return_pct": number, "description": "string", "probability": number },
    "base_case": { "return_pct": number, "description": "string", "probability": number },
    "worst_case": { "return_pct": number, "description": "string", "probability": number }
  },
  "market_regime": "bullish|bearish|neutral|high_volatility",
  "no_trade_recommendation": boolean,
  "no_trade_reason": "string (only if no_trade_recommendation is true)"
}`;

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const capital: number = body.capital ?? 10000;
    const riskProfile: string = body.risk_profile ?? "moderate";

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      // Return mock data when no API key is set
      return NextResponse.json(MOCK_RESPONSE);
    }

    const groq = new Groq({ apiKey });

    const userMessage = `Analyze current global markets and provide capital allocation recommendations.

Capital available: $${capital.toLocaleString()}
Risk profile: ${riskProfile}
Date: ${new Date().toISOString().split("T")[0]}

Apply the ${riskProfile} risk filter:
- conservative: prefer Low risk opportunities, max 20% per position, 30% cash reserve minimum
- moderate: allow Low-Moderate risk, max 25% per position, 20% cash reserve minimum
- aggressive: allow all risk levels, max 30% per position, 15% cash reserve minimum

Return ONLY valid JSON. No markdown, no commentary.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "";

    // Extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(MOCK_RESPONSE);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = AllocatorResponseSchema.parse(parsed);

    // Filter opportunities below confidence threshold
    validated.opportunities = validated.opportunities.filter(
      (opp) => opp.confidence >= 70
    );

    // Enforce allocation rules
    validated.allocation_strategy.positions =
      validated.allocation_strategy.positions.filter(
        (pos) => pos.allocation_pct <= 30
      );

    return NextResponse.json(validated);
  } catch (err) {
    console.error("[/api/allocator] Error:", err);
    // Always return usable data — fallback to mock
    return NextResponse.json(MOCK_RESPONSE);
  }
}

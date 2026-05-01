export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// ANTHROPIC MULTI-PERSONA CONSENSUS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

interface Persona {
  name: string;
  label: string;
  systemPrompt: string;
}

interface ProviderResult {
  name: string;
  label: string;
  direction: "ABOVE" | "BELOW" | "unavailable";
  confidence: number;
  reasoning: string;
  status: "ok" | "error" | "unavailable";
  errorReason?: string;
}

interface ConsensusResponse {
  consensus: "ABOVE" | "BELOW" | "SPLIT";
  agreementScore: number;
  voteCount: {
    ABOVE: number;
    BELOW: number;
    unavailable: number;
  };
  providers: ProviderResult[];
  weightedScore: number;
  timestamp: string;
  engine: string;
}

interface BTCData {
  price: number;
  fearGreed?: { value: number; label: string };
  pcRatio?: number;
  closes?: number[];
}

const PERSONAS: Persona[] = [
  {
    name: "technician",
    label: "Technical Analyst",
    systemPrompt: `You are a professional BTC technical analyst specializing in momentum indicators. Focus on EMA crossovers, RSI levels, and MACD signal for your ABOVE/BELOW prediction. Weight recent price action heavily.`
  },
  {
    name: "quant",
    label: "Quant Model",
    systemPrompt: `You are a quantitative trading model for BTC 15-minute contracts. Focus on statistical patterns, mean reversion probability, and volatility regime. Be data-driven and precise.`
  },
  {
    name: "sentiment",
    label: "Sentiment Analyst",
    systemPrompt: `You are a BTC market sentiment specialist. Focus on Fear & Greed index, put/call ratio, and macro momentum. Weight market psychology in your prediction.`
  },
  {
    name: "contrarian",
    label: "Contrarian",
    systemPrompt: `You are a contrarian BTC trader. Question the obvious signal. Look for overextended moves, exhaustion patterns, and fakeouts. Challenge the consensus direction.`
  },
  {
    name: "momentum",
    label: "Momentum Trader",
    systemPrompt: `You are a pure momentum trader. Follow the trend aggressively. Focus on breakouts, volume surges, and trend continuation. Ignore mean reversion signals.`
  },
  {
    name: "risk",
    label: "Risk Manager",
    systemPrompt: `You are a risk-focused BTC analyst. Your job is to identify the lower-risk direction. Consider downside protection, volatility, and probability of loss. Be conservative in uncertain markets.`
  }
];

// Simple JSON extraction from response text
function extractJsonFromText(text: string): Record<string, unknown> | null {
  try {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch {
    return null;
  }
}

async function callPersona(
  persona: Persona,
  btcData: BTCData
): Promise<ProviderResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) {
    return {
      name: persona.name,
      label: persona.label,
      status: "error",
      errorReason: "ANTHROPIC_API_KEY not configured",
      direction: "unavailable",
      confidence: 0,
      reasoning: ""
    };
  }

  const userPrompt = `Current BTC market data:
Price: $${btcData.price}
Fear & Greed: ${btcData.fearGreed?.value ?? "N/A"} (${btcData.fearGreed?.label ?? "N/A"})
Put/Call Ratio: ${btcData.pcRatio ?? "N/A"}
Recent closes (oldest to newest): ${btcData.closes?.slice(-10).join(", ") ?? "N/A"}

Kalshi 15-minute contract: will BTC price be ABOVE or BELOW
the current price in the next 15 minutes?

Respond ONLY with this exact JSON format, nothing else:
{
  "direction": "ABOVE" or "BELOW",
  "confidence": <number 50-95>,
  "reasoning": "<one sentence max>"
}`;

  try {
    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": key.trim(),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 150,
          system: persona.systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[consensus:${persona.name}] ${res.status}: ${errText}`);
      return {
        name: persona.name,
        label: persona.label,
        status: "error",
        errorReason: `${res.status} ${res.statusText}`,
        direction: "unavailable",
        confidence: 0,
        reasoning: ""
      };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    console.log(`[consensus:${persona.name}] raw: ${text}`);

    // Parse JSON from response
    const clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(clean);
    const direction = parsed.direction === "ABOVE" ? "ABOVE" : "BELOW";

    return {
      name: persona.name,
      label: persona.label,
      status: "ok",
      direction,
      confidence: Math.min(95, Math.max(50, parsed.confidence ?? 60)),
      reasoning: parsed.reasoning ?? ""
    };
  } catch (err: any) {
    console.error(`[consensus:${persona.name}] threw: ${err.message}`);
    return {
      name: persona.name,
      label: persona.label,
      status: "error",
      errorReason: err.message,
      direction: "unavailable",
      confidence: 0,
      reasoning: ""
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  // Fetch live BTC data internally
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://btc-trustee-quant-v3.vercel.app";
  const btcRes = await fetch(`${baseUrl}/api/btc`);
  const btcData: BTCData = await btcRes.json();

  console.log("[consensus] Starting 6-persona Anthropic consensus");
  console.log("[consensus] ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);

  // Fire all 6 personas in parallel
  const results = await Promise.allSettled(
    PERSONAS.map(p => callPersona(p, btcData))
  );

  const providers = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          name: PERSONAS[i].name,
          label: PERSONAS[i].label,
          status: "error",
          errorReason: "Promise rejected",
          direction: "unavailable",
          confidence: 0,
          reasoning: ""
        }
  );

  const active = providers.filter(p => p.status === "ok");
  const aboveVotes = active.filter(p => p.direction === "ABOVE").length;
  const belowVotes = active.filter(p => p.direction === "BELOW").length;
  const total = active.length;

  const consensus = total === 0
    ? "SPLIT"
    : aboveVotes > belowVotes
      ? "ABOVE"
      : belowVotes > aboveVotes
        ? "BELOW"
        : "SPLIT";

  const agreementScore = total === 0 ? 0
    : Math.round((Math.max(aboveVotes, belowVotes) / PERSONAS.length) * 100);

  const winningProviders = active.filter(
    p => p.direction === consensus
  );
  const weightedScore = winningProviders.length === 0 ? 0
    : Math.round(
        winningProviders.reduce((sum, p) => sum + p.confidence, 0)
        / winningProviders.length
      );

  return Response.json({
    consensus,
    agreementScore,
    voteCount: {
      ABOVE: aboveVotes,
      BELOW: belowVotes,
      unavailable: providers.length - total
    },
    providers,
    weightedScore,
    timestamp: new Date().toISOString(),
    engine: "anthropic-multi-persona"
  });
}

// Support both GET and POST
export const POST = GET;

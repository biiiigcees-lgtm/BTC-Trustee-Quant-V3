import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// AI CONSENSUS VOTING API — Multi-provider parallel consensus for BTC direction
// ═══════════════════════════════════════════════════════════════════════════

// Provider weights for weighted voting (tuned for crypto short-term prediction)
const PROVIDER_WEIGHTS: Record<string, number> = {
  groq: 1.2,
  openai: 1.3,
  gemini: 1.0,
  mistral: 0.9,
  cerebras: 1.0,
  siliconflow: 0.8,
  openrouter: 0.9,
};

// Timeout per provider (ms)
const PROVIDER_TIMEOUT_MS = 12000;

// Rate limiting: 60 second cooldown
let lastCallTimestamp = 0;
let cachedResponse: ConsensusResponse | null = null;
const COOLDOWN_MS = 60000;

interface ConsensusRequest {
  price: number;
  ema9?: number | null;
  ema21?: number | null;
  rsi?: number | null;
  target: string;
  expiryLabel?: string;
  secondsToExpiry?: number;
}

interface ProviderResult {
  name: string;
  direction: "ABOVE" | "BELOW" | "unavailable";
  confidence: number;
  reasoning: string;
  status: "ok" | "error" | "unavailable";
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
  cached?: boolean;
  timestamp: string;
}

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

// Build the system prompt for all providers
function buildPrompt(data: ConsensusRequest): string {
  return `You are a BTC 15-minute direction predictor for Kalshi markets.

Current Market Data:
- BTC Price: $${data.price.toFixed(2)}
- Target Strike: ${data.target}
- Time to Expiry: ${data.expiryLabel || "15 minutes"} (${data.secondsToExpiry || 900}s)
${data.ema9 ? `- EMA 9: ${data.ema9.toFixed(2)}` : ""}
${data.ema21 ? `- EMA 21: ${data.ema21.toFixed(2)}` : ""}
${data.rsi ? `- RSI: ${data.rsi.toFixed(2)}` : ""}

Respond ONLY with valid JSON in this exact format:
{
  "direction": "ABOVE" or "BELOW",
  "confidence": <number 0-100>,
  "reasoning": "<one sentence max>"
}

No preamble, no markdown, no explanation outside the JSON.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function queryGroq(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { name: "groq", direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { name: "groq", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromText(content);

    if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
      return { name: "groq", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const direction = String(parsed.direction).toUpperCase();
    if (direction !== "ABOVE" && direction !== "BELOW") {
      return { name: "groq", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    return {
      name: "groq",
      direction,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning || "").slice(0, 100),
      status: "ok",
    };
  } catch {
    return { name: "groq", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
  }
}

async function queryOpenAI(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { name: "openai", direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { name: "openai", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromText(content);

    if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
      return { name: "openai", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const direction = String(parsed.direction).toUpperCase();
    if (direction !== "ABOVE" && direction !== "BELOW") {
      return { name: "openai", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    return {
      name: "openai",
      direction,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning || "").slice(0, 100),
      status: "ok",
    };
  } catch {
    return { name: "openai", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
  }
}

async function queryGemini(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { name: "gemini", direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 150 },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      return { name: "gemini", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = extractJsonFromText(content);

    if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
      return { name: "gemini", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const direction = String(parsed.direction).toUpperCase();
    if (direction !== "ABOVE" && direction !== "BELOW") {
      return { name: "gemini", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    return {
      name: "gemini",
      direction,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning || "").slice(0, 100),
      status: "ok",
    };
  } catch {
    return { name: "gemini", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
  }
}

async function queryMistral(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { name: "mistral", direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { name: "mistral", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromText(content);

    if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
      return { name: "mistral", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const direction = String(parsed.direction).toUpperCase();
    if (direction !== "ABOVE" && direction !== "BELOW") {
      return { name: "mistral", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    return {
      name: "mistral",
      direction,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning || "").slice(0, 100),
      status: "ok",
    };
  } catch {
    return { name: "mistral", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
  }
}

async function queryCerebras(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    return { name: "cerebras", direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama3.1-70b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { name: "cerebras", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromText(content);

    if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
      return { name: "cerebras", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const direction = String(parsed.direction).toUpperCase();
    if (direction !== "ABOVE" && direction !== "BELOW") {
      return { name: "cerebras", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    return {
      name: "cerebras",
      direction,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning || "").slice(0, 100),
      status: "ok",
    };
  } catch {
    return { name: "cerebras", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
  }
}

async function querySiliconFlow(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return { name: "siliconflow", direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-72B-Instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { name: "siliconflow", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromText(content);

    if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
      return { name: "siliconflow", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const direction = String(parsed.direction).toUpperCase();
    if (direction !== "ABOVE" && direction !== "BELOW") {
      return { name: "siliconflow", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    return {
      name: "siliconflow",
      direction,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning || "").slice(0, 100),
      status: "ok",
    };
  } catch {
    return { name: "siliconflow", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
  }
}

async function queryOpenRouter(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { name: "openrouter", direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://btc-trustee-quant-v3.vercel.app",
        "X-Title": "BTC Trustee Quant V3",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { name: "openrouter", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJsonFromText(content);

    if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
      return { name: "openrouter", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    const direction = String(parsed.direction).toUpperCase();
    if (direction !== "ABOVE" && direction !== "BELOW") {
      return { name: "openrouter", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    }

    return {
      name: "openrouter",
      direction,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
      reasoning: String(parsed.reasoning || "").slice(0, 100),
      status: "ok",
    };
  } catch {
    return { name: "openrouter", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
  }
}

// Compute weighted consensus from provider results
function computeConsensus(providers: ProviderResult[]): ConsensusResponse {
  const available = providers.filter((p) => p.status === "ok");
  const above = available.filter((p) => p.direction === "ABOVE");
  const below = available.filter((p) => p.direction === "BELOW");
  const unavailable = providers.filter((p) => p.status !== "ok");

  const aboveCount = above.length;
  const belowCount = below.length;
  const totalAvailable = available.length;

  // Determine consensus
  let consensus: "ABOVE" | "BELOW" | "SPLIT";
  if (aboveCount > belowCount) {
    consensus = "ABOVE";
  } else if (belowCount > aboveCount) {
    consensus = "BELOW";
  } else {
    consensus = "SPLIT";
  }

  // Agreement score: (winning votes / total available) * 100
  const winningCount = Math.max(aboveCount, belowCount);
  const agreementScore = totalAvailable > 0 ? Math.round((winningCount / totalAvailable) * 100) : 0;

  // Weighted score: average confidence of providers voting for winning direction
  // Apply weight multiplier: 1x if confidence >= 55, 0.5x if < 55
  const winningProviders = consensus === "ABOVE" ? above : consensus === "BELOW" ? below : [];

  let totalWeight = 0;
  let weightedConfidenceSum = 0;

  for (const p of winningProviders) {
    const baseWeight = PROVIDER_WEIGHTS[p.name] || 1.0;
    const confidenceWeight = p.confidence >= 55 ? baseWeight : baseWeight * 0.5;
    totalWeight += confidenceWeight;
    weightedConfidenceSum += p.confidence * confidenceWeight;
  }

  const weightedScore = totalWeight > 0 ? Math.round(weightedConfidenceSum / totalWeight) : 0;

  return {
    consensus,
    agreementScore,
    voteCount: {
      ABOVE: aboveCount,
      BELOW: belowCount,
      unavailable: unavailable.length,
    },
    providers,
    weightedScore,
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const now = Date.now();

  // Check cooldown
  if (now - lastCallTimestamp < COOLDOWN_MS && cachedResponse) {
    return NextResponse.json({ ...cachedResponse, cached: true });
  }

  try {
    const body = await req.json();
    const { price, ema9, ema21, rsi, target, expiryLabel, secondsToExpiry } = body;

    if (!price || !target) {
      return NextResponse.json({ error: "Missing required fields: price, target" }, { status: 400 });
    }

    const prompt = buildPrompt({ price, ema9, ema21, rsi, target, expiryLabel, secondsToExpiry });

    // Fire all providers in parallel
    const providerPromises = [
      queryGroq(prompt),
      queryOpenAI(prompt),
      queryGemini(prompt),
      queryMistral(prompt),
      queryCerebras(prompt),
      querySiliconFlow(prompt),
      queryOpenRouter(prompt),
    ];

    const providerResults = await Promise.allSettled(providerPromises);

    // Collect results
    const providers: ProviderResult[] = providerResults.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return { name: "unknown", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    });

    const consensus = computeConsensus(providers);

    // Cache and update timestamp
    cachedResponse = consensus;
    lastCallTimestamp = now;

    return NextResponse.json(consensus);
  } catch (error) {
    console.error("Consensus API error:", error);
    return NextResponse.json({ error: "Failed to compute consensus" }, { status: 500 });
  }
}

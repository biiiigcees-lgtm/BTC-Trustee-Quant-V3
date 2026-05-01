import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════════
// AI CONSENSUS VOTING API — Multi-provider parallel consensus for BTC direction
// ═══════════════════════════════════════════════════════════════════════════

// Provider weights for weighted voting (tuned for crypto short-term prediction)
const PROVIDER_WEIGHTS: Record<string, number> = {
  groq: 1.3,
  "groq-fast": 0.8,
  gemini: 1.2,
  mistral: 1.0,
  openrouter: 0.9,
  huggingface: 0.7,
};

// Timeout per provider (ms)
const PROVIDER_TIMEOUT_MS = 12000;
const HUGGINGFACE_TIMEOUT_MS = 20000;

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

function unavailableProvider(name: string): ProviderResult {
  return { name, direction: "unavailable", confidence: 0, reasoning: "", status: "unavailable" };
}

function errorProvider(name: string, errorReason?: string): ProviderResult {
  return { name, direction: "unavailable", confidence: 0, reasoning: "", status: "error", errorReason };
}

function normalizeProviderResult(
  name: string,
  parsed: Record<string, unknown> | null
): ProviderResult {
  if (!parsed || !parsed.direction || typeof parsed.confidence !== "number") {
    return errorProvider(name);
  }

  const direction = String(parsed.direction).toUpperCase();
  if (direction !== "ABOVE" && direction !== "BELOW") {
    return errorProvider(name);
  }

  return {
    name,
    direction,
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
    reasoning: String(parsed.reasoning || "").slice(0, 100),
    status: "ok",
  };
}

function isGracefulUnavailableStatus(status: number): boolean {
  return status === 401 || status === 402 || status === 429;
}

async function queryGroqModel(
  prompt: string,
  name: "groq" | "groq-fast",
  model: string
): Promise<ProviderResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return unavailableProvider(name);
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
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (isGracefulUnavailableStatus(response.status)) return unavailableProvider(name);
      return errorProvider(name, `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return normalizeProviderResult(name, extractJsonFromText(content));
  } catch {
    return unavailableProvider(name);
  }
}

async function queryGroq(prompt: string): Promise<ProviderResult> {
  return queryGroqModel(prompt, "groq", "llama-3.3-70b-versatile");
}

async function queryGroqFast(prompt: string): Promise<ProviderResult> {
  return queryGroqModel(prompt, "groq-fast", "llama-3.1-8b-instant");
}

async function queryGemini(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return unavailableProvider("gemini");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 150,
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      if (isGracefulUnavailableStatus(response.status)) return unavailableProvider("gemini");
      return errorProvider("gemini", `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return normalizeProviderResult("gemini", extractJsonFromText(content));
  } catch {
    return unavailableProvider("gemini");
  }
}

async function queryMistral(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return unavailableProvider("mistral");
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
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (isGracefulUnavailableStatus(response.status)) return unavailableProvider("mistral");
      return errorProvider("mistral", `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return normalizeProviderResult("mistral", extractJsonFromText(content));
  } catch {
    return unavailableProvider("mistral");
  }
}

async function queryOpenRouter(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return unavailableProvider("openrouter");
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
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (isGracefulUnavailableStatus(response.status)) return unavailableProvider("openrouter");
      return errorProvider("openrouter", `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return normalizeProviderResult("openrouter", extractJsonFromText(content));
  } catch {
    return unavailableProvider("openrouter");
  }
}

async function queryHuggingFace(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return unavailableProvider("huggingface");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HUGGINGFACE_TIMEOUT_MS);

    const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.1,
          return_full_text: false,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (isGracefulUnavailableStatus(response.status) || response.status === 503) {
        return unavailableProvider("huggingface");
      }
      return errorProvider("huggingface", `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = Array.isArray(data) ? data[0]?.generated_text || "" : "";
    return normalizeProviderResult("huggingface", extractJsonFromText(content));
  } catch {
    return unavailableProvider("huggingface");
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

  // Agreement score: (winning votes / total attempted) * 100
  const winningCount = Math.max(aboveCount, belowCount);
  const totalAttempted = providers.length;
  const agreementScore = totalAttempted > 0 ? Math.round((winningCount / totalAttempted) * 100) : 0;

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

// Helper function to fetch BTC price if not provided
async function getBTCPrice(): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const btcRes = await fetch(`${baseUrl}/api/btc`);
    if (btcRes.ok) {
      const btcData = await btcRes.json();
      return btcData.price;
    }
  } catch (error) {
    console.error('Failed to fetch BTC price:', error);
  }
  // Fallback to a reasonable default
  return 77000;
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const now = Date.now();

  // Check cooldown
  if (now - lastCallTimestamp < COOLDOWN_MS && cachedResponse) {
    return NextResponse.json({ ...cachedResponse, cached: true });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      // GET request or no body - use empty object
      body = {};
    }

    let { price, ema9, ema21, rsi, target, expiryLabel, secondsToExpiry } = body;

    // If no price provided, fetch it from /api/btc
    if (!price) {
      price = await getBTCPrice();
    }

    // Default target if not provided
    if (!target) {
      target = "BTC/USD";
    }

    if (!price) {
      return NextResponse.json({ error: "Could not determine BTC price" }, { status: 400 });
    }

    const prompt = buildPrompt({ price, ema9, ema21, rsi, target, expiryLabel, secondsToExpiry });

    // Fire all providers in parallel
    const providerPromises = [
      queryGroq(prompt),
      queryGroqFast(prompt),
      queryGemini(prompt),
      queryMistral(prompt),
      queryOpenRouter(prompt),
      queryHuggingFace(prompt),
    ];

    const providerResults = await Promise.allSettled(providerPromises);

    // Collect results
    const providers: ProviderResult[] = providerResults.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return { name: "unknown", direction: "unavailable", confidence: 0, reasoning: "", status: "error" };
    });

    // Debug logging for provider status
    console.log('[consensus]', providers.map(p => `${p.name}:${p.status}`).join(' '));

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

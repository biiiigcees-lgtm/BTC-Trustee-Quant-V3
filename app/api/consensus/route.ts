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

function parseProviderResponse(text: string, name: string): ProviderResult {
  return normalizeProviderResult(name, extractJsonFromText(text));
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function logProviderThrow(providerName: string, err: unknown): string {
  if (isAbortError(err)) {
    console.error(`[${providerName}] timed out after ${PROVIDER_TIMEOUT_MS}ms`);
    return "Request timed out";
  }

  const message = getErrorMessage(err);
  console.error(`[${providerName}] threw: ${message}`);
  return message;
}

async function queryGroqModel(
  prompt: string,
  name: "groq" | "groq-fast",
  model: string
): Promise<ProviderResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.trim() === "") {
    console.error(`[consensus] GROQ_API_KEY is undefined or empty for ${name}`);
    return { ...unavailableProvider(name), errorReason: "API key not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[consensus] ${name} error ${response.status}: ${errText}`);
      return errorProvider(name, `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    console.log(`[consensus] ${name} response: ${text}`);
    return parseProviderResponse(text, name);
  } catch (err: unknown) {
    clearTimeout(timeout);
    return errorProvider(name, logProviderThrow(name, err));
  }
}

async function queryGroq(prompt: string): Promise<ProviderResult> {
  return queryGroqModel(prompt, "groq", "llama-3.3-70b-versatile");
}

async function queryGroqFast(prompt: string): Promise<ProviderResult> {
  return queryGroqModel(prompt, "groq-fast", "llama-3.1-8b-instant");
}

async function queryGemini(prompt: string): Promise<ProviderResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === "") {
    console.error("[consensus] GEMINI_API_KEY is undefined or empty");
    return { ...unavailableProvider("gemini"), errorReason: "API key not configured" };
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key.trim()}`;

    const geminiBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.1
      }
    };

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[consensus] Gemini error ${res.status}: ${errText}`);
      return errorProvider("gemini", `${res.status} ${res.statusText}`);
    }

    // Parse response like this:
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log(`[consensus] Gemini response: ${text}`);
    return parseProviderResponse(text, "gemini");
  } catch (err: unknown) {
    return errorProvider("gemini", logProviderThrow("Gemini", err));
  }
}

async function queryMistral(prompt: string): Promise<ProviderResult> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key || key.trim() === "") {
    console.error("[consensus] MISTRAL_API_KEY is undefined or empty");
    return { ...unavailableProvider("mistral"), errorReason: "API key not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key.trim()}`,
        "Content-Type": "application/json",
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
      const errText = await response.text();
      console.error(`[consensus] Mistral error ${response.status}: ${errText}`);
      return errorProvider("mistral", `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    console.log(`[consensus] Mistral response: ${text}`);
    return parseProviderResponse(text, "mistral");
  } catch (err: unknown) {
    clearTimeout(timeout);
    return errorProvider("mistral", logProviderThrow("Mistral", err));
  }
}

async function queryOpenRouter(prompt: string): Promise<ProviderResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key.trim() === "") {
    console.error("[consensus] OPENROUTER_API_KEY is undefined or empty");
    return { ...unavailableProvider("openrouter"), errorReason: "API key not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key.trim()}`,
        "Content-Type": "application/json",
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
      const errText = await response.text();
      console.error(`[consensus] OpenRouter error ${response.status}: ${errText}`);
      return errorProvider("openrouter", `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    console.log(`[consensus] OpenRouter response: ${text}`);
    return parseProviderResponse(text, "openrouter");
  } catch (err: unknown) {
    clearTimeout(timeout);
    return errorProvider("openrouter", logProviderThrow("OpenRouter", err));
  }
}

async function queryHuggingFace(prompt: string): Promise<ProviderResult> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key || key.trim() === "") {
    console.error("[consensus] HUGGINGFACE_API_KEY is undefined or empty");
    return { ...unavailableProvider("huggingface"), errorReason: "API key not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key.trim()}`,
        "Content-Type": "application/json",
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

    if (response.status === 503) {
      return { ...unavailableProvider("huggingface"), errorReason: "Model loading, retry in 20s" };
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[consensus] HuggingFace error ${response.status}: ${errText}`);
      return errorProvider("huggingface", `${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = Array.isArray(data) ? data[0]?.generated_text ?? "" : data?.generated_text ?? "";
    console.log(`[consensus] HuggingFace response: ${text}`);
    return parseProviderResponse(text, "huggingface");
  } catch (err: unknown) {
    clearTimeout(timeout);
    return errorProvider("huggingface", logProviderThrow("HuggingFace", err));
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

  console.log('[consensus] Starting with keys:', {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    huggingface: !!process.env.HUGGINGFACE_API_KEY,
  });

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

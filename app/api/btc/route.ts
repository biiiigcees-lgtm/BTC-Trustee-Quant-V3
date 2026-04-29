import { z } from "zod";

export const dynamic = "force-dynamic";

// ─── Server-side caches ────────────────────────────────────────────────────

let seedCloses: number[] = [];
let seedFetchedAt = 0;
const SEED_TTL_MS = 60 * 60 * 1000;

let fngCache: { value: number; label: string } | null = null;
let fngFetchedAt = 0;
const FNG_TTL_MS = 5 * 60 * 1000;

interface MarketData {
  fundingRate: number | null;
  change24h: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  openInterest: number | null;
}
let marketCache: MarketData | null = null;
let marketFetchedAt = 0;
const MARKET_TTL_MS = 30 * 1000;

let pcRatioCache: number | null = null;
let pcRatioFetchedAt = 0;
const PC_RATIO_TTL_MS = 5 * 60 * 1000;

interface CalEvent { title: string; timestamp: number | null }
let calendarCache: CalEvent[] = [];
let calendarFetchedAt = 0;
const CALENDAR_TTL_MS = 60 * 60 * 1000;

// ─── Zod schemas ───────────────────────────────────────────────────────────

const CoinbaseSchema = z.object({
  data: z.object({ amount: z.string() }),
});

const OhlcEntrySchema = z.tuple([
  z.number(), z.number(), z.number(), z.number(), z.number(),
]);

const FngSchema = z.object({
  data: z.array(z.object({
    value: z.string(),
    value_classification: z.string(),
  })),
});

const FundingRateSchema = z.array(z.object({
  fundingRate: z.string(),
}));

const Ticker24hSchema = z.object({
  priceChangePercent: z.string(),
  quoteVolume: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
});

const OpenInterestSchema = z.object({
  openInterest: z.string(),
});

const DeribitSummarySchema = z.object({
  result: z.array(z.object({
    instrument_name: z.string(),
    open_interest: z.number(),
  })),
});

const FFCalendarSchema = z.array(z.object({
  title: z.string(),
  country: z.string(),
  date: z.string(),
  time: z.string(),
  impact: z.string(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

async function fetchJson(url: string, timeoutMs = 8000) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ForexFactory times are US Eastern. Approximate UTC offset: +4h (EDT) or +5h (EST).
function parseFFTimestamp(date: string, time: string): number | null {
  if (!time || time === "All Day" || time === "Tentative" || time === "BOD") return null;
  const m = time.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && h !== 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(h + 4, min, 0, 0); // EDT = UTC-4
  return d.getTime();
}

// ─── Route ─────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // ── Live spot price (always fresh) ───────────────────────────────────
    const coinbaseParsed = CoinbaseSchema.safeParse(
      await fetchJson("https://api.coinbase.com/v2/prices/BTC-USD/spot")
    );
    if (!coinbaseParsed.success) throw new Error("Unexpected Coinbase response shape");

    const price = parseFloat(coinbaseParsed.data.data.amount);
    if (isNaN(price)) throw new Error("Invalid price from Coinbase");

    const now = Date.now();

    // ── OHLC seed (hourly) ────────────────────────────────────────────────
    if (seedCloses.length === 0 || now - seedFetchedAt > SEED_TTL_MS) {
      try {
        const raw = await fetchJson(
          "https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=1"
        );
        if (Array.isArray(raw) && raw.length > 0) {
          const closes = raw
            .map((e: unknown) => OhlcEntrySchema.safeParse(e))
            .filter((r) => r.success)
            .map((r) => r.data![4]);
          if (closes.length > 0) { seedCloses = closes; seedFetchedAt = now; }
        }
      } catch { /* keep existing seed */ }
    }

    // ── Fear & Greed (every 5 min) ────────────────────────────────────────
    if (!fngCache || now - fngFetchedAt > FNG_TTL_MS) {
      try {
        const parsed = FngSchema.safeParse(
          await fetchJson("https://api.alternative.me/fng/?limit=1")
        );
        if (parsed.success && parsed.data.data.length > 0) {
          const d = parsed.data.data[0];
          fngCache = { value: parseInt(d.value, 10), label: d.value_classification };
          fngFetchedAt = now;
        }
      } catch { /* keep existing cache */ }
    }

    // ── All background fetches in parallel ────────────────────────────────
    const tasks: Promise<void>[] = [];

    // Market data: funding + 24h + OI (every 30s)
    if (!marketCache || now - marketFetchedAt > MARKET_TTL_MS) {
      tasks.push((async () => {
        const newMarket: MarketData = {
          fundingRate: null, change24h: null, volume24h: null,
          high24h: null, low24h: null, openInterest: null,
        };
        await Promise.allSettled([
          fetchJson("https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1")
            .then((raw) => {
              const p = FundingRateSchema.safeParse(raw);
              if (p.success && p.data.length > 0)
                newMarket.fundingRate = parseFloat(p.data[0].fundingRate);
            }),
          fetchJson("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
            .then((raw) => {
              const p = Ticker24hSchema.safeParse(raw);
              if (p.success) {
                newMarket.change24h = parseFloat(p.data.priceChangePercent);
                newMarket.volume24h = parseFloat(p.data.quoteVolume);
                newMarket.high24h = parseFloat(p.data.highPrice);
                newMarket.low24h = parseFloat(p.data.lowPrice);
              }
            }),
          fetchJson("https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT")
            .then((raw) => {
              const p = OpenInterestSchema.safeParse(raw);
              if (p.success)
                newMarket.openInterest = parseFloat(p.data.openInterest) * price;
            }),
        ]);
        marketCache = newMarket;
        marketFetchedAt = now;
      })());
    }

    // Deribit put/call ratio (every 5 min)
    if (!pcRatioCache || now - pcRatioFetchedAt > PC_RATIO_TTL_MS) {
      tasks.push(
        fetchJson(
          "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option",
          8000
        )
          .then((raw) => {
            const p = DeribitSummarySchema.safeParse(raw);
            if (p.success) {
              let calls = 0, puts = 0;
              for (const item of p.data.result) {
                if (item.instrument_name.endsWith("-C")) calls += item.open_interest;
                else if (item.instrument_name.endsWith("-P")) puts += item.open_interest;
              }
              if (calls > 0) { pcRatioCache = puts / calls; pcRatioFetchedAt = now; }
            }
          })
          .catch(() => { /* keep existing */ })
      );
    }

    // Economic calendar (every hour)
    if (calendarCache.length === 0 || now - calendarFetchedAt > CALENDAR_TTL_MS) {
      tasks.push(
        fetchJson("https://nfs.faireconomy.media/ff_calendar_thisweek.json")
          .then((raw) => {
            const p = FFCalendarSchema.safeParse(raw);
            if (p.success) {
              calendarCache = p.data
                .filter((e) => e.country === "USD" && e.impact === "High")
                .map((e) => ({ title: e.title, timestamp: parseFFTimestamp(e.date, e.time) }));
              calendarFetchedAt = now;
            }
          })
          .catch(() => { /* keep existing */ })
      );
    }

    await Promise.allSettled(tasks);

    // Events in the next 4 hours
    const lookAheadMs = 4 * 60 * 60 * 1000;
    const upcomingEvents = calendarCache
      .filter((e) => e.timestamp !== null && e.timestamp > now && e.timestamp < now + lookAheadMs)
      .map((e) => ({
        title: e.title,
        minutesUntil: Math.round(((e.timestamp as number) - now) / 60_000),
      }))
      .sort((a, b) => a.minutesUntil - b.minutesUntil);

    return Response.json({
      price,
      closes: seedCloses,
      fearGreed: fngCache,
      pcRatio: pcRatioCache,
      upcomingEvents,
      ...(marketCache ?? {}),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

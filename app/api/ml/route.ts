import { NextRequest } from "next/server";

const ML_BACKEND_URL = process.env.ML_BACKEND_URL;

export async function GET(req: NextRequest) {
  if (!ML_BACKEND_URL) {
    return Response.json(
      { error: "ML backend not configured — set ML_BACKEND_URL env var" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target");
  const price  = searchParams.get("price") ?? "0";

  if (!target) {
    return Response.json({ error: "target parameter required" }, { status: 400 });
  }

  try {
    const url      = `${ML_BACKEND_URL}/predict?target=${encodeURIComponent(target)}&price=${encodeURIComponent(price)}`;
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    const body = await upstream.json();

    if (!upstream.ok) {
      return Response.json(
        { error: `ML backend error (${upstream.status}): ${JSON.stringify(body)}` },
        { status: upstream.status },
      );
    }

    return Response.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ML backend unreachable";
    return Response.json({ error: msg }, { status: 502 });
  }
}

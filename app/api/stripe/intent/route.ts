import { NextRequest, NextResponse } from "next/server";

// ─── Stripe PaymentIntent stub ─────────────────────────────────────────────
//
// This route returns a mock PaymentIntent client_secret for UI demonstration.
//
// TO WIRE REAL STRIPE:
// 1. npm install stripe
// 2. Set STRIPE_SECRET_KEY in .env.local
// 3. Replace the mock block below with:
//
//   import Stripe from "stripe";
//   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//     apiVersion: "2024-11-20.acacia",
//   });
//   const intent = await stripe.paymentIntents.create({
//     amount: Math.round(body.amount * 100), // cents
//     currency: "usd",
//     payment_method_types: ["card", "apple_pay"],
//     metadata: { user_id: body.user_id ?? "demo" },
//   });
//   return NextResponse.json({ client_secret: intent.client_secret });
//
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const amount: number = body.amount ?? 1000;

    // Mock PaymentIntent — safe for demo, no real charges
    const mockClientSecret = `pi_mock_${Date.now()}_secret_${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    return NextResponse.json({
      client_secret: mockClientSecret,
      amount,
      currency: "usd",
      status: "requires_payment_method",
      mock: true,
    });
  } catch {
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { planType, userId, email } = (await req.json()) as {
      planType: "week" | "month" | "year";
      userId: string;
      email: string;
    };

    if (!planType || !userId || !email) {
      return NextResponse.json(
        { error: "Plan type, user id, and email are required." },
        { status: 400 }
      );
    }

    const allowed = ["week", "month", "year"] as const;
    if (!allowed.includes(planType)) {
      return NextResponse.json({ error: "Invalid plan type." }, { status: 400 });
    }

    const priceId =
      planType === "week"
        ? process.env.STRIPE_PRICE_WEEKLY
        : planType === "month"
        ? process.env.STRIPE_PRICE_MONTHLY
        : process.env.STRIPE_PRICE_YEARLY;

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid price id. Check STRIPE_PRICE_* env vars." },
        { status: 400 }
      );
    }

    const BASE = process.env.NEXT_PUBLIC_BASE_URL!; // must be set on Vercel

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${BASE}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/subscribe`,
      // IMPORTANT: match webhook expectation
      metadata: {
        clerkUserId: userId,
        planType:
          planType === "week" ? "WEEKLY" : planType === "month" ? "MONTHLY" : "YEARLY",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

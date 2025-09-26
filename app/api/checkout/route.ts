import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    // 1) Parse body
    const { planType, userId, email } = (await req.json()) as {
      planType: "week" | "month" | "year";
      userId: string;
      email: string;
    };

    // 2) Validate inputs
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

    // 3) Map plan -> price id via env
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

    // 4) Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/subscribe`,
      metadata: { userId, planType },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    // Bubble a useful 500 payload so you can see it in Network > Response
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error." },
      { status: 500 }
    );
  }
}


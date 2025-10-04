/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

type PlanIn = "week" | "month" | "year";
type Tier = "WEEKLY" | "MONTHLY" | "YEARLY";

const PRICE_WEEKLY = process.env.STRIPE_PRICE_WEEKLY!;
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY!;
const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY!;

function priceIdFor(plan: PlanIn): string {
  switch (plan) {
    case "week":
      return PRICE_WEEKLY;
    case "month":
      return PRICE_MONTHLY;
    case "year":
      return PRICE_YEARLY;
  }
}

function tierFor(plan: PlanIn): Tier {
  return plan === "week" ? "WEEKLY" : plan === "month" ? "MONTHLY" : "YEARLY";
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const { userId } = await auth(); 
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Parse + validate input
    const body = (await req.json()) as { planType?: PlanIn };
    const plan = body?.planType;
    if (!plan || !["week", "month", "year"].includes(plan)) {
      return NextResponse.json({ error: "Invalid planType" }, { status: 400 });
    }

    // 3) Get profile to find current subscription
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true },
    });

    const subId = profile?.stripeSubscriptionId ?? null;
    if (!subId) {
      return NextResponse.json(
        { error: "No active subscription on file." },
        { status: 400 }
      );
    }

    // 4) Fetch the subscription from Stripe (expand to get the item id)
    const subscription = await stripe.subscriptions.retrieve(subId, {
      expand: ["items.data.price"],
    });

    const subItem = subscription.items.data[0];
    if (!subItem?.id) {
      return NextResponse.json(
        { error: "Subscription item not found." },
        { status: 400 }
      );
    }

    const newPrice = priceIdFor(plan);

    // 5) Update the subscription to the new price (with proration)
    await stripe.subscriptions.update(subId, {
      items: [
        {
          id: subItem.id,
          price: newPrice,
        },
      ],
      proration_behavior: "create_prorations",
    });

    // 6) Persist the new tier in DB (webhook will also confirm)
    await prisma.profile.update({
      where: { userId },
      data: {
        subscriptionTier: tierFor(plan),
        subscriptionActive: true,
      },
    });

    return NextResponse.json({ ok: true, plan: tierFor(plan) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

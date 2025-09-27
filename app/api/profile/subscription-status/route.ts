/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_WEEKLY = process.env.STRIPE_PRICE_WEEKLY;
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY;
const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY;

type Tier = "WEEKLY" | "MONTHLY" | "YEARLY" | null;
function tierFromPrice(priceId?: string | null): Tier {
  if (!priceId) return null;
  if (priceId === PRICE_WEEKLY) return "WEEKLY";
  if (priceId === PRICE_MONTHLY) return "MONTHLY";
  if (priceId === PRICE_YEARLY) return "YEARLY";
  return null;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1) Read what we have
    let profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        userId: true,
        stripeSubscriptionId: true,
        subscriptionActive: true,
        subscriptionTier: true,
      },
    });

    // 2) If missing/empty, try to find on Stripe by Clerk email and backfill
    if (!profile?.stripeSubscriptionId || !profile.subscriptionActive || !profile.subscriptionTier) {
      const u = await currentUser();
      const email = u?.primaryEmailAddress?.emailAddress ?? undefined;

      if (email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        const customer = customers.data[0];

        if (customer) {
          // Prefer active/trialing subscription
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: "all",
            limit: 3,
            expand: ["data.items.data.price"],
          });

          // Pick the most relevant subscription
          const best = subs.data.find(s => s.status === "active" || s.status === "trialing") ?? subs.data[0];

          if (best) {
            const priceId = best.items.data[0]?.price?.id ?? null;
            const tier = tierFromPrice(priceId);
            const isActive = best.status === "active" || best.status === "trialing";

            // Backfill (create profile if it somehow doesn’t exist)
            profile = await prisma.profile.upsert({
              where: { userId },
              update: {
                stripeSubscriptionId: best.id,
                subscriptionActive: isActive,
                subscriptionTier: tier,
              },
              create: {
                userId,
                stripeSubscriptionId: best.id,
                subscriptionActive: isActive,
                subscriptionTier: tier,
              },
              select: {
                userId: true,
                stripeSubscriptionId: true,
                subscriptionActive: true,
                subscriptionTier: true,
              },
            });
          }
        }
      }
    }

    // 3) If we STILL don’t have anything, return a clean error (UI shows toast)
    if (!profile?.stripeSubscriptionId || !profile.subscriptionActive || !profile.subscriptionTier) {
      return NextResponse.json({ error: "No Active Subscription Found" }, { status: 400 });
    }

    // 4) Return normalized payload
    return NextResponse.json({
      subscription: {
        stripeSubscriptionId: profile.stripeSubscriptionId,
        subscriptionActive: profile.subscriptionActive,
        subscriptionTier: profile.subscriptionTier, // "WEEKLY" | "MONTHLY" | "YEARLY"
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

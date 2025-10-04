/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server"; // <-- add currentUser
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

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

    // Get Clerk user (for email + Stripe lookup)
    const u = await currentUser();
    const email =
      u?.primaryEmailAddress?.emailAddress ??
      u?.emailAddresses?.[0]?.emailAddress ??
      null;

    // 1) Read what we have in DB
    let profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        stripeSubscriptionId: true,
        subscriptionActive: true,
        subscriptionTier: true,
      },
    });

    // 2) If DB info is missing/empty, try Stripe fallback and backfill
    if (
      !profile?.stripeSubscriptionId ||
      !profile.subscriptionActive ||
      !profile.subscriptionTier
    ) {
      if (!email) {
        // cannot look up on Stripe without an email
        return NextResponse.json(
          { error: "No Active Subscription Found" },
          { status: 400 }
        );
      }

      const customers = await stripe.customers.list({ email, limit: 1 });
      const customer = customers.data[0];

      if (customer) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 3,
          expand: ["data.items.data.price"],
        });

        const best =
          subs.data.find(
            (s) => s.status === "active" || s.status === "trialing"
          ) ?? subs.data[0];

        if (best) {
          const priceId = best.items.data[0]?.price?.id ?? null;
          const tier = tierFromPrice(priceId);
          const isActive =
            best.status === "active" || best.status === "trialing";

          // Backfill: include 'email' on create to satisfy Prisma schema
          profile = await prisma.profile.upsert({
            where: { userId },
            update: {
              stripeSubscriptionId: best.id,
              subscriptionActive: isActive,
              subscriptionTier: tier,
            },
            create: {
              userId,
              email, // <- REQUIRED BY YOUR SCHEMA
              stripeSubscriptionId: best.id,
              subscriptionActive: isActive,
              subscriptionTier: tier,
            },
            select: {
              userId: true,
              email: true,
              stripeSubscriptionId: true,
              subscriptionActive: true,
              subscriptionTier: true,
            },
          });
        }
      }
    }

    // 3) Still nothing? Tell UI there’s no active sub
    if (
      !profile?.stripeSubscriptionId ||
      !profile.subscriptionActive ||
      !profile.subscriptionTier
    ) {
      return NextResponse.json(
        { error: "No Active Subscription Found" },
        { status: 400 }
      );
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

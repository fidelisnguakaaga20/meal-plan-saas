/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read from DB
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true },
    });

    let subId = profile?.stripeSubscriptionId ?? null;

    // If DB doesn't have it (older sessions/webhook mismatch), try to find via Stripe customer email.
    if (!subId) {
      const u = await currentUser();
      const email = u?.primaryEmailAddress?.emailAddress;
      if (email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        const customer = customers.data[0];
        if (customer) {
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: "active",
            limit: 1,
          });
          subId = subs.data[0]?.id ?? null;

          // Optional: persist backfill so future actions are instant
          if (subId) {
            await prisma.profile.update({
              where: { userId },
              data: { stripeSubscriptionId: subId, subscriptionActive: true },
            });
          }
        }
      }
    }

    if (!subId) {
      return NextResponse.json({ error: "No Active Subscription Found" }, { status: 400 });
    }

    // Cancel immediately; change to { cancel_at_period_end: true } to end at period end.
    await stripe.subscriptions.cancel(subId);

    await prisma.profile.update({
      where: { userId },
      data: {
        subscriptionActive: false,
        stripeSubscriptionId: null,
        subscriptionTier: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

function tierFromPlanKey(planKey?: string | null): Tier {
  if (!planKey) return null;
  if (planKey === "week") return "WEEKLY";
  if (planKey === "month") return "MONTHLY";
  if (planKey === "year") return "YEARLY";
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature || "", webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleCustomerSubscriptionUpdated(subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleCustomerSubscriptionDeleted(subscription);
        break;
      }
      default:
        break;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  return NextResponse.json({});
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // IMPORTANT: align with your checkout metadata
  const userId =
    (session.metadata?.userId as string | undefined) ??
    (session.metadata?.clerkUserId as string | undefined);

  if (!userId) {
    console.log("No user id on session metadata");
    return;
  }

  const subscriptionId = session.subscription as string | null;
  if (!subscriptionId) {
    console.log("No subscription id on session");
    return;
  }

  // Prefer planType from metadata, fall back to price->tier
  let tier: Tier = tierFromPlanKey(session.metadata?.planType ?? null);

  if (!tier) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });
      const priceId = sub.items.data[0]?.price?.id ?? null;
      tier = tierFromPrice(priceId);
    } catch (e: any) {
      console.log("Failed to fetch sub for tier:", e.message);
    }
  }

  try {
    await prisma.profile.update({
      where: { userId },
      data: {
        stripeSubscriptionId: subscriptionId,
        subscriptionActive: true,
        subscriptionTier: tier,
      },
    });
  } catch (err: any) {
    console.log(err.message);
  }
}

async function handleCustomerSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subId = subscription.id;
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const tier = tierFromPrice(priceId);
  const isActive = subscription.status === "active" || subscription.status === "trialing";

  let userId: string | undefined;
  try {
    const profile = await prisma.profile.findFirst({
      where: { stripeSubscriptionId: subId },
      select: { userId: true },
    });
    if (!profile?.userId) {
      console.log("No profile found for subscription.updated");
      return;
    }
    userId = profile.userId;
  } catch (err: any) {
    console.log(err.message);
    return;
  }

  try {
    await prisma.profile.update({
      where: { userId },
      data: {
        subscriptionActive: isActive,
        subscriptionTier: tier,
      },
    });
  } catch (err: any) {
    console.log(err.message);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Stripe types changed; subscription is still present at runtime
  // @ts-expect-error: Stripe types don't expose 'subscription' but it exists in payload
  const subId = (invoice.subscription as string | null) ?? null;
  if (!subId) return;

  let userId: string | undefined;
  try {
    const profile = await prisma.profile.findFirst({
      where: { stripeSubscriptionId: subId },
      select: { userId: true },
    });
    if (!profile?.userId) {
      console.log("No profile found for failed invoice");
      return;
    }
    userId = profile.userId;
  } catch (err: any) {
    console.log(err.message);
    return;
  }

  try {
    await prisma.profile.update({
      where: { userId },
      data: { subscriptionActive: false },
    });
  } catch (err: any) {
    console.log(err.message);
  }
}

async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subId = subscription.id;

  let userId: string | undefined;
  try {
    const profile = await prisma.profile.findFirst({
      where: { stripeSubscriptionId: subId },
      select: { userId: true },
    });
    if (!profile?.userId) {
      console.log("No profile found for deleted subscription");
      return;
    }
    userId = profile.userId;
  } catch (err: any) {
    console.log(err.message);
    return;
  }

  try {
    await prisma.profile.update({
      where: { userId },
      data: {
        subscriptionActive: false,
        stripeSubscriptionId: null,
        subscriptionTier: null,
      },
    });
  } catch (err: any) {
    console.log(err.message);
  }
}

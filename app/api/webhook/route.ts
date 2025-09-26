// app/api/webhook/route.ts
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        // ignore others
        break;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  return NextResponse.json({});
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.clerkUserId; // <- fixed key
  if (!userId) {
    console.log("No user id on session metadata");
    return;
  }

  const subscriptionId = session.subscription as string | null;
  if (!subscriptionId) {
    console.log("No subscription id on session");
    return;
  }

  try {
    await prisma.profile.update({
      where: { userId },
      data: {
        stripeSubscriptionId: subscriptionId,
        subscriptionActive: true,
        subscriptionTier: (session.metadata?.planType as any) || null,
      },
    });
  } catch (err: any) {
    console.log(err.message);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = invoice.subscription as string | null;
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



// import { prisma } from "@/lib/prisma";
// import { stripe } from "@/lib/stripe";
// import { error } from "console";
// import { NextRequest, NextResponse } from "next/server";
// import Stripe from "stripe";

// export async function POST(request: NextRequest) {
//     const body = await request.text();
//     const signature = request.headers.get("Stripe-signature");

//     const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

//     let event: Stripe.Event;

//     try {
//         event = stripe.webhooks.constructEvent(body, 
//         signature || "", 
//         webhookSecret
//         );
//     } catch (error: any) {
//         return NextRequest.json({ error: error.message }, { status: 400 });
//     }
//         try { 
//     switch (event.type) {
//         case "Checkout.session.completed": {
//             const session = event.data.object as Stripe.Checkout.Session;
//             await handleCheckoutSessionCompleted(session);
//             break;
//         }
//         case "invoice.payment_failed": {
//             const session = event.data.object as Stripe.Invoice;
//             await handleInvoicePaymentFailed(session);
//             break;
//         }
//         case "customer.subscription.deleted": {
//             const session = event.data.object as Stripe.Subscription;
//             await handleCustomerSubscriptionDeleted(session);
//             break;
//         }
//         default:
//             console.log("Unhandled event type" + event.type);
//     }

// }   catch (error: any) {
//     return NextResponse.json({ error: error.message }, { status: 400 });
// }

//     return NextResponse.json({});
// }

// async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
//     const userId = session.metadata?.cleckUserId;

//     if (!userId) {
//         console.log("No user id");
//         return
//     }

//     const subscriptionId = session.subscription as string
//     if (!userId) {
//         console.log("No sub id");
//         return
//     }

//     try {
//         await prisma.profile.update({
//             where: {userId},
//             data: {
//                 stripeSubscriptionId: subscriptionId,
//                 subscriptionActive: true,
//                 subscriptionTier: session.metadata?.planType || null
//             }
//         });
//     }   catch {
//         console.log(error.message);
//     }
// }

// async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
//     const subId = invoice.subscription as string;
    
//     if (!subId) {
//         return
//     }

//     let userId: string | undefined
//     try {
//         const profile = await prisma.profile.findUnique({
//             where: {
//                 stripeSubscriptionId: subId
//             }, select: {
//                 userId: true
//             },
//         });

//         if (!profile?.userId) {
//             console.log("No profile found");
//             return;
//         }
//         userId = profile.userId;
//     } catch (error: any) {
//         console.log(error.message);
//         return;
//     }
//     try {
//         await prisma.profile.update({
//             where: { userId: userId},
//             data: {
//                 subscriptionActive: false,
//             },
//         });
//     } catch (error: any) {
//         console.log(error.message);
//     }
// }

// async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription

// ) {
//     const subId = subscription.id;
    
//     let userId: string | undefined
//     try {
//         const profile = await prisma.profile.findUnique({
//             where: {
//                 stripeSubscriptionId: subId
//             }, select: {
//                 userId: true
//             },
//         });

//         if (!profile?.userId) {
//             console.log("No profile found");
//             return;
//         }
//         userId = profile.userId;
//     } catch (error: any) {
//         console.log(error.message);
//         return;
//     }
//     try {
//         await prisma.profile.update({
//             where: { userId: userId},
//             data: {
//                 subscriptionActive: false,
//                 stripeSubscriptionId: null,
//                 subscriptionTier: null,
//             },
//         });
//     } catch (error: any) {
//         console.log(error.message);
//     }
// }

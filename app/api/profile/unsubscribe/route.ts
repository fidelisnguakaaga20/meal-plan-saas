import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // get user's profile
    const profile = await prisma.profile.findUnique({
      where: { userId: clerkUser.id },
      select: { stripeSubscriptionId: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "No Profile Found" }, { status: 404 });
    }

    if (!profile.stripeSubscriptionId) {
      return NextResponse.json({ error: "No Active Subscription Found" }, { status: 400 });
    }

    const subscriptionId = profile.stripeSubscriptionId;

    // (optional) retrieve if you need to inspect
    // const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // cancel at period end (safer)
    const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // reflect in DB
    await prisma.profile.update({
      where: { userId: clerkUser.id },
      data: {
        subscriptionTier: null,
        stripeSubscriptionId: null,
        subscriptionActive: false,
      },
    });

    return NextResponse.json({ subscription: canceledSubscription });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}


// import { currentUser } from "@clerk/nextjs/server";
// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// export async function GET() {
//   try {
//     const clerkUser = await currentUser();
//     if (!clerkUser?.id) {
//       return NextResponse.json({ error: "Unauthorized" });
//     }

//     const profile = await prisma.profile.findUnique({
//       where: { userId: clerkUser.id },
//       select: { subscriptionTier: true },
//     });

//     if (!profile) {
//       return NextResponse.json({ error: "No Profile Found" });
//     }

//     return NextResponse.json({ subscription: profile });
//   } catch (error: any) {
//     return NextResponse.json({ error: "Internal Error" }, { status: 500 });
//   }
// }

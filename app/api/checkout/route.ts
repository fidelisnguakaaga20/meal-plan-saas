// import { getPriceIdFromType } from "@/lib/plans";
// import { stripe } from "@/lib/stripe";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(request: NextRequest); {
//     try { 
//     if (!planType || !userId || !email) {
//         return NextResponse.json(
//             {
//                 error: "Plan type, user id, email are required.",
//             },
//             { status: 400 }
//         );
//     }
//     const allowedPlanTypes = ["week", "month", "year"]

//     if (!allowedPlanTypes.includes(planType)) {
//          return NextResponse.json(
//             {
//                 error: "Invalid plan type.",
//             },
//             { status: 400 }
//         );
//     }

//     const priceId = getPriceIdFromType(planType)

//     if (!priceId) {
//         return NextResponse.json(
//             {
//                 error: "Invalid price id.",
//             },
//             { status: 400 }
//         );
//     }

//     const session = await stripe.checkout.sessions.create({
//         payment_method_types: ["card"],
//         line_items: [
//             {
//                 price: priceID,
//                 quantity: 1,
//             },
//         ],
//         customer_email: email,
//         mode: "subscription",
//         metadata: { cleckUserId: userId, planType },
//         success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/subscribe`,
//     });

//     return NextResponse.json({ url: session.url });
//     } catch (error: any) {
//         return NextResponse.json({error: "Internal Server Error."}, {status: 500})
//     }
// }

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
        ? process.env.STRIPE_PRICE_WEEK
        : planType === "month"
        ? process.env.STRIPE_PRICE_MONTH
        : process.env.STRIPE_PRICE_YEAR;

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


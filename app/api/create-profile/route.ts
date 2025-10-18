/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Idempotent profile creation: ensures a Profile row exists for the signed-in user.
 * No-op if it already exists. Returns 200 with a stable payload.
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pull email from Clerk (optional fallback)
    const u = await currentUser();
    const email =
      u?.primaryEmailAddress?.emailAddress ??
      u?.emailAddresses?.[0]?.emailAddress ??
      null;

    // Ensure row exists; keep idempotent and DO NOT use non-existent fields (e.g., name)
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        // don’t overwrite subscription fields here
        email: email ?? undefined,
      },
      create: {
        userId,
        email: email ?? "",
        subscriptionActive: false,
        subscriptionTier: null,
        stripeSubscriptionId: null,
      },
      select: {
        userId: true,
        email: true,
        subscriptionActive: true,
        subscriptionTier: true,
        stripeSubscriptionId: true,
      },
    });

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, warning: err?.message ?? "Internal error creating profile." },
      { status: 200 }
    );
  }
}


// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

// import { currentUser } from "@clerk/nextjs/server";
// import { prisma } from "@/lib/prisma";
// import { NextResponse } from "next/server";

// export async function POST() {
//   try {
//     const clerkUser = await currentUser();
//     if (!clerkUser) {
//       return NextResponse.json(
//         { error: "User not found in Clerk" },
//         { status: 404 }
//       );
//     }

//     const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
//     if (!email) {
//       return NextResponse.json(
//         { error: "User does not have an email address" },
//         { status: 400 }
//       );
//     }

//     const existingProfile = await prisma.profile.findUnique({
//       where: { userId: clerkUser.id },
//     });

//     if (existingProfile) {
//       return NextResponse.json(
//         { message: "Profile already exists." },
//         { status: 200 }
//       );
//     }

//     await prisma.profile.create({
//       data: {
//         userId: clerkUser.id,
//         email,
//         subscriptionTier: null,
//         stripeSubscriptionId: null,
//         subscriptionActive: false,
//       },
//     });

//     return NextResponse.json(
//       { message: "Profile created successfully." },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error(error);
//     return NextResponse.json(
//       { error: "Internal error." },
//       { status: 500 }
//     );
//   }
// }

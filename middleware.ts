/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Make /mealplan public so the generator form is reachable (no forced redirect to /subscribe)
const isPublicRoute = createRouteMatcher([
  "/",
  "/favicon.ico",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/subscribe(.*)",
  "/mealplan(.*)",
  // public APIs
  "/api/generate-mealplan(.*)",
  "/api/db-health(.*)",
  "/api/check-openai(.*)",
  "/api/check-subscription(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;

  // Allow Clerk handshake
  if (url.searchParams.has("__clerk_handshake")) {
    return NextResponse.next();
  }

  const { userId } = await auth();

  // If not signed in and route is not public => redirect to sign-up
  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL("/sign-up", url.origin));
  }

  // Removed the old /mealplan subscription gate.
  // Users can open /mealplan; paid gating can be enforced in API routes instead.

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next internals & static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};



// /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
// import { NextResponse } from "next/server";

// const isPublicRoute = createRouteMatcher([
//   "/",
//   "/favicon.ico",
//   "/sign-in(.*)",        // ✅ add this
//   "/sign-up(.*)",
//   "/subscribe(.*)",
//   // public APIs
//   "/api/generate-mealplan(.*)",
//   "/api/db-health(.*)",
//   "/api/check-openai(.*)",
// ]);

// const isMealPlanRoute = createRouteMatcher(["/mealplan(.*)"]);

// export default clerkMiddleware(async (auth, req) => {
//   const url = req.nextUrl;

//   // Let Clerk handshake pass
//   if (url.searchParams.has("__clerk_handshake")) {
//     return NextResponse.next();
//   }

//   const { userId } = await auth();

//   // If not signed in and route is not public => go to sign-up
//   if (!isPublicRoute(req) && !userId) {
//     return NextResponse.redirect(new URL("/sign-up", url.origin));
//   }

//   // Only protect /mealplan with subscription check
//   if (isMealPlanRoute(req)) {
//     if (!userId) {
//       return NextResponse.redirect(new URL("/sign-up", url.origin));
//     }
//     try {
//       const resp = await fetch(`${url.origin}/api/check-subscription?userId=${userId}`, {
//         headers: { "x-mw": "1" },
//       });
//       const data = await resp.json();
//       if (!data?.subscriptionActive) {
//         return NextResponse.redirect(new URL("/subscribe", url.origin));
//       }
//     } catch {
//       return NextResponse.redirect(new URL("/subscribe", url.origin));
//     }
//   }

//   return NextResponse.next();
// });

// export const config = {
//   matcher: [
//     // Skip Next internals & static files
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// };

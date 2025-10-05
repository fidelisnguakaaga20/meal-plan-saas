/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = !!process.env.OPENAI_API_KEY;
  return NextResponse.json(
    {
      ok: hasKey,
      hasOPENAI: hasKey,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? null,
      note: hasKey ? "OPENAI_API_KEY detected" : "OPENAI_API_KEY is missing"
    },
    { status: hasKey ? 200 : 500 }
  );
}

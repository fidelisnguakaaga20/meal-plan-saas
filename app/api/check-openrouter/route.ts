export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const has = !!process.env.OPENROUTER_API_KEY;
  return NextResponse.json({
    ok: has,
    model: process.env.OPENROUTER_MODEL || "openrouter/openai/gpt-4o-mini",
  });
}

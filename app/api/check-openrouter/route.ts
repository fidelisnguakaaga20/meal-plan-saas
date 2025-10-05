/* Simple env check */
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasOpenrouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY);
  const hasAny = hasOpenrouter || hasOpenai;
  return NextResponse.json({
    hasKey: hasAny,
    hasOpenrouter,
    hasOpenai,
  });
}

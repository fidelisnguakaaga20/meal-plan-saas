export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  const base = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  if (!key) return NextResponse.json({ ok: false, error: "No API key" }, { status: 500 });

  const r = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  return NextResponse.json({ ok: r.ok, status: r.status });
}

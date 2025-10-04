/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const row = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    const ok = Array.isArray(row) && row[0]?.ok === 1;
    return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
  } catch (err: any) {
    console.error("DB health error:", err);
    return NextResponse.json({ ok: false, error: "DB connection failed" }, { status: 500 });
  }
}

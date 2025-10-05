/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function cleanToJson(text: string): string {
  let t = (text ?? "").trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  t = t.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  t = t.replace(/,(\s*[}\]])/g, "$1");
  return t;
}
function coerceDays(obj: any, days = 7): Record<string, any> {
  if (!obj || typeof obj !== "object") return {};
  const result: Record<string, any> = {};
  const hasAllNames = DAY_NAMES.every((d) => Object.prototype.hasOwnProperty.call(obj, d));
  if (hasAllNames) {
    for (const name of DAY_NAMES.slice(0, days)) result[name] = obj[name];
    return result;
  }
  let i = 0;
  for (const key of Object.keys(obj)) {
    if (i >= days) break;
    result[DAY_NAMES[i]] = obj[key];
    i++;
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in environment." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      dietType = "Balanced",
      calories = 2000,
      allergies = "",
      cuisine = "",
      snacks = false,
      days = 7,
    } = body ?? {};

    const prompt = `
You are a professional nutritionist.

Create a ${days}-day meal plan for a person following a "${dietType}" diet, targeting ${calories} calories/day.
Allergies/restrictions: ${allergies || "none"}.
Preferred cuisine: ${cuisine || "no preference"}.
Include snacks: ${snacks ? "yes" : "no"}.

Return a STRICT JSON object (no markdown, no comments, no prose) with exactly these keys:
${DAY_NAMES.slice(0, days).map((d) => `- "${d}"`).join("\n")}

Each day must contain (string values):
- "Breakfast"
- "Lunch"
- "Dinner"
${snacks ? `- "Snacks"` : ""}

Example for one day ONLY (do not include this example in your final output):
{
  "Monday": {
    "Breakfast": "Oatmeal with banana - 350 calories",
    "Lunch": "Quinoa salad with chickpeas - 500 calories",
    "Dinner": "Tofu stir-fry with vegetables - 600 calories"${snacks ? `,
    "Snacks": "Apple with peanut butter - 200 calories"` : ""}
  }
}

Now produce JSON for ${days} days using the requested keys. Output ONLY valid JSON, no code fences.
`.trim();

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const text = cleanToJson(raw);

    let mealPlanObj: any;
    try {
      mealPlanObj = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON. Please try again." },
        { status: 502 }
      );
    }

    const normalized = coerceDays(mealPlanObj, days);
    return NextResponse.json({ mealPlan: normalized });
  } catch (err: any) {
    console.error("generate-mealplan error:", err?.response ?? err);
    const msg = err?.response?.data?.error || err?.message || "Internal Error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

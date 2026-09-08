import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { currentPerson } from "../../../../lib/auth";

const PROMPT =
  "Photo of a snack or food item an athlete is logging for nutrition tracking. " +
  "Identify the food(s) shown and estimate nutrition for the portion pictured. " +
  "Reply with ONLY a JSON object, no other text: " +
  '{"description": string, "calories": number, "proteinG": number, "carbsG": number, ' +
  '"fatG": number, "confidence": "low"|"medium"|"high", "assumptions": string (one short sentence)}.';

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Photo estimates aren't set up yet (ANTHROPIC_API_KEY missing) — log manually below." },
      { status: 500 }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const file = formData.get("photo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No photo attached" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo is too large (max ~15MB)" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = file.type || "image/jpeg";

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      // Check https://docs.claude.com/en/docs/about-claude/models for the
      // current model lineup if this one's since been superseded.
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PROMPT }
          ]
        }
      ]
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json({ error: "Got an answer but couldn't read it — try again.", raw: text }, { status: 502 });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: "Estimate failed: " + e.message }, { status: 502 });
  }
}

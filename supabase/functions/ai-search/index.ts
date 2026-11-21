import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";



function buildPrompt() {
  const tz = "America/Toronto";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const weekday = new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long" });

  return `You translate a person's sentence into search filters for an app that finds
group activities. You do not recommend places and you never invent activities.

Today is ${weekday}, ${today}.

Return ONLY a JSON object, with no other text and no code fences, in exactly this shape:
{"activity": string or null, "date": "YYYY-MM-DD" or null,
 "time_from": "HH:MM" or null, "time_to": "HH:MM" or null, "vibe": string or null}

Rules:
- activity: one short lowercase word (basketball, walk, chess, study).
  If the person names none, use null.
- If several activities are named, use only the first one.
- date: turn words like "tomorrow" or "Friday" into a real date using today's
  date above. "Friday" means the next upcoming Friday.
- If the named weekday is today, use the same weekday next week,
  unless the person says "today" or "tonight".
- time of day: morning = 08:00 to 12:00, afternoon = 12:00 to 17:00,
  evening = 17:00 to 21:00.
- exact time: time_from is that time and time_to is one hour later.
- If the hour has no am/pm:
  1 to 7 means pm (13:00 to 19:00),
  8 to 11 means am (08:00 to 11:00),
  12 means 12:00.
  If it says pm or am, follow it ("8pm" means 20:00).
- vibe: a mood such as "relaxing" or "meet people". Otherwise null.
- If you are unsure about any field, use null. Never guess.
- The sentence may be in English or French and may contain typos.`;
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    const { text } = await req.json();

    const model = "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const aiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": Deno.env.get("LLM_API_KEY")!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildPrompt() }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!aiResponse.ok) {
      return Response.json(
        { error: "AI call failed", status: aiResponse.status, details: await aiResponse.text() },
        { status: 502 },
      );
    }

    const data = await aiResponse.json();
    const filters = JSON.parse(data.candidates[0].content.parts[0].text);

    return Response.json({ filters });
  }),
};
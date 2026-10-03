import Groq from "groq-sdk";

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { diffs } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GROQ_API_KEY" }), { status: 500 });
    }

    const groq = new Groq({ apiKey });

    // We only send the old/new text to save tokens and focus the AI
    const payload = diffs.map((d, i) => ({
      id: i,
      oldText: d.oldText,
      newText: d.newText
    }));

    const prompt = `You are an expert legal contract analyzer. I am providing you with a list of clauses that have changed between two versions of a contract.
For each changed clause, you must:
1. Determine if the change is "major" (changes the legal meaning, obligations, or substance) or "minor" (typos, formatting, slight rewording).
2. Write a 1-sentence plain-language summary explaining exactly what changed in substance.

You MUST output valid JSON exactly matching this structure:
{
  "results": [
    { "significance": "major" | "minor", "summary": "Plain language explanation here." }
  ]
}
Note: Ensure the array length exactly matches the input length of ${payload.length}.

Input Clauses:
${JSON.stringify(payload)}`;

    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const rawOutput = response.choices[0].message.content || "";
    let jsonString = rawOutput;
    const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonString = jsonMatch[1];
    
    const parsed = JSON.parse(jsonString);
    
    return new Response(JSON.stringify(parsed.results || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("Compare API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

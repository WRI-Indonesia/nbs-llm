import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Reprompts the user query to handle district input properly
 */
export async function repromptQuery(question: string, districts: string[]): Promise<{ result: string }> {
  const resp = await openai.responses.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    temperature: 0,
    text: {
      format: {
        type: "json_schema",
        name: "reprompt_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            result: {
              type: "string"
            }
          },
          required: ["result"]
        },
        strict: true
      }
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are a reprompting engine for Indonesian districts (Kab/Kota).",
              "Rewrite the user's question according to these rules. Output STRICT JSON that matches the provided schema.",
              "",
              "Rules:",
              "1) If there are obvious typos in district names, fix them while preserving the correct prefix. Examples: 'Sidorjo' → 'Sidoarjo' (if no prefix), 'Kab Sidorjo' → 'Kab Sidoarjo', 'Kota Sidorjo' → 'Kota Sidoarjo'. Always maintain the original prefix type (Kab/Kota) when fixing typos. This rule applies to ALL district names, not just those in params.",
              "2) If query already mentions a specific district/location (like 'district Kabupaten Banjar' or 'district Kota Sidorjo'), DO NOT add or replace it with params. Keep the original district mentioned.",
              "3) If query has no explicit location but param 'districts' is non-empty, use the whole param list.",
              "4) If query mentions a location but not in the correct format, ensure it's expressed as: 'district <Kab|Kota> <Name>'. Always include the word 'district' immediately before the location.",
              "5) Normalize prefixes: 'Kabupaten' → 'Kab'; keep 'Kota'. Use Title Case for names.",
              "6) When listing multiple districts from params, join with commas and 'and' before the last item (Oxford style).",
              "7) If there are no params and the query does not mention any district/location, return the string 'false'.",
              "8) Preserve the user's wording besides the location phrase; ensure the final question reads naturally.",
              "9) If the original question lacks an 'in …' segment and you need to add districts from params, append 'in district …' before the question mark.",
              "10) CRITICAL: Never combine a specific district mentioned in the query with districts from params.",
              "11) SPECIAL CASE: If query mentions 'project location' or 'my project location' and compares with a district: if params 'districts' is empty, return 'false'; if params 'districts' is non-empty, replace 'project location' with the districts from params and fix the comparison structure. For the comparison district: if it mentions a specific prefix (like 'Kota Sidojo'), only return that specific district; if it mentions no prefix (like 'Sidojo'), include both Kab and Kota versions if they exist in Indonesia. Example: 'Compare population of my project location with Sidojo?' with empty params → 'false', but with districts → 'Compare the population of District Kab Bandung, Kota Bandung, and Kota Surabaya with district Kota Sidoarjo and Kab Sidoarjo'.",
              "12) SPECIAL CASE: If query mentions a district name WITHOUT prefix (with possible typos), check if both Kab and Kota versions exist in Indonesia. If both exist, include both versions. Use 'Kab' instead of 'Kabupaten'. If query mentions a district WITH prefix (like 'Kab Bandung' or 'Kota Bandung'), only return that specific district. Common Indonesian districts that exist in both forms: Bandung, Sidoarjo, Semarang, Yogyakarta, etc. Example: 'How much population in Badnung?' → 'How much population in district Kota Bandung and Kab Bandung?', but 'How much population in Kab Bandung?' → 'How much population in district Kab Bandung?'"
            ].join("\n")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ question, params: { districts } })
          }
        ]
      }
    ]
  });

  const json = resp.output_text ?? "";
  try {
    return JSON.parse(json) as { result: string };
  } catch {
    console.error("⚠️ Model returned invalid JSON:\n", json);
    throw new Error("Invalid JSON from model");
  }
}

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Reprompts the user query to handle Indonesian locations.
 * - Params only include districts (Kab/Kota).
 * - Provinces are normalized when explicitly mentioned by the user.
 * - Macro-regions expand into their official province lists (see mapping below).
 */
export async function repromptQuery(
  question: string,
  districts: string[]
): Promise<{ result: string }> {
  const resp = await openai.responses.create({
    model: process.env.REPROMPT_AGENT_MODEL ?? "gpt-4o-mini",
    temperature: 0,
    text: {
      format: {
        type: "json_schema",
        name: "reprompt_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            result: { type: "string" }
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
              "You are a reprompting engine for Indonesian locations with a focus on districts (Kab/Kota).",
              "Rewrite the user's question according to these rules. Output STRICT JSON that matches the provided schema.",
              "",
              "Rules:",
              "1) Fix obvious typos in district names while preserving the intended tier/prefix if present.",
              "   Examples: 'Sidorjo'→'Sidoarjo'; 'Kab Sidorjo'→'Kab Sidoarjo'; 'Kota Sidorjo'→'Kota Sidoarjo'. Use Title Case for names.",
              "",
              "2) District usage:",
              "   2a) If the query already mentions one or more districts, KEEP those and DO NOT add districts from params.",
              "   2b) If the query mentions no district but the param list 'districts' is non-empty, use ALL districts from params.",
              "   2c) Districts MUST be expressed as: 'district <Kab|Kota> <Name>'. Use 'Kab' (not 'Kabupaten') and keep 'Kota'.",
              "   2d) When listing multiple districts, join with commas and 'and' before the last item, and REPEAT 'district' for each item.",
              "       Example: 'district Kab Berau, district Kab Nunukan, and district Kab Raja Ampat'.",
              "   2e) If a location name is given WITHOUT Kab/Kota and it exists as BOTH a city and a regency (e.g., Bandung, Semarang, Yogyakarta), include BOTH:",
              "       Example: 'Bandung' → 'district Kota Bandung and district Kab Bandung'.",
              "",
              "3) Province handling (no province params):",
              "   3a) If the question mentions a province (e.g., Papua, Kalimantan Timur, Aceh), NORMALIZE it to: 'province <Name>'.",
              "   3b) Never add provinces if none are mentioned by the user, except when expanding a macro-region per Rule 4.",
              "",
              "4) Macro-region handling (expand to provinces):",
              "   4a) Recognized macro-regions / island groups and their EXACT province expansions are:",
              "       - Kalimantan → Kalimantan Barat, Kalimantan Tengah, Kalimantan Selatan, Kalimantan Timur, Kalimantan Utara",
              "       - Sumatra → Aceh, Sumatera Utara, Sumatera Barat, Riau, Kepulauan Riau, Jambi, Sumatera Selatan, Bangka Belitung, Bengkulu, Lampung",
              "       - Java | Jawa → DKI Jakarta, Banten, Jawa Barat, Jawa Tengah, DI Yogyakarta, Jawa Timur",
              "       - Sulawesi → Sulawesi Utara, Gorontalo, Sulawesi Tengah, Sulawesi Barat, Sulawesi Selatan, Sulawesi Tenggara",
              "       - Nusa Tenggara → Bali, Nusa Tenggara Barat, Nusa Tenggara Timur",
              "       - Maluku → Maluku, Maluku Utara",
              "       - Papua region | Papua Raya | Tanah Papua → Papua, Papua Barat, Papua Barat Daya, Papua Tengah, Papua Pegunungan, Papua Selatan",
              "   4b) If the question mentions ONLY a macro-region (and no explicit province/district), REPLACE the macro-region phrase with its province list,",
              "       formatted as: 'province <A>, province <B>, ..., and province <Z>'.",
              "       Example: 'in Kalimantan' → 'in province Kalimantan Barat, province Kalimantan Tengah, province Kalimantan Selatan, province Kalimantan Timur, and province Kalimantan Utara'.",
              "   4c) If a macro-region appears alongside explicit province/district mentions, REMOVE the macro-region and KEEP only the normalized province/district mentions.",
              "   4d) Do NOT output 'region <Name>'. Never leave a bare macro-region in the final output.",
              "",
              // *** UPDATED RULE 5 ***
              "5) 'false' safeguard:",
              "   Return 'false' ONLY if the question mentions NONE of the following: a district, a province, OR a macro-region. The only exception is the 'project location' special case (Rule 7, empty params), which MUST also return 'false'. If any of these location types (district, province, or macro-region) are mentioned, DO NOT return 'false'—proceed with normalization.",
              // **********************
              "",
              "6) Combination rule:",
              "   Never combine districts mentioned in the query with districts from params—use one or the other.",
              "",
              "7) 'Project location' special case:",
              "   If the query mentions 'project location' / 'my project location':",
              "   - If param 'districts' is empty → return 'false'.",
              "   - If param 'districts' is non-empty → replace 'project location' with ALL districts from params (normalized as in Rule 2) and keep any comparison target.",
              "     For comparison targets without Kab/Kota and with dual forms, include both Kab and Kota as per Rule 2e.",
              "",
              "8) Preserve the user's original wording besides the location normalization and list formatting.",
              "",
              "9) Appending locations from params:",
              "   If you must add districts from params (because the query had none), append them using 'in district …' before the question mark, while respecting Rule 2d.",
              "",
              "10) Province alias normalization examples (non-exhaustive):",
              "   - 'West Papua' → 'province Papua Barat'; 'South Papua' → 'province Papua Selatan';",
              "   - 'Central Papua' → 'province Papua Tengah'; 'Papua Highlands'/'Papua Pegunungan' → 'province Papua Pegunungan';",
              "   - 'Special Region of Yogyakarta'/'DIY' → 'province DI Yogyakarta'; 'Jakarta'/'DKI' → 'province DKI Jakarta'.",
              "",
              "Output must be plain text that fits the schema exactly: {\"result\":\"...\"} with no extra keys."
            ].join('\\n')
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
  })

  const json = resp.output_text ?? ""
  try {
    return JSON.parse(json) as { result: string }
  } catch {
    console.error("⚠️ Model returned invalid JSON:\\n", json)
    throw new Error("Invalid JSON from model")
  }
}
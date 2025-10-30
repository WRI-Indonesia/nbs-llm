import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generates SQL query using OpenAI based on relevant documents
 */
export async function generateSQLQuery(query: string, relevantDocs: string[]): Promise<string> {
    try {
        const text = relevantDocs.map(doc => `- ${doc}`).join('\n');

        const prompt = `
You are a SQL expert. Based on the following database schema information and the user's query, generate an appropriate SQL query.

User Query: "${query}"

Relevant Database Schema Information:
${text}

---

Instructions:
1. Generate a SQL query that correctly answers the user's question.
2. Use the table and column names exactly as provided in the schema.
3. Include appropriate JOINs if multiple tables are involved.
4. Use proper PostgreSQL syntax.
5. Use table names WITHOUT schema prefixes (all tables are in the public schema).
6. Return ONLY the raw SQL query — no markdown, code blocks, or explanations.
7. Use double quotes around table and column names for safety.
8. Do NOT include schema prefixes like "default." or "public.".
9. ALWAYS include \`LIMIT 10\` by default unless the query explicitly requests an aggregate or count.

---

### Column Handling Rules
10. **Text/VARCHAR Columns**
    - Use \`ILIKE\` for case-insensitive matching (e.g., \`WHERE "district_name" ILIKE '%Berau%'\`).
    - Never use \`ILIKE\` or \`LIKE\` on numeric or date columns.
11. **Numeric Columns**
    - Use standard comparison operators (\`=, >, <, >=, <=, BETWEEN\`).
    - When performing calculations or aggregations, **convert NULL numeric values to zero using \`COALESCE(column, 0)\`**.
      - ✅ Example: \`(COALESCE("mammal",0) + COALESCE("amphibi",0) + COALESCE("reptile",0)) AS "total_species"\`
      - ✅ Example: \`SUM(COALESCE("eligible_ecosystem_restoration_ha", 0)) AS total_area\`
12. **Date/Timestamp Columns**
    - Use expressions like \`EXTRACT(YEAR FROM column)\`, \`DATE_TRUNC('year', column)\`, or intervals such as \`column >= CURRENT_DATE - INTERVAL '10 years'\`.
13. **Location Filtering**
    - Apply geographic names (e.g., "Berau", "Mamberamo Tengah") **only** to location columns (district_name, province_name, region_name, etc.) using \`ILIKE\`.
      - ✅ Correct: \`WHERE "district_name" ILIKE '%Berau%'\`
      - 🚫 Incorrect: \`WHERE "eligible_ecosystem_restoration_ha" ILIKE '%Berau%'\`

---

### Additional Guidance
14. Always ensure arithmetic or aggregate expressions involving numeric fields use \`COALESCE\` to prevent NULL results.
15. Maintain clean, executable SQL that can run directly in PostgreSQL without modification.

---

SQL Query:`

        const completion = await openai.chat.completions.create({
            model: process.env.SQL_GENERATOR_AGENT_MODEL ?? "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a SQL expert. Generate accurate SQL queries based on database schema information."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0,
            max_tokens: 1000
        })

        return completion.choices[0]?.message?.content?.trim() || ''
    } catch (error) {
        console.error('Error generating SQL query:', error)
        throw new Error('Failed to generate SQL query')
    }
}
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

Instructions:
1. Generate a SQL query that answers the user's question
2. Use the table and column names exactly as provided in the schema
3. Include appropriate JOINs if multiple tables are involved
4. Use proper PostgreSQL syntax
5. Use table names WITHOUT schema prefixes (tables are in the public schema)
6. Return ONLY the raw SQL query - NO markdown formatting, NO code blocks, NO explanations
7. Use double quotes around table and column names for safety
8. Do NOT wrap the query in code blocks or any other formatting
9. IMPORTANT: Do NOT use schema prefixes like "default" or any schema name - just use table names directly
10. ALWAYS make sure to include LIMIT, by default LIMIT 10 at the end of the query if the user's query is not a count query
11. Always use ILIKE instead of WHERE for text matching.
12. When using ILIKE, wrap the search term with %% (e.g., ILIKE '%pattern%'), ensuring the query matches parts of the text case-insensitively.

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
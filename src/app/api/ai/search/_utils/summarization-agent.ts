export type TokenUsage = {
    prompt: number
    completion: number
    total: number
    source: 'measured' | 'estimated'
}

export async function generateAnswer(userQuery: string, data: any[], context: any[]): Promise<{ text: string, usage: TokenUsage }> {
    // Define the new API endpoint and model
    const SEA_LLM_ENDPOINT = (process.env.SUMMARIZATION_MODEL_ENDPOINT || '').trim()
    const SEA_LLM_MODEL = (process.env.SUMMARIZATION_MODEL || '').trim()

    try {
        // Helper function to truncate text to approximate token limit
        // Rough estimate: 1 token ≈ 4 characters
        const truncateToTokens = (text: string, maxTokens: number): string => {
            const maxChars = maxTokens * 4
            if (text.length <= maxChars) return text
            return text.substring(0, maxChars - 3) + '...'
        }

        // Limit data rows to prevent token overflow
        // Take first 5 rows and truncate each row's string representation
        const limitedData = data.slice(0, 5).map(row => {
            const rowStr = JSON.stringify(row)
            return truncateToTokens(rowStr, 200) // ~200 tokens per row
        })

        // Limit context documents to prevent token overflow
        // Take first 3 documents and truncate each to ~500 tokens
        const limitedContext = context.slice(0, 3).map(doc => {
            return truncateToTokens(doc, 500)
        })

        // 1. Construct a detailed prompt that strongly integrates data and context
        const contextString = limitedContext.length > 0
            ? `\n\n--- Relevant Context (${limitedContext.length} snippets) ---\n${limitedContext.join('\n\n---\n\n')}`
            : "";

        const dataString = limitedData.length > 0
            ? `\n\n--- Current Query Data (${limitedData.length} rows) ---\n${JSON.stringify(limitedData, null, 2)}`
            : "";

        if (data.length === 0 && context.length === 0) {
            return { text: "No data found for this query", usage: { prompt: 0, completion: 0, total: 0, source: 'estimated' } };
        }

        const systemPrompt = "You are an expert researcher on Nature-Based Solutions. Keep your response SHORT, conversational, and friendly. You MUST use the provided 'Context' and 'Current Query Data' to formulate your answer.";

        const userMessage = `
Current question: ${userQuery}

${dataString}
${contextString}

Guidelines:
- Be conversational and friendly
- Base your entire answer on the provided data and context.
- Your short response:
`;

        // 2. Prepare the payload for the SeaLLM API
        const payload = {
            model: SEA_LLM_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.4,
            max_tokens: 1000
        };

        // 3. Make the API call using fetch
        const response = await fetch(SEA_LLM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Note: Check if the SeaLLM endpoint requires an Authorization header/API key.
                // If it does, you would need to add it here, e.g.:
                // 'Authorization': `Bearer ${process.env.SEA_LLM_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        const answer = (
            result.choices?.[0]?.message?.content?.trim() ||
            "Sorry, I got data back, but it was empty."
        )

        // approximate token usage
        const promptEst = Math.ceil((systemPrompt.length + userMessage.length) / 4)
        const completionEst = Math.ceil(answer.length / 4)
        const usage: TokenUsage = {
            prompt: promptEst,
            completion: completionEst,
            total: promptEst + completionEst,
            source: 'estimated'
        }
        // 4. Extract and return the answer
        return { text: answer, usage }

    } catch (error) {
        console.error("Error generating answer with SeaLLM:", error);
        return { text: "Sorry, couldn't analyze the data right now.", usage: { prompt: 0, completion: 0, total: 0, source: 'estimated' } }
    }
}
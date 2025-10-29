export async function generateAnswer(userQuery: string, data: any[], context: any[]): Promise<string> {
    // Define the new API endpoint and model
    const SEA_LLM_ENDPOINT = process.env.SUMMARIZATION_MODEL_ENDPOINT || ''
    const SEA_LLM_MODEL = process.env.SUMMARIZATION_MODEL || ''

    try {
        // 1. Construct a detailed prompt that strongly integrates data and context
        const contextString = context.length > 0
            ? `\n\n--- Relevant Context ---\n${JSON.stringify(context, null, 2)}`
            : "";

        const dataString = data.length > 0
            ? `\n\n--- Current Query Data ---\n${JSON.stringify(data, null, 2)}`
            : "";

        if (data.length === 0) {
            return "No data found for this query";
        }

        const systemPrompt = "You are an expert researcher on Nature-Based Solutions. Keep your response SHORT, conversational, and friendly. You MUST use the provided 'Context' and 'Current Query Data' to formulate your answer.";

        const userMessage = `
Current question: ${userQuery}

${dataString}
${contextString}

Guidelines:
- Keep it SHORT (2-5 sentences max)
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
            max_tokens: 500
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

        // 4. Extract and return the answer
        return (
            result.choices?.[0]?.message?.content?.trim() ||
            "Sorry, I got data back, but it was empty."
        );

    } catch (error) {
        console.error("Error generating answer with SeaLLM:", error);
        return "Sorry, couldn't analyze the data right now.";
    }
}
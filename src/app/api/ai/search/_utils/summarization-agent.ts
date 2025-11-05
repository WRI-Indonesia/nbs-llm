import { detectLanguageCode2 } from "@/lib/language-detector"

export type TokenUsage = {
    prompt: number
    completion: number
    total: number
    source: 'measured' | 'estimated'
}

type SeaLLMChoice = {
    message?: { content?: string }
}

type SeaLLMResponse = {
    choices?: SeaLLMChoice[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

const TOKENS_PER_CHAR = 1 / 4; // ~4 chars/token

function estimateTokens(str: string): number {
    return Math.ceil(str.length * TOKENS_PER_CHAR)
}

function truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = Math.max(0, Math.floor(maxTokens / TOKENS_PER_CHAR))
    if (text.length <= maxChars) return text
    return text.substring(0, Math.max(0, maxChars - 3)) + '...'
}

export async function generateAnswer(
    userQuery: string,
    data: any[] = [],
    context: any[] = [],
    endpoint?: string,
    model?: string
): Promise<{ text: string; usage: TokenUsage }> {
    const SEA_LLM_ENDPOINT = (endpoint || process.env.SUMMARIZATION_MODEL_ENDPOINT || '').trim()
    const SEA_LLM_MODEL = (model || process.env.SUMMARIZATION_MODEL || '').trim()

    if (!SEA_LLM_ENDPOINT || !SEA_LLM_MODEL) {
        return {
            text: "Configuration error: missing model endpoint or model name.",
            usage: { prompt: 0, completion: 0, total: 0, source: 'estimated' }
        }
    }

    try {
        // --- Limit inputs to avoid token overflow ---
        const limitedData = (data || []).slice(0, 5).map((row) => {
            const rowStr = (() => {
                try { return JSON.stringify(row) } catch { return String(row) }
            })()
            return truncateToTokens(rowStr, 200) // ~200 tokens per row
        })

        const limitedContext = (context || []).slice(0, 3).map((doc) => {
            const docStr = typeof doc === 'string' ? doc : (() => { try { return JSON.stringify(doc) } catch { return String(doc) } })()
            return truncateToTokens(docStr, 500)
        })

        if ((data?.length ?? 0) === 0 && (context?.length ?? 0) === 0) {
            return {
                text: "No data found for this query.",
                usage: { prompt: 0, completion: 0, total: 0, source: 'estimated' }
            }
        }

        // --- Detect language ---
        const detected = detectLanguageCode2(userQuery)
        const targetLanguageName = detected.name // e.g., "Indonesian"
        const targetLanguageCode = detected.code2 // e.g., "id"


        // --- Build prompt ---
        const contextString = limitedContext.length
            ? `\n\n--- Relevant Context (${limitedContext.length} snippets) ---\n${limitedContext.join('\n\n---\n\n')}`
            : ""

        const dataString = limitedData.length
            ? `\n\n--- Current Query Data (${limitedData.length} rows) ---\n${JSON.stringify(limitedData, null, 2)}`
            : ""

        const systemPrompt =
            "You are an expert researcher on Nature-Based Solutions. Keep responses SHORT, conversational, and friendly. " +
            "You MUST use the provided 'Context' and 'Current Query Data' to formulate your answer. " +
            `Critically important: reply **only** in ${targetLanguageName} (ISO-639-1: ${targetLanguageCode}). ` +
            "Do not switch languages unless explicitly told."

        const userMessage = `
  Current question: ${userQuery}
  
  ${dataString}
  ${contextString}
  
  Guidelines:
  - Be conversational and friendly.
  - Base your entire answer on the provided data and context.
  - Keep it concise (a short paragraph or bullet points).
  - Respond only in ${targetLanguageName}.
  Your short response:
  `.trim()

        // --- Prepare request payload ---
        const payload = {
            model: SEA_LLM_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.4,
            max_tokens: 1000
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (process.env.SEA_LLM_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.SEA_LLM_API_KEY}`
        }

        const response = await fetch(SEA_LLM_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            throw new Error(`API call failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`)
        }

        const result: SeaLLMResponse = await response.json().catch(() => ({} as SeaLLMResponse))
        const answer =
            result?.choices?.[0]?.message?.content?.trim() ||
            "Maaf, saya menerima respons kosong dari model." // keep this Indonesian-ish default; the main prompt should keep language consistent

        // Prefer measured usage if provided
        let usage: TokenUsage
        if (result?.usage?.prompt_tokens || result?.usage?.completion_tokens || result?.usage?.total_tokens) {
            const prompt_tokens = result.usage.prompt_tokens ?? estimateTokens(systemPrompt + userMessage)
            const completion_tokens = result.usage.completion_tokens ?? estimateTokens(answer)
            const total_tokens = result.usage.total_tokens ?? (prompt_tokens + completion_tokens)
            usage = {
                prompt: prompt_tokens,
                completion: completion_tokens,
                total: total_tokens,
                source: 'measured'
            }
        } else {
            const promptEst = estimateTokens(systemPrompt + userMessage)
            const completionEst = estimateTokens(answer)
            usage = {
                prompt: promptEst,
                completion: completionEst,
                total: promptEst + completionEst,
                source: 'estimated'
            }
        }

        return { text: answer, usage }
    } catch (error) {
        console.error("Error generating answer with SeaLLM:", error)
        return {
            text: "Sorry, couldn't analyze the data right now.",
            usage: { prompt: 0, completion: 0, total: 0, source: 'estimated' }
        }
    }
}
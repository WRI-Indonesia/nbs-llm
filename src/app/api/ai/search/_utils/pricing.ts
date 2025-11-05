export const OPENAI_PRICES: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.00060 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  'text-embedding-3-small': { prompt: 0.00002, completion: 0 },
  'text-embedding-3-large': { prompt: 0.00013, completion: 0 }
}

export function costUsdFor(modelName: string | undefined, promptTokens: number, completionTokens: number): number {
  if (!modelName) return 0
  const key = modelName.trim()
  const pricing = OPENAI_PRICES[key]
  if (!pricing) return 0
  // prices are USD per 1K tokens
  const promptRate = pricing.prompt / 1000
  const completionRate = pricing.completion / 1000
  return promptTokens * promptRate + completionTokens * completionRate
}



type RerankInput = {
  id: string
  text: string
}

type RerankResult = {
  id: string
  text: string
  score: number
}

const DEFAULT_MODEL = process.env.RERANK_MODEL_NAME || 'cross-encoder/ms-marco-MiniLM-L-6-v2'

async function scorePair(query: string, doc: string, hfApiToken: string, model: string): Promise<number> {
  const endpoint = `https://api-inference.huggingface.co/models/${model}`
  const payload = { inputs: { source_sentence: query, sentences: [doc] } }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hfApiToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`HF rerank request failed (${resp.status}): ${errText}`)
  }

  const data = await resp.json()
  // Model returns an array of scores corresponding to sentences
  // For single sentence, pick index 0
  if (Array.isArray(data) && typeof data[0] === 'number') return data[0]
  if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'number') return data[0][0]
  if (typeof data?.score === 'number') return data.score
  // Fallback conservative score
  return 0
}

export async function rerankDocuments(
  query: string,
  documents: RerankInput[],
  options?: { topN?: number; model?: string }
): Promise<RerankResult[]> {
  const enabled = (process.env.RERANK_ENABLED ?? 'true').toLowerCase() !== 'false'
  if (!enabled || documents.length === 0) {
    return documents.map(d => ({ ...d, score: 0 }))
  }

  const hfApiToken = (process.env.HF_API_TOKEN || '').trim()
  if (!hfApiToken) {
    // If token missing, skip reranking but keep flow working
    return documents.map((d, i) => ({ ...d, score: 0 - i * 1e-6 }))
  }

  const model = options?.model || process.env.RERANK_MODEL_NAME || DEFAULT_MODEL
  const scored: RerankResult[] = []

  for (const doc of documents) {
    try {
      const score = await scorePair(query, doc.text, hfApiToken, model)
      scored.push({ ...doc, score })
    } catch {
      // On failure, push with lowest score but do not break workflow
      scored.push({ ...doc, score: -1e9 })
    }
  }

  const sorted = scored.sort((a, b) => b.score - a.score)
  const topN = options?.topN ?? Math.min(20, sorted.length)
  return sorted.slice(0, topN)
}



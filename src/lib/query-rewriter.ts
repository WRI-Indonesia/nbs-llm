/**
 * Query Rewriting for Southeast Asian Languages
 * Handles: multi-part questions, stemming, query expansion, typos
 */

import OpenAI from 'openai'
import { stemSEAQuery, expandNbSQuery } from './sea-stemmer'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface RewrittenQuery {
  original: string
  refined: string
  stemmed: string
  questions: string[]
  isMultiQuestion: boolean
  language: string
}

/**
 * Detect if query contains multiple questions
 */
function detectMultipleQuestions(query: string): boolean {
  const questionCount = (query.match(/[?!]\s*/g) || []).length
  
  // Count question words (both English and Indonesian)
  const questionWords = [
    /\b(what|how|why|when|where|who|which|can|will|does|is)\b/gi,
    /\b(apa|bagaimana|mengapa|kapan|dimana|mana|bisakah|akankah|apakah)\b/gi,
    /\b(อย่างไร|อะไร|ที่ไหน|อย่างไร|ทำไม)\b/gi, // Thai
    /\b(như thế nào|gì|ở đâu|tại sao)\b/gi // Vietnamese
  ]
  
  let wordCount = 0
  for (const pattern of questionWords) {
    wordCount += (query.match(pattern) || []).length
  }
  
  // Multiple question marks or multiple question words indicate multi-part query
  return questionCount > 1 || wordCount > 1
}

/**
 * Split multi-part query into individual questions
 */
export function splitIntoQuestions(query: string): string[] {
  if (!detectMultipleQuestions(query)) {
    return [query]
  }

  // Split on question marks, conjunctions, and common separators
  const separators = /[.!?]\s+|;\s+|dan\s+|and\s+|also\s+|,\s*(?=what|how|why|apa|bagaimana|bagaimana)/gi
  const parts = query.split(separators)
  
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 10) // Filter out very short fragments
}

/**
 * Rewrite multi-part questions into comprehensive search query
 */
async function rewriteMultiPartQuery(questions: string[], language: string): Promise<string> {
  const prompt = language === 'id' 
    ? `Anda adalah pakar perbaikan query. Gabungkan pertanyaan-pertanyaan ini menjadi SATU query pencarian yang komprehensif untuk basis pengetahuan tentang Nature-Based Solutions dan data lingkungan.

Pertanyaan:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Buat query tunggal yang:
1. Mengatasi SEMUA pertanyaan dalam satu query
2. Memasukkan semua konsep kunci dari setiap pertanyaan
3. Menggunakan terminologi teknis
4. Fokus pada: hutan, restorasi, karbon, ekosistem, keanekaragaman hayati, dampak lingkungan
5. Maksimal 30 kata
6. HANYA kembalikan query, tanpa penjelasan

Query Terpadu:`
    
    : `You are a query refinement expert. Rewrite these questions into ONE comprehensive search query for a knowledge base about Nature-Based Solutions and environmental data.

Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Create a unified query that:
1. Addresses ALL questions in one query
2. Includes all key concepts from each question
3. Uses technical terminology
4. Focuses on: forest, restoration, carbon, ecosystem, biodiversity, environmental impact
5. Maximum 30 words
6. Return ONLY the query, no explanations

Unified Query:`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Expert query rewriting for scientific databases.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 100
  })

  return response.choices[0]?.message?.content?.trim() || questions.join(' ')
}

/**
 * Main query rewriting function
 */
export async function rewriteQueryForRetrieval(query: string): Promise<RewrittenQuery> {
  try {
    // 1. Extract questions
    const questions = splitIntoQuestions(query)
    const isMultiQuestion = questions.length > 1
    
    console.log(`📝 Query Analysis:`)
    console.log(`  Is multi-part: ${isMultiQuestion}`)
    console.log(`  Questions: ${questions.length}`)
    
    // 2. Stem the query to identify language
    const stemming = await stemSEAQuery(query)
    const language = stemming.language
    
    console.log(`  Language: ${language}`)
    
    // 3. Rewrite query if multi-part, otherwise just expand with synonyms
    let refined: string
    
    if (isMultiQuestion && questions.length > 1) {
      refined = await rewriteMultiPartQuery(questions, language)
    } else {
      // Single question - expand with domain-specific synonyms
      refined = expandNbSQuery(query, language)
    }
    
    // 4. Re-stem the refined query
    const refinedStemmed = await stemSEAQuery(refined)
    
    console.log(`  Original: ${query}`)
    console.log(`  Refined: ${refined}`)
    console.log(`  Stemmed: ${refinedStemmed.stemmed}`)
    
    return {
      original: query,
      refined,
      stemmed: refinedStemmed.stemmed,
      questions,
      isMultiQuestion,
      language
    }
  } catch (error) {
    console.error('Error rewriting query:', error)
    // Fallback to original query
    return {
      original: query,
      refined: query,
      stemmed: query,
      questions: [query],
      isMultiQuestion: false,
      language: 'id'
    }
  }
}


/**
 * Southeast Asian Language Detection and Processing
 * Supports: Indonesian, Malay, Thai, Vietnamese, Myanmar, Khmer, Lao
 */

import natural from 'natural'

export interface SEALanguageInfo {
  code: string  // Language code (id, ms, th, vi, my, kh, lo)
  name: string  // Language name
  hasStemming: boolean  // Whether stemming is supported
  stemmer?: any  // Stemmer instance if available
}

// SEA Language Codes
export const SEA_LANGUAGES = {
  'id': { name: 'Indonesian', hasStemming: true },
  'ms': { name: 'Malay', hasStemming: true },
  'th': { name: 'Thai', hasStemming: false },
  'vi': { name: 'Vietnamese', hasStemming: false },
  'my': { name: 'Myanmar', hasStemming: false },
  'kh': { name: 'Khmer', hasStemming: false },
  'lo': { name: 'Lao', hasStemming: false }
} as const

// Keywords for language detection
const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  'id': [
    'saya', 'punya', 'yang', 'untuk', 'pada', 'di', 'dengan', 
    'lokasi', 'proyek', 'deforesrasi', 'intervensi', 'dampak',
    'kondisi', 'bangun', 'membangun', 'pembangunan', 'hutan',
    'bagaimana', 'apa', 'mengapa', 'kapan', 'dimana', 'mana'
  ],
  'ms': [
    'saya', 'untuk', 'di', 'dengan', 'projek', 'lokasi',
    'bagaimana', 'apa', 'boleh', 'bolehkah'
  ],
  'th': [
    'ป่า', 'ฟื้นฟู', 'โครงการ', 'ไม่มี', 'เป็น', 'ที่',
    'อย่างไร', 'อะไร', 'ที่ไหน'
  ],
  'vi': [
    'tôi', 'có', 'với', 'dự án', 'rừng', 'khôi phục',
    'như thế nào', 'gì', 'ở đâu'
  ],
  'my': [
    'ပရော့ဂျက်', 'သစ်တော', 'ဇီဝ', 'မဟာမိတ်များ',
    'ဘယ်လို', 'ဘာ', 'ဘယ်'
  ],
  'kh': [
    'ព្រៃ', 'គម្រោង', 'សរសៃ', 'របស់',
    'អ្វី', 'យ៉ាងណា', 'ទីណា'
  ],
  'lo': [
    'ປ່າໄມ້', 'ບຳລຸງ', 'ໂຄງການ', 'ຂອງ',
    'ອັນໃດ', 'ການ', 'ທີ່'
  ]
}

/**
 * Detect language from query text using keyword matching
 */
export function detectSEALanguage(query: string): SEALanguageInfo {
  const lowerQuery = query.toLowerCase()
  const scores: Record<string, number> = {}
  
  // Calculate keyword scores for each language
  for (const [code, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        score += 1
      }
    }
    scores[code] = score
  }
  
  // Find language with highest score
  const detectedCode = Object.entries(scores).reduce((a, b) => 
    scores[a[0]] > scores[b[0]] ? a : b
  )[0]
  
  const languageInfo = SEA_LANGUAGES[detectedCode as keyof typeof SEA_LANGUAGES]
  
  return {
    code: detectedCode,
    name: languageInfo.name,
    hasStemming: languageInfo.hasStemming
  }
}

/**
 * Get appropriate stemmer for SEA language
 */
export function getSEAStemmer(langCode: string): any {
  // Indonesian and Malay use similar grammar - use English stemmer as approximation
  if (['id', 'ms'].includes(langCode)) {
    return natural.PorterStemmer
  }
  
  // Thai, Vietnamese, Myanmar, Khmer, Lao don't have stemmers in natural.js
  // Return null to indicate no stemming available
  return null
}

/**
 * Quick language check (simplified, fast)
 */
export function detectLanguageQuick(query: string): string {
  if (/\u1780-\u17FF/.test(query)) return 'kh' // Khmer
  if (/\u1000-\u104F/.test(query)) return 'my' // Myanmar
  if (/\u0E00-\u0E7F/.test(query)) return 'th' // Thai
  if (/\u0E80-\u0EFF/.test(query)) return 'lo' // Lao
  
  const lower = query.toLowerCase()
  if (/saya|yang|untuk|pada|di|dengan|deforesrasi|intervensi/.test(lower)) return 'id'
  if (/saya|untuk|di|dengan|projek/.test(lower)) return 'ms'
  if (/tôi|có|dự án|rừng/.test(lower)) return 'vi'
  
  return 'id' // Default to Indonesian for SEA context
}


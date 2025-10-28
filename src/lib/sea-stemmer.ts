/**
 * Southeast Asian Language Stemming
 * Supports Indonesian/Malay with Snowball-like stemming
 * Handles morphological complexities of SEA languages
 */

import natural from 'natural'
import { detectLanguageQuick } from './sea-language-detector'

export interface StemmingResult {
  original: string
  stemmed: string
  terms: string[]
  stemmedTerms: string[]
  language: string
}

/**
 * Stem Indonesian/Malay words (agglutinative language)
 * Removes prefixes: meng-, meny-, men-, me-, peng-, peny-, pen-, pe-, ber-, ter-
 * Removes suffixes: -ku, -mu, -nya, -lah, -kan, -an, -i
 */
export function stemIndonesianWord(word: string): string {
  if (!word || word.length < 3) return word
  
  let stemmed = word.toLowerCase()
  
  // Remove suffixes first
  stemmed = stemmed.replace(/(ku|mu|nya|lah|kan|an|i)$/, '')
  
  // Remove prefixes
  const prefixes = ['meng', 'meny', 'men', 'peng', 'peny', 'pen', 'pe', 'ber', 'ter', 'ke']
  
  for (const prefix of prefixes) {
    if (stemmed.startsWith(prefix)) {
      // Check if removing prefix leaves meaningful stem (at least 3 chars)
      const withoutPrefix = stemmed.slice(prefix.length)
      if (withoutPrefix.length >= 3) {
        stemmed = withoutPrefix
        break
      }
    }
  }
  
  return stemmed || word
}

/**
 * Stem query text (Indonesian/Malay)
 */
export function stemIndonesianQuery(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3)
  
  return words.map(word => stemIndonesianWord(word))
}

/**
 * Process query for languages without word boundaries
 * For Thai, Myanmar, Khmer, Lao
 */
export function processNonSpaceLanguage(query: string): string {
  // For languages without word boundaries, return as-is
  // These languages require specialized tokenizers
  return query
}

/**
 * Universal stemming for SEA languages
 */
export async function stemSEAQuery(query: string): Promise<StemmingResult> {
  // Quick language detection
  const language = detectLanguageQuick(query)
  
  console.log(`🌐 Detected SEA language: ${language}`)
  
  let stemmedTerms: string[]
  
  if (['id', 'ms'].includes(language)) {
    // Indonesian/Malay - apply custom stemming
    stemmedTerms = stemIndonesianQuery(query)
  } else if (['th', 'vi', 'my', 'kh', 'lo'].includes(language)) {
    // Languages without built-in stemmers
    // For now, just tokenize and use as-is
    const words = query
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2)
    stemmedTerms = words
  } else {
    // Fallback - use English stemmer (PorterStemmer)
    const stemmer = natural
    const words = query.split(/\s+/).filter(w => w.length >= 3)
    stemmedTerms = words.map(w => stemmer.PorterStemmer.stem(w))
  }
  
  const stemmed = stemmedTerms.join(' ')
  
  console.log(`🔤 Stemming: "${query}" → "${stemmed}"`)
  
  return {
    original: query,
    stemmed,
    terms: query.split(/\s+/),
    stemmedTerms,
    language
  }
}

/**
 * Domain-specific query expansion for NbS
 */
export function expandNbSQuery(query: string, language: string): string {
  const expansions: Record<string, Record<string, string[]>> = {
    'id': {
      'lokasi': ['tempat', 'site', 'area', 'wilayah'],
      'proyek': ['project', 'program', 'kegiatan'],
      'deforesrasi': ['deforestasi', 'penggundulan hutan', 'kerusakan hutan'],
      'intervensi': ['campur tangan', 'tindakan', 'kegiatan'],
      'dampak': ['impact', 'efek', 'pengaruh', 'akibat'],
      'kondisi': ['situasi', 'keadaan', 'state'],
      'restorasi': ['rehabilitasi', 'pemulihan', 'pembangunan'],
      'hutan': ['forest', 'kayu', 'vegetasi'],
      'karbon': ['carbon', 'CO2', 'gas rumah kaca'],
      'bangun': ['membangun', 'develop', 'developing']
    },
    'en': {
      'forest': ['woodland', 'tree', 'vegetation', 'timber'],
      'restoration': ['reforestation', 'rehabilitation', 'recovery'],
      'carbon': ['CO2', 'greenhouse gas', 'sequestration', 'storage'],
      'deforestation': ['forest loss', 'clearing', 'degradation'],
      'cover': ['extent', 'area', 'distribution', 'coverage'],
      'impact': ['effect', 'influence', 'consequence', 'outcome']
    }
  }
  
  const words = query.toLowerCase().split(/\s+/)
  const expandedTerms = new Set(words)
  
  const langExpansions = expansions[language] || expansions['en']
  
  for (const word of words) {
    for (const [key, synonyms] of Object.entries(langExpansions)) {
      if (word.includes(key) || key.includes(word)) {
        synonyms.slice(0, 2).forEach(syn => expandedTerms.add(syn))
      }
    }
  }
  
  return Array.from(expandedTerms).join(' ')
}


import { franc } from 'franc'
import ISO6391 from 'iso-639-1'

export function detectLanguageCode2(userMessage: string): { code2: string; name: string } {
  const iso3 = franc(userMessage || '', {
    minLength: 10,
    // Only consider English, Indonesian
    only: ['eng', 'ind']
  })

  const iso3to2: Record<string, string> = { eng: 'en', ind: 'id', msa: 'ms', cmn: 'zh', zho: 'zh', /* …keep rest if you want… */ }
  const code2 = iso3 && iso3 !== 'und' ? (iso3to2[iso3] ?? 'en') : 'en'
  return { code2, name: ISO6391.getName(code2) || 'English' }
}

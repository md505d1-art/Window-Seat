import type { ModuleId } from './types'

export interface SearchHit {
  id: string
  module: ModuleId
  kind: string
  title: string
  subtitle: string
  to: string
  score: number
}

export interface SearchDoc {
  id: string
  module: ModuleId
  kind: string
  title: string
  subtitle: string
  to: string
  text: string
}

/** Ranks documents: every query word must appear; title matches and prefix matches score higher. */
export function searchDocs(docs: SearchDoc[], query: string, limit = 50): SearchHit[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits: SearchHit[] = []
  for (const d of docs) {
    const title = d.title.toLowerCase()
    const hay = `${title} ${d.subtitle.toLowerCase()} ${d.text.toLowerCase()}`
    let score = 0
    let ok = true
    for (const w of words) {
      if (!hay.includes(w)) {
        ok = false
        break
      }
      if (title.startsWith(w)) score += 6
      else if (title.split(/\s+/).some((t) => t.startsWith(w))) score += 4
      else if (title.includes(w)) score += 2
      else score += 1
    }
    if (ok) hits.push({ id: d.id, module: d.module, kind: d.kind, title: d.title, subtitle: d.subtitle, to: d.to, score })
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit)
}

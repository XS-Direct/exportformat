// Field catalog: known Pace field references discovered on modelEdit pages.
// Persisted in chrome.storage.local so editors share knowledge across
// sessions. Each entry pairs the raw ref ("34-445: Person: Sex") with a
// stable id ("34-445") so the side panel can suggest fields by either form.

export interface CatalogEntry {
  // The full text inside the braces, eg. "34-445: Person: Sex".
  raw: string
  // Numeric prefix before the first colon — usually how Pace stores the id.
  id: string
  // Human-readable label (everything after the first colon, trimmed).
  label: string
  // Last time this entry was confirmed by a scrape, ISO timestamp.
  seenAt: string
}

const STORAGE_KEY = 'pace.fieldCatalog.v1'

export function toEntry(raw: string): CatalogEntry {
  const colon = raw.indexOf(':')
  if (colon === -1) {
    return { raw, id: raw.trim(), label: '', seenAt: new Date().toISOString() }
  }
  return {
    raw,
    id: raw.substring(0, colon).trim(),
    label: raw.substring(colon + 1).trim(),
    seenAt: new Date().toISOString(),
  }
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return []
  const data = await chrome.storage.local.get(STORAGE_KEY)
  const entries = data[STORAGE_KEY]
  return Array.isArray(entries) ? (entries as CatalogEntry[]) : []
}

export async function saveCatalog(entries: CatalogEntry[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  await chrome.storage.local.set({ [STORAGE_KEY]: entries })
}

export async function mergeRaws(raws: string[]): Promise<CatalogEntry[]> {
  const existing = await loadCatalog()
  const byRaw = new Map(existing.map((e) => [e.raw, e]))
  const now = new Date().toISOString()
  for (const raw of raws) {
    const prev = byRaw.get(raw)
    if (prev) {
      prev.seenAt = now
    } else {
      byRaw.set(raw, toEntry(raw))
    }
  }
  const merged = Array.from(byRaw.values()).sort((a, b) => a.raw.localeCompare(b.raw))
  await saveCatalog(merged)
  return merged
}

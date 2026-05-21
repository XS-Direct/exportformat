// Pace DOM adapter. The modelEdit page loads ALL export models at once
// (234+ textareas), so we must find the VISIBLE/ACTIVE model's elements.
// Textarea names follow the pattern dsc_before-{id}, dsc-{id}, dsc_after-{id}.

export type FieldName = 'Title' | 'Code before' | 'Repeating code' | 'Code after'

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

// Check whether an element is actually visible on screen (not hidden in a
// collapsed panel or inactive tab).
function isVisible(el: HTMLElement): boolean {
  // Walk up ancestors — Pace hides inactive models with display:none.
  // We check both inline style and computed style to work in jsdom (which
  // doesn't compute layout) and real browsers.
  let node: HTMLElement | null = el
  while (node) {
    if (node.style.display === 'none' || node.style.visibility === 'hidden') return false
    // In a real browser, also check computed style
    if (typeof node.offsetWidth === 'number' && node.offsetWidth === 0 && node.offsetHeight === 0 && node.parentElement) {
      // Could be a zero-size element — check computed style for display:none
      try {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden') return false
      } catch {
        // getComputedStyle not available (some test envs)
      }
    }
    node = node.parentElement
  }
  return true
}

// Find the active model's textarea by name prefix. Pace names textareas as:
//   dsc_before-{modelId}  → Code before
//   dsc-{modelId}         → Repeating code
//   dsc_after-{modelId}   → Code after
// We find the visible "Repeating code" textarea first to discover the active
// model ID, then use that to find the others.
function findActiveModelId(): string | null {
  // Strategy 1: find a visible label "Repeating code" and get the nearby textarea's name
  const labels = document.querySelectorAll<HTMLElement>('label, div, span, legend, p')
  for (const el of labels) {
    if (normalize(el.textContent) !== 'Repeating code') continue
    if (el.children.length > 0) continue
    if (!isVisible(el)) continue
    // Walk up to find the textarea near this label
    let parent: HTMLElement | null = el
    for (let depth = 0; depth < 6 && parent; depth++) {
      const ta = parent.querySelector<HTMLTextAreaElement>('textarea[name^="dsc-"]')
      if (ta) {
        const match = ta.name.match(/^dsc-(\d+)$/)
        if (match) {
          console.log('[pace-editor] found active model ID:', match[1], 'via visible label')
          return match[1]
        }
      }
      parent = parent.parentElement
    }
  }

  // Strategy 2: find any visible textarea with name matching dsc-{id}
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea[name^="dsc-"]')
  for (const ta of textareas) {
    if (!isVisible(ta)) continue
    const match = ta.name.match(/^dsc-(\d+)$/)
    if (match) {
      console.log('[pace-editor] found active model ID:', match[1], 'via visible textarea')
      return match[1]
    }
  }

  console.warn('[pace-editor] could not determine active model ID')
  return null
}

function findTextareaByName(name: string): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(`textarea[name="${name}"]`)
}

// Cache the model ID for the duration of a single readPaceState call so we
// don't re-scan 234 textareas for every field lookup.
let _cachedModelId: string | null | undefined

export function setCachedModelId(id: string | null): void { _cachedModelId = id }
export function clearCachedModelId(): void { _cachedModelId = undefined }

export function findTextarea(field: Exclude<FieldName, 'Title'>): HTMLTextAreaElement | null {
  const modelId = _cachedModelId !== undefined ? _cachedModelId : findActiveModelId()
  if (!modelId) {
    return findTextareaFallback(field)
  }
  const nameMap: Record<string, string> = {
    'Code before': `dsc_before-${modelId}`,
    'Repeating code': `dsc-${modelId}`,
    'Code after': `dsc_after-${modelId}`,
  }
  const ta = findTextareaByName(nameMap[field])
  console.log(`[pace-editor] findTextarea("${field}") → name="${nameMap[field]}" found=${!!ta} value-length=${ta?.value.length ?? 0}`)
  return ta
}

// Fallback: label-based search filtering for visible elements only
function findTextareaFallback(field: Exclude<FieldName, 'Title'>): HTMLTextAreaElement | null {
  const labels = document.querySelectorAll<HTMLElement>('label, div, span, legend, p')
  for (const el of labels) {
    if (normalize(el.textContent) !== field) continue
    if (el.children.length > 0) continue
    if (!isVisible(el)) continue
    let parent: HTMLElement | null = el
    for (let depth = 0; depth < 6 && parent; depth++) {
      const ctrl = parent.querySelector<HTMLTextAreaElement>('textarea')
      if (ctrl) return ctrl
      parent = parent.parentElement
    }
  }
  return null
}

export function findTitleInput(): HTMLInputElement | null {
  // Find the visible Title input
  const labels = document.querySelectorAll<HTMLElement>('label, div, span, legend, p')
  for (const el of labels) {
    if (normalize(el.textContent) !== 'Title') continue
    if (el.children.length > 0) continue
    if (!isVisible(el)) continue
    let parent: HTMLElement | null = el
    for (let depth = 0; depth < 6 && parent; depth++) {
      const ctrl = parent.querySelector<HTMLInputElement>('input')
      if (ctrl) return ctrl
      parent = parent.parentElement
    }
  }
  return null
}

// Read the Output radio group ("JSON" / "Custom"). Returns 'unknown' if Pace
// has hidden it (eg. for export-only models) so the side panel can decide
// whether to render a banner.
export function readOutputFormat(): 'json' | 'custom' | 'unknown' {
  const radios = document.querySelectorAll<HTMLInputElement>('input[type=radio]')
  for (const r of radios) {
    if (!r.checked || !isVisible(r)) continue
    const label = r.closest('label')?.textContent ?? r.nextSibling?.textContent ?? ''
    const t = normalize(label).toLowerCase()
    if (t.includes('json')) return 'json'
    if (t.includes('custom')) return 'custom'
  }
  return 'unknown'
}

// Scrape the "Fields" strip: every element whose normalized text matches the
// Pace field-ref regex. Scoped to the part of the page following a "Fields"
// label to avoid catching false positives in modal dialogs.
const FIELD_REF_RE = /^\{[\d][\d\-]*(?::\s*[^{}]+)?\}$/

export function scrapeFieldRefs(): string[] {
  const out = new Set<string>()
  // Find the visible "Fields" label
  let fieldsLabel: HTMLElement | null = null
  const labels = document.querySelectorAll<HTMLElement>('label, div, span, legend, p')
  for (const el of labels) {
    if (normalize(el.textContent) === 'Fields' && el.children.length === 0 && isVisible(el)) {
      fieldsLabel = el
      break
    }
  }
  const root: ParentNode = fieldsLabel?.parentElement ?? document.body
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const el = node as HTMLElement
      if (el.children.length > 0) return NodeFilter.FILTER_SKIP
      const text = normalize(el.textContent)
      return FIELD_REF_RE.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    },
  })
  let current = walker.nextNode() as HTMLElement | null
  while (current) {
    const text = normalize(current.textContent)
    // Drop the outer braces; CatalogEntry stores the raw inside.
    out.add(text.slice(1, -1))
    current = walker.nextNode() as HTMLElement | null
  }
  return [...out]
}

// Use the native property setter so frameworks that monkey-patched
// HTMLTextAreaElement.value (React's, Vue's, Pace's own) still see the
// change as a real DOM event.
const NATIVE_TEXTAREA_VALUE = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  'value',
)?.set

export function writeTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  if (!NATIVE_TEXTAREA_VALUE) {
    textarea.value = value
  } else {
    NATIVE_TEXTAREA_VALUE.call(textarea, value)
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.dispatchEvent(new Event('change', { bubbles: true }))
}

export function isModelEditRoute(hash: string): boolean {
  return /[?&#]show=modelEdit\b/.test(hash) || hash.includes('show=modelEdit')
}

export interface PaceDomReadResult {
  ok: boolean
  reason?: string
  title: string
  outputFormat: 'json' | 'custom' | 'unknown'
  codeBefore: string
  repeatingCode: string
  codeAfter: string
  fields: string[]
}

export function readPaceState(): PaceDomReadResult {
  console.log('[pace-editor] readPaceState() called. hash:', location.hash, 'textareas on page:', document.querySelectorAll('textarea').length)
  // Cache the active model ID for this call so we don't scan 234 textareas 3x
  const modelId = findActiveModelId()
  setCachedModelId(modelId)
  const title = findTitleInput()?.value ?? ''
  const repeating = findTextarea('Repeating code')
  if (!repeating) {
    clearCachedModelId()
    return {
      ok: false,
      reason: 'Could not locate the "Repeating code" textarea on this page.',
      title,
      outputFormat: 'unknown',
      codeBefore: '',
      repeatingCode: '',
      codeAfter: '',
      fields: [],
    }
  }
  const result: PaceDomReadResult = {
    ok: true,
    title,
    outputFormat: readOutputFormat(),
    codeBefore: findTextarea('Code before')?.value ?? '',
    repeatingCode: repeating.value,
    codeAfter: findTextarea('Code after')?.value ?? '',
    fields: scrapeFieldRefs(),
  }
  clearCachedModelId()
  return result
}

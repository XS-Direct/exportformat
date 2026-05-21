// Pace DOM adapter.
//
// Pace's modelEdit page has TWO sets of textareas:
// 1. Hidden block textareas: name="dsc-{id}", display:none — one per model
// 2. Visible edit-form textareas: no name attribute — for the model currently
//    being edited. These are the ones we should read from.
//
// The edit form also has:
// - An <input> with name matching the pattern for Title
// - Labels "Code before", "Repeating code", "Code after" near the textareas
//
// Strategy: ALWAYS prefer the visible edit-form first. Fall back to finding
// the active hidden block by its ID.

export type FieldName = 'Title' | 'Code before' | 'Repeating code' | 'Code after'

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function isVisible(el: HTMLElement): boolean {
  let node: HTMLElement | null = el
  while (node) {
    if (node.style.display === 'none' || node.style.visibility === 'hidden') return false
    if (typeof node.offsetWidth === 'number' && node.offsetWidth === 0 && node.offsetHeight === 0 && node.parentElement) {
      try {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden') return false
      } catch { /* test env */ }
    }
    node = node.parentElement
  }
  return true
}

// --- Primary strategy: find the VISIBLE edit form ---

// Find a visible label and walk up to find a nearby textarea/input.
function findVisibleControl<T extends HTMLElement>(
  labelText: string,
  controlSelector: string,
): T | null {
  const labels = document.querySelectorAll<HTMLElement>('label, div, span, legend, p, h4')
  for (const el of labels) {
    if (normalize(el.textContent) !== labelText) continue
    if (el.children.length > 0) continue
    if (!isVisible(el)) continue
    let parent: HTMLElement | null = el
    for (let depth = 0; depth < 8 && parent; depth++) {
      const ctrl = parent.querySelector<T>(controlSelector)
      if (ctrl && isVisible(ctrl)) return ctrl
      parent = parent.parentElement
    }
  }
  return null
}

// --- Secondary strategy: find hidden block textareas by class/name ---

// Pace stores block data in hidden elements with specific classes:
//   .block-title (input), .block-dsc-before, .block-dsc, .block-dsc-after (textareas)
// Find the currently-open block by looking for the block whose settings panel is visible,
// or by matching the visible Title input value to a block's title.
function findActiveBlockId(): string | null {
  // Look for a visible Title input and match its value to a block
  const titleInput = findVisibleControl<HTMLInputElement>('Title', 'input')
  if (titleInput) {
    const title = titleInput.value
    // Find the hidden block input with matching title
    const blocks = document.querySelectorAll<HTMLInputElement>('input.block-title')
    for (const b of blocks) {
      if (b.value === title) {
        const match = b.name.match(/^ttl-(\d+)$/)
        if (match) {
          console.log('[pace-editor] found active block ID:', match[1], 'via title match:', title)
          return match[1]
        }
      }
    }
  }
  return null
}

export function findTextarea(field: Exclude<FieldName, 'Title'>): HTMLTextAreaElement | null {
  // Strategy 1: Find the visible edit-form textarea (primary — works for actively edited model)
  const editFormTa = findVisibleControl<HTMLTextAreaElement>(field, 'textarea')
  if (editFormTa) {
    console.log(`[pace-editor] findTextarea("${field}") → edit form, value-length=${editFormTa.value.length}`)
    return editFormTa
  }

  // Strategy 2: Find the hidden block textarea by matching title → block ID
  const blockId = findActiveBlockId()
  if (blockId) {
    const nameMap: Record<string, string> = {
      'Code before': `dsc_before-${blockId}`,
      'Repeating code': `dsc-${blockId}`,
      'Code after': `dsc_after-${blockId}`,
    }
    const ta = document.querySelector<HTMLTextAreaElement>(`textarea[name="${nameMap[field]}"]`)
    if (ta) {
      console.log(`[pace-editor] findTextarea("${field}") → block ${blockId}, name="${nameMap[field]}", value-length=${ta.value.length}`)
      return ta
    }
  }

  // Strategy 3: Find by CSS class (block-dsc, block-dsc-before, block-dsc-after)
  const classMap: Record<string, string> = {
    'Code before': 'block-dsc-before',
    'Repeating code': 'block-dsc',
    'Code after': 'block-dsc-after',
  }
  if (blockId) {
    const ta = document.querySelector<HTMLTextAreaElement>(`textarea.${classMap[field]}[name$="-${blockId}"]`)
    if (ta) return ta
  }

  console.warn(`[pace-editor] findTextarea("${field}") → not found`)
  return null
}

export function findTitleInput(): HTMLInputElement | null {
  // Find the visible Title input in the edit form
  return findVisibleControl<HTMLInputElement>('Title', 'input')
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
  console.log('[pace-editor] readPaceState() called. hash:', location.hash)
  const title = findTitleInput()?.value ?? ''
  const repeating = findTextarea('Repeating code')
  if (!repeating) {
    return {
      ok: false,
      reason: 'Could not locate the "Repeating code" textarea on this page. Is a model open for editing?',
      title,
      outputFormat: 'unknown',
      codeBefore: '',
      repeatingCode: '',
      codeAfter: '',
      fields: [],
    }
  }
  return {
    ok: true,
    title,
    outputFormat: readOutputFormat(),
    codeBefore: findTextarea('Code before')?.value ?? '',
    repeatingCode: repeating.value,
    codeAfter: findTextarea('Code after')?.value ?? '',
    fields: scrapeFieldRefs(),
  }
}

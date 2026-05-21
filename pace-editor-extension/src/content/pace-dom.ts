// Pace DOM adapter. Selectors anchor on visible label text instead of CSS
// paths, so cosmetic Pace UI changes don't break the extension as long as
// the user-facing strings stay the same.

export type FieldName = 'Title' | 'Code before' | 'Repeating code' | 'Code after'

const LABEL_TEXT: Record<FieldName, string> = {
  Title: 'Title',
  'Code before': 'Code before',
  'Repeating code': 'Repeating code',
  'Code after': 'Code after',
}

function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

// Find an element whose visible text equals one of Pace's known labels.
// We accept <label>, <div>, <span>, <legend> — Pace mixes these freely.
function findLabelElement(label: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>('label, div, span, legend, p')
  for (const el of candidates) {
    if (normalize(el.textContent) === label && el.children.length === 0) {
      return el
    }
  }
  return null
}

// Given a label element, find the closest input/textarea that "belongs" to
// it. Strategy: walk up the DOM looking for an ancestor that also contains a
// form-control descendant. This survives Pace's typical wrapper structure
// (label + control inside the same `<div class="field">`-style container).
function findControlForLabel(label: HTMLElement, kind: 'input' | 'textarea'): HTMLElement | null {
  let node: HTMLElement | null = label
  for (let depth = 0; depth < 6 && node; depth++) {
    const ctrl = node.querySelector<HTMLElement>(kind)
    if (ctrl) return ctrl
    node = node.parentElement
  }
  return null
}

export function findTextarea(field: Exclude<FieldName, 'Title'>): HTMLTextAreaElement | null {
  const label = findLabelElement(LABEL_TEXT[field])
  if (!label) return null
  const ctrl = findControlForLabel(label, 'textarea')
  return ctrl instanceof HTMLTextAreaElement ? ctrl : null
}

export function findTitleInput(): HTMLInputElement | null {
  const label = findLabelElement(LABEL_TEXT.Title)
  if (!label) return null
  const ctrl = findControlForLabel(label, 'input')
  return ctrl instanceof HTMLInputElement ? ctrl : null
}

// Read the Output radio group ("JSON" / "Custom"). Returns 'unknown' if Pace
// has hidden it (eg. for export-only models) so the side panel can decide
// whether to render a banner.
export function readOutputFormat(): 'json' | 'custom' | 'unknown' {
  const radios = document.querySelectorAll<HTMLInputElement>('input[type=radio]')
  for (const r of radios) {
    if (!r.checked) continue
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
  const fieldsLabel = findLabelElement('Fields')
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
  const title = findTitleInput()?.value ?? ''
  const repeating = findTextarea('Repeating code')
  if (!repeating) {
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

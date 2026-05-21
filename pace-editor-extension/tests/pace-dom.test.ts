/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  findTextarea,
  findTitleInput,
  isModelEditRoute,
  scrapeFieldRefs,
  writeTextareaValue,
  readPaceState,
} from '../src/content/pace-dom'

// Simulate the real Pace modelEdit page structure. The real page has:
// - Multiple models with textareas named dsc_before-{id}, dsc-{id}, dsc_after-{id}
// - Labels like "Code before", "Repeating code", "Code after"
// - Only the active model's elements are visible (others have display:none)
function setupPaceLikePage(): void {
  document.body.innerHTML = `
    <div>
      <!-- Active model (visible) -->
      <div class="model-panel" id="model-452">
        <div class="field">
          <label>Title</label>
          <input type="text" value="downloadAlzheimer" />
        </div>
        <div class="field">
          <label>Output</label>
          <label><input type="radio" name="out" /> JSON</label>
          <label><input type="radio" name="out" checked /> Custom</label>
        </div>
        <div class="field">
          <span class="textarea-dsc">Code before</span>
          <textarea name="dsc_before-452">HEADER</textarea>
        </div>
        <div class="field">
          <span class="textarea-dsc">Repeating code</span>
          <textarea name="dsc-452">{471: id}\\t{34-445: Person: Sex}</textarea>
        </div>
        <div class="field">
          <span class="textarea-dsc">Code after</span>
          <textarea name="dsc_after-452">FOOTER</textarea>
        </div>
        <div class="strip">
          <div>Fields</div>
          <span>{471: id}</span>
          <span>{34-445: Person: Sex}</span>
          <span>{12-100: Org}</span>
          <span>not-a-field</span>
        </div>
      </div>
      <!-- Hidden model (should be ignored) -->
      <div class="model-panel" id="model-458" style="display:none">
        <div class="field">
          <span class="textarea-dsc">Repeating code</span>
          <textarea name="dsc-458">OTHER MODEL DATA</textarea>
        </div>
      </div>
    </div>
  `
}

describe('pace-dom', () => {
  beforeEach(() => setupPaceLikePage())

  it('recognises modelEdit routes', () => {
    expect(isModelEditRoute('#modelId=42&show=modelEdit')).toBe(true)
    expect(isModelEditRoute('#modelId=42&show=list')).toBe(false)
    expect(isModelEditRoute('')).toBe(false)
  })

  it('finds the Repeating code textarea by name via active model', () => {
    const ta = findTextarea('Repeating code')
    expect(ta).not.toBeNull()
    expect(ta!.value).toContain('{471: id}')
    expect(ta!.name).toBe('dsc-452')
  })

  it('finds Code before and Code after by name', () => {
    expect(findTextarea('Code before')!.value).toBe('HEADER')
    expect(findTextarea('Code before')!.name).toBe('dsc_before-452')
    expect(findTextarea('Code after')!.value).toBe('FOOTER')
    expect(findTextarea('Code after')!.name).toBe('dsc_after-452')
  })

  it('finds the Title input', () => {
    expect(findTitleInput()!.value).toBe('downloadAlzheimer')
  })

  it('ignores hidden model textareas', () => {
    const ta = findTextarea('Repeating code')
    expect(ta).not.toBeNull()
    expect(ta!.value).not.toContain('OTHER MODEL DATA')
  })

  it('scrapes field refs from the Fields strip', () => {
    const fields = scrapeFieldRefs()
    expect(fields).toContain('471: id')
    expect(fields).toContain('34-445: Person: Sex')
    expect(fields).toContain('12-100: Org')
    expect(fields).not.toContain('not-a-field')
  })

  it('writes textarea value via the native setter and dispatches input', () => {
    const ta = findTextarea('Repeating code')!
    let lastInput = ''
    ta.addEventListener('input', () => {
      lastInput = ta.value
    })
    writeTextareaValue(ta, 'new value')
    expect(ta.value).toBe('new value')
    expect(lastInput).toBe('new value')
  })

  it('readPaceState returns a complete snapshot', () => {
    const snap = readPaceState()
    expect(snap.ok).toBe(true)
    expect(snap.title).toBe('downloadAlzheimer')
    expect(snap.outputFormat).toBe('custom')
    expect(snap.codeBefore).toBe('HEADER')
    expect(snap.codeAfter).toBe('FOOTER')
    expect(snap.fields.length).toBeGreaterThanOrEqual(3)
  })

  it('readPaceState reports failure when textarea is missing', () => {
    document.body.innerHTML = '<div>nothing here</div>'
    const snap = readPaceState()
    expect(snap.ok).toBe(false)
    expect(snap.reason).toContain('Repeating code')
  })
})

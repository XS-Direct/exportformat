import {
  findTextarea,
  isModelEditRoute,
  readPaceState,
  writeTextareaValue,
} from './pace-dom'
import type { ExtensionMessage, PaceModelSnapshot } from '../shared/messages'

const BUTTON_ID = 'pace-visual-editor-open-btn'

function buildOpenButton(): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.type = 'button'
  btn.textContent = '✎ Open visual editor'
  btn.title = 'Open the Pace Visual Template Editor side panel'
  // Inline styles only — Pace stylesheets can be aggressive, and we want
  // the button to look the same regardless of which page subtree it lands in.
  Object.assign(btn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    margin: '4px 0',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
    background: '#2563eb',
    border: '1px solid #1d4ed8',
    borderRadius: '6px',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    zIndex: '2147483647',
  } as Partial<CSSStyleDeclaration>)
  btn.addEventListener('click', (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    void chrome.runtime.sendMessage({ type: 'PACE_OPEN_EDITOR' } satisfies ExtensionMessage)
  })
  return btn
}

function ensureOpenButton(): void {
  if (document.getElementById(BUTTON_ID)) return
  const repeating = findTextarea('Repeating code')
  if (!repeating) return
  const btn = buildOpenButton()
  // Place the button right above the textarea so it's visible without
  // displacing Pace's own layout.
  repeating.parentElement?.insertBefore(btn, repeating)
}

function teardownOpenButton(): void {
  document.getElementById(BUTTON_ID)?.remove()
}

function syncForCurrentRoute(): void {
  if (isModelEditRoute(location.hash)) {
    ensureOpenButton()
  } else {
    teardownOpenButton()
  }
}

// Pace is a single-page app with hash routing, so we react to both
// hashchange events (route swap) and DOM mutations (late hydration of the
// modelEdit panel after the route swap).
window.addEventListener('hashchange', syncForCurrentRoute)

const observer = new MutationObserver(() => syncForCurrentRoute())
observer.observe(document.body, { childList: true, subtree: true })

syncForCurrentRoute()

// Build the snapshot the side panel needs to render the editor. Kept here
// (rather than in the background worker) because only the content script
// has access to Pace's DOM.
function buildSnapshot(): PaceModelSnapshot | { error: string } {
  const state = readPaceState()
  if (!state.ok) return { error: state.reason ?? 'unknown error reading Pace state' }
  return {
    title: state.title,
    outputFormat: state.outputFormat,
    codeBefore: state.codeBefore,
    repeatingCode: state.repeatingCode,
    codeAfter: state.codeAfter,
    fields: state.fields,
    hash: location.hash,
    host: location.host,
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'PACE_REQUEST_SNAPSHOT') {
    const snap = buildSnapshot()
    if ('error' in snap) {
      sendResponse({ ok: false, error: snap.error })
    } else {
      sendResponse({ ok: true, snapshot: snap })
    }
    return true
  }
  if (message.type === 'PACE_WRITE_REPEATING_CODE') {
    const textarea = findTextarea('Repeating code')
    if (!textarea) {
      sendResponse({ ok: false, error: 'Repeating code textarea not found' })
      return true
    }
    try {
      writeTextareaValue(textarea, message.value)
      sendResponse({ ok: true })
    } catch (err) {
      sendResponse({ ok: false, error: (err as Error).message })
    }
    return true
  }
  return false
})

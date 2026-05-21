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
  btn.textContent = '\u270E Open visual editor'
  btn.title = 'Open the Pace Visual Template Editor side panel'
  Object.assign(btn.style, {
    display: 'inline-block',
    margin: '4px 0',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#fff',
    background: '#2563eb',
    border: '1px solid #1d4ed8',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    position: 'relative',
    zIndex: '1',
    width: 'auto',
    maxWidth: 'fit-content',
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

// Throttle the MutationObserver so we don't call findActiveModelId on every
// single DOM mutation (the page has 234+ textareas).
let syncTimer: ReturnType<typeof setTimeout> | null = null
function throttledSync(): void {
  if (syncTimer) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncForCurrentRoute()
  }, 200)
}

window.addEventListener('hashchange', syncForCurrentRoute)

const observer = new MutationObserver(throttledSync)
observer.observe(document.body, { childList: true, subtree: true })

syncForCurrentRoute()

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
  console.log('[pace-editor][content] received message:', message.type)
  if (message.type === 'PACE_REQUEST_SNAPSHOT') {
    const snap = buildSnapshot()
    if ('error' in snap) {
      console.warn('[pace-editor][content] snapshot error:', snap.error)
      sendResponse({ ok: false, error: snap.error })
    } else {
      console.log('[pace-editor][content] snapshot OK, title:', snap.title, 'repeatingCode length:', snap.repeatingCode.length)
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

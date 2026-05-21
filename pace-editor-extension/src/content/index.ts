import {
  findTextarea,
  readPaceState,
  writeTextareaValue,
} from './pace-dom'
import type { ExtensionMessage, PaceModelSnapshot } from '../shared/messages'

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

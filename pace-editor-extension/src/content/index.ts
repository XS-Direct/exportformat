import {
  findTextarea,
  readPaceState,
  readPaceStateById,
  writeTextareaValue,
} from './pace-dom'
import type { ExtensionMessage, PaceModelSnapshot, PaceModelInfo } from '../shared/messages'

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

function buildSnapshotById(blockId: string): PaceModelSnapshot | { error: string } {
  const state = readPaceStateById(blockId)
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

// Scan all block elements on the page to build a model list
function listModels(): PaceModelInfo[] {
  const models: PaceModelInfo[] = []
  const titleInputs = document.querySelectorAll<HTMLInputElement>('input.block-title')
  for (const input of titleInputs) {
    const match = input.name.match(/^ttl-(\d+)$/)
    if (!match) continue
    const id = match[1]
    const title = input.value
    // Determine type and client from title
    let type: 'download' | 'export' | 'other' = 'other'
    let client = title
    if (title.toLowerCase().startsWith('download')) {
      type = 'download'
      client = title.slice(8) // strip "download"
    } else if (title.toLowerCase().startsWith('export')) {
      type = 'export'
      client = title.slice(6) // strip "export"
    }
    // Normalize client name: "AlzheimerNederland" → "Alzheimer Nederland"
    client = client.replace(/([a-z])([A-Z])/g, '$1 $2').trim()
    models.push({ id, title, type, client })
  }
  // Sort by client name, then type (download before export)
  models.sort((a, b) => a.client.localeCompare(b.client) || a.type.localeCompare(b.type))
  return models
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  console.log('[pace-editor][content] received message:', message.type)

  if (message.type === 'PACE_REQUEST_SNAPSHOT') {
    const snap = buildSnapshot()
    if ('error' in snap) {
      sendResponse({ ok: false, error: snap.error })
    } else {
      sendResponse({ ok: true, snapshot: snap })
    }
    return true
  }

  if (message.type === 'PACE_REQUEST_SNAPSHOT_BY_ID') {
    const snap = buildSnapshotById(message.blockId)
    if ('error' in snap) {
      sendResponse({ ok: false, error: snap.error })
    } else {
      sendResponse({ ok: true, snapshot: snap })
    }
    return true
  }

  if (message.type === 'PACE_LIST_MODELS') {
    sendResponse({ ok: true, models: listModels() })
    return true
  }

  if (message.type === 'PACE_RUN_LIVE_EXPORT') {
    void (async () => {
      try {
        // Call Pace's r.php API with the block ID — session cookies authenticate automatically
        const resp = await fetch(`/r.php?_id=${message.blockId}`)
        if (!resp.ok) {
          sendResponse({ ok: false, error: `HTTP ${resp.status}` })
          return
        }
        const output = await resp.text()
        sendResponse({ ok: true, output })
      } catch (err) {
        sendResponse({ ok: false, error: (err as Error).message })
      }
    })()
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

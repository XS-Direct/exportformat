import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { parse } from '@shared/parser'
import { serialize } from '@shared/serializer'
import type { IRTree } from '@shared/ir-types'
import type { ExtensionMessage, PaceModelSnapshot, PaceModelInfo } from '@shared/messages'
import { mergeRaws, type CatalogEntry } from '@shared/field-catalog'
import { extractAllFieldRefs } from '@shared/auto-fixtures'

export type Tab = 'editor' | 'preview' | 'simulator' | 'ai' | 'settings'

interface HistoryFrame {
  codeBefore: string
  repeatingCode: string
  codeAfter: string
}

const HISTORY_LIMIT = 100
// Don't push a new history frame for every keystroke; coalesce edits that
// happen within this window into the most recent frame.
const HISTORY_DEBOUNCE_MS = 400

export const useEditorStore = defineStore('editor', () => {
  const tab = ref<Tab>('editor')
  const snapshot = ref<PaceModelSnapshot | null>(null)
  const loadError = ref<string | null>(null)
  const writing = ref(false)
  const writeError = ref<string | null>(null)
  const catalog = ref<CatalogEntry[]>([])

  // Working copies of the three textareas. They start equal to the snapshot
  // and diverge as the user edits.
  const codeBefore = ref('')
  const repeatingCode = ref('')
  const codeAfter = ref('')

  // Undo/redo: a list of frames plus a cursor. New edits truncate the
  // redo tail. A flag suppresses the watcher while we're applying an undo
  // so it doesn't push the very change it's restoring.
  const history = ref<HistoryFrame[]>([])
  const historyCursor = ref(-1)
  let suppressHistory = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  function currentFrame(): HistoryFrame {
    return {
      codeBefore: codeBefore.value,
      repeatingCode: repeatingCode.value,
      codeAfter: codeAfter.value,
    }
  }

  function pushFrame(frame: HistoryFrame): void {
    // Drop redo tail.
    if (historyCursor.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyCursor.value + 1)
    }
    const prev = history.value[historyCursor.value]
    if (
      prev &&
      prev.codeBefore === frame.codeBefore &&
      prev.repeatingCode === frame.repeatingCode &&
      prev.codeAfter === frame.codeAfter
    ) {
      return
    }
    history.value.push(frame)
    if (history.value.length > HISTORY_LIMIT) {
      history.value.shift()
    }
    historyCursor.value = history.value.length - 1
  }

  function resetHistory(): void {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    history.value = [currentFrame()]
    historyCursor.value = 0
  }

  watch([codeBefore, repeatingCode, codeAfter], () => {
    if (suppressHistory) return
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = setTimeout(() => {
      pushFrame(currentFrame())
      pendingTimer = null
    }, HISTORY_DEBOUNCE_MS)
  })

  function applyFrame(frame: HistoryFrame): void {
    suppressHistory = true
    codeBefore.value = frame.codeBefore
    repeatingCode.value = frame.repeatingCode
    codeAfter.value = frame.codeAfter
    // Flip back synchronously after the watcher has had a chance to
    // observe the values — a microtask works because watch() schedules
    // the callback on the next flush.
    queueMicrotask(() => {
      suppressHistory = false
    })
  }

  const canUndo = computed(() => historyCursor.value > 0)
  const canRedo = computed(() => historyCursor.value < history.value.length - 1)

  function undo(): void {
    if (!canUndo.value) return
    // Flush any pending edit into history first so undo doesn't appear
    // to skip the most recent change.
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
      pushFrame(currentFrame())
    }
    historyCursor.value--
    applyFrame(history.value[historyCursor.value])
  }

  function redo(): void {
    if (!canRedo.value) return
    historyCursor.value++
    applyFrame(history.value[historyCursor.value])
  }

  const parsed = computed<{ tree: IRTree; hasErrors: boolean; errors: string[] }>(() => {
    const result = parse(repeatingCode.value)
    return {
      tree: result.tree,
      hasErrors: result.diagnostics.hasErrors,
      errors: result.diagnostics.errors.map(
        (e) => `Line ${e.line}, col ${e.column}: ${e.message}`,
      ),
    }
  })

  const roundTripOk = computed(() => {
    if (parsed.value.hasErrors) return false
    return serialize(parsed.value.tree) === repeatingCode.value
  })

  const dirty = computed(() => snapshot.value?.repeatingCode !== repeatingCode.value)

  async function loadSnapshot(): Promise<void> {
    loadError.value = null
    console.log('[pace-editor][panel] loadSnapshot() called')
    try {
      const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
        type: 'PACE_REQUEST_SNAPSHOT',
      })
      console.log('[pace-editor][panel] reply:', JSON.stringify(reply).slice(0, 200))
      if (!reply || reply.ok !== true) {
        loadError.value = reply?.error ?? 'No response from content script'
        console.warn('[pace-editor][panel] loadError:', loadError.value)
        return
      }
      const snap = reply.snapshot as PaceModelSnapshot
      console.log('[pace-editor][panel] snapshot loaded, title:', snap.title, 'repeatingCode length:', snap.repeatingCode?.length)
      snapshot.value = snap
      suppressHistory = true
      codeBefore.value = snap.codeBefore
      repeatingCode.value = snap.repeatingCode
      codeAfter.value = snap.codeAfter
      queueMicrotask(() => {
        suppressHistory = false
        resetHistory()
      })
      // Build the field catalog from two sources:
      // 1. Fields scraped from the Pace DOM (the "Fields" strip)
      // 2. Fields extracted from the template code itself (always works)
      const templateFields = extractAllFieldRefs(snap.codeBefore, snap.repeatingCode, snap.codeAfter)
      const allFields = [...new Set([...snap.fields, ...templateFields])]
      if (allFields.length) {
        catalog.value = await mergeRaws(allFields)
      }
    } catch (err) {
      loadError.value = (err as Error).message
    }
  }

  async function sendRepeatingCode(): Promise<void> {
    writing.value = true
    writeError.value = null
    try {
      const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
        type: 'PACE_WRITE_REPEATING_CODE',
        value: repeatingCode.value,
      })
      if (!reply || reply.ok !== true) {
        writeError.value = reply?.error ?? 'Write failed'
        return
      }
      if (snapshot.value) snapshot.value.repeatingCode = repeatingCode.value
    } catch (err) {
      writeError.value = (err as Error).message
    } finally {
      writing.value = false
    }
  }

  function revertChanges(): void {
    if (!snapshot.value) return
    codeBefore.value = snapshot.value.codeBefore
    repeatingCode.value = snapshot.value.repeatingCode
    codeAfter.value = snapshot.value.codeAfter
  }

  // --- Model listing & client grouping ---
  const models = ref<PaceModelInfo[]>([])

  async function loadModels(): Promise<void> {
    try {
      const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
        type: 'PACE_LIST_MODELS',
      })
      if (reply?.ok && reply.models) {
        models.value = reply.models
      }
    } catch { /* silent */ }
  }

  async function loadSnapshotById(blockId: string): Promise<void> {
    loadError.value = null
    try {
      const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
        type: 'PACE_REQUEST_SNAPSHOT_BY_ID',
        blockId,
      })
      if (!reply || reply.ok !== true) {
        loadError.value = reply?.error ?? 'No response'
        return
      }
      const snap = reply.snapshot as PaceModelSnapshot
      snapshot.value = snap
      suppressHistory = true
      codeBefore.value = snap.codeBefore
      repeatingCode.value = snap.repeatingCode
      codeAfter.value = snap.codeAfter
      queueMicrotask(() => {
        suppressHistory = false
        resetHistory()
      })
      const templateFields = extractAllFieldRefs(snap.codeBefore, snap.repeatingCode, snap.codeAfter)
      const allFields = [...new Set([...snap.fields, ...templateFields])]
      if (allFields.length) {
        catalog.value = await mergeRaws(allFields)
      }
    } catch (err) {
      loadError.value = (err as Error).message
    }
  }

  return {
    tab,
    snapshot,
    loadError,
    writing,
    writeError,
    catalog,
    codeBefore,
    repeatingCode,
    codeAfter,
    parsed,
    roundTripOk,
    dirty,
    canUndo,
    canRedo,
    models,
    loadSnapshot,
    loadModels,
    loadSnapshotById,
    sendRepeatingCode,
    revertChanges,
    undo,
    redo,
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { parse } from '@shared/parser'
import { serialize } from '@shared/serializer'
import type { IRTree } from '@shared/ir-types'
import type { ExtensionMessage, PaceModelSnapshot } from '@shared/messages'
import { mergeRaws, type CatalogEntry } from '@shared/field-catalog'

export type Tab = 'editor' | 'preview' | 'simulator' | 'settings'

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
    try {
      const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
        type: 'PACE_REQUEST_SNAPSHOT',
      })
      if (!reply || reply.ok !== true) {
        loadError.value = reply?.error ?? 'No response from content script'
        return
      }
      const snap = reply.snapshot as PaceModelSnapshot
      snapshot.value = snap
      codeBefore.value = snap.codeBefore
      repeatingCode.value = snap.repeatingCode
      codeAfter.value = snap.codeAfter
      if (snap.fields.length) {
        catalog.value = await mergeRaws(snap.fields)
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
    loadSnapshot,
    sendRepeatingCode,
    revertChanges,
  }
})

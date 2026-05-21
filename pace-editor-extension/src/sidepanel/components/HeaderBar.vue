<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../store'

const store = useEditorStore()

const tabs: { id: typeof store.tab; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'settings', label: 'Instellingen' },
]

// Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) to redo. Ignore the
// shortcut while focus is in an input/textarea so the browser's native
// text-field undo keeps working at the field level — undo at the model
// level is a separate, deliberate action.
function onKey(ev: KeyboardEvent): void {
  if (!(ev.ctrlKey || ev.metaKey)) return
  const target = ev.target as HTMLElement | null
  const inField =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  if (inField) return
  if (ev.key === 'z' && !ev.shiftKey) {
    ev.preventDefault()
    store.undo()
  } else if ((ev.key === 'z' && ev.shiftKey) || ev.key === 'y') {
    ev.preventDefault()
    store.redo()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <header class="border-b border-slate-200 bg-white">
    <div class="flex items-center gap-2 px-3 py-2">
      <div class="text-sm font-semibold text-slate-800">
        Pace Editor
      </div>
      <div class="ml-2 truncate text-xs text-slate-500">
        {{ store.snapshot?.title || '— geen model geladen —' }}
      </div>
      <div class="ml-auto flex items-center gap-1">
        <button
          class="rounded border border-slate-300 px-1.5 py-0.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-40"
          :disabled="!store.canUndo"
          title="Ongedaan maken (Ctrl/Cmd+Z)"
          @click="store.undo()"
        >↶</button>
        <button
          class="rounded border border-slate-300 px-1.5 py-0.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-40"
          :disabled="!store.canRedo"
          title="Opnieuw (Ctrl/Cmd+Shift+Z)"
          @click="store.redo()"
        >↷</button>
        <span
          v-if="store.dirty"
          class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900"
        >Wijzigingen</span>
        <span
          v-if="store.parsed.hasErrors"
          class="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-800"
        >Parse-fout</span>
      </div>
    </div>
    <nav class="flex gap-1 border-t border-slate-100 px-2">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="border-b-2 px-3 py-1.5 text-xs font-medium transition"
        :class="store.tab === t.id
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="store.tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>
  </header>
</template>

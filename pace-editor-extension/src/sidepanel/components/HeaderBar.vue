<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useEditorStore } from '../store'

const store = useEditorStore()

const updateInfo = ref<{ current: string; remote: string } | null>(null)
onMounted(async () => {
  try {
    const data = await chrome.storage.local.get('pace.update')
    if (data['pace.update']?.remote) updateInfo.value = data['pace.update']
  } catch { /* ignore */ }
  // Pre-load model list
  void store.loadModels()
})

const tabs: { id: typeof store.tab; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'ai', label: 'AI' },
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

const emit = defineEmits<{ back: [] }>()

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <header class="border-b border-slate-200 bg-white">
    <div class="flex items-center gap-2 px-3 py-2">
      <button
        class="rounded px-1.5 py-0.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-800"
        title="Terug naar klant-overzicht"
        @click="emit('back')"
      >&larr;</button>
      <div class="truncate text-sm font-semibold text-slate-800">
        {{ store.snapshot?.title || 'Pace Editor' }}
      </div>
      <div class="ml-auto flex items-center gap-1">
        <button
          class="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          title="Opnieuw lezen van Pace"
          @click="store.loadSnapshot()"
        >&#8635; Lezen</button>
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
    <a
      v-if="updateInfo"
      href="https://github.com/XS-Direct/exportformat/tree/main/pace-editor-extension#update"
      target="_blank"
      class="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-900 hover:bg-amber-100"
    >
      Update v{{ updateInfo.remote }} beschikbaar
      <span class="ml-auto rounded bg-amber-200 px-1.5 py-0.5 font-mono text-[10px]">git pull && npm run build</span>
    </a>
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

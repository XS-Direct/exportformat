<script setup lang="ts">
import { useEditorStore } from '../store'

const store = useEditorStore()

const tabs: { id: typeof store.tab; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'settings', label: 'Instellingen' },
]
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

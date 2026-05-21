<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { saveCatalog } from '@shared/field-catalog'

const store = useEditorStore()
const filter = ref('')

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return store.catalog
  return store.catalog.filter((e) => e.raw.toLowerCase().includes(q))
})

async function removeEntry(raw: string): Promise<void> {
  const next = store.catalog.filter((e) => e.raw !== raw)
  store.catalog = next
  await saveCatalog(next)
}

async function clearCatalog(): Promise<void> {
  if (!confirm('Hele field-catalog wissen?')) return
  store.catalog = []
  await saveCatalog([])
}

function openOptionsPage(): void {
  chrome.runtime.openOptionsPage()
}

function exportJson(): void {
  const blob = new Blob([JSON.stringify(store.catalog, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pace-field-catalog.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="space-y-3 p-3 text-sm">
    <header>
      <h2 class="text-sm font-semibold text-slate-700">Field catalog</h2>
      <p class="text-xs text-slate-500">
        Bekende Pace-velden, automatisch aangevuld bij elk bezoek aan een
        modelEdit-pagina.
      </p>
    </header>

    <div class="flex items-center gap-1">
      <input
        v-model="filter"
        class="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
        placeholder="zoek (id of label)"
      />
      <button
        class="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
        @click="exportJson"
      >Export JSON</button>
      <button
        class="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
        @click="clearCatalog"
      >Wis alles</button>
    </div>

    <ul class="space-y-0.5 rounded border border-slate-200 bg-white p-1">
      <li
        v-if="!filtered.length"
        class="px-2 py-1 text-xs italic text-slate-400"
      >Geen velden gevonden.</li>
      <li
        v-for="e in filtered"
        :key="e.raw"
        class="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50"
      >
        <span class="font-semibold text-emerald-800">{{ e.id }}</span>
        <span class="truncate text-slate-600">{{ e.label || '(geen label)' }}</span>
        <button
          class="ml-auto text-rose-700 hover:underline"
          @click="removeEntry(e.raw)"
        >verwijderen</button>
      </li>
    </ul>

    <section>
      <h3 class="text-xs font-semibold text-slate-700">Host</h3>
      <p class="text-xs text-slate-600">
        Extensie luistert standaard op
        <code class="mono rounded bg-slate-100 px-1">pace-bp.xsdirect.nl</code>.
        Extra hosts (bv. staging) voeg je toe via de
        <button
          class="text-blue-700 underline-offset-2 hover:underline"
          @click="openOptionsPage"
        >options-pagina</button>.
      </p>
    </section>
  </section>
</template>

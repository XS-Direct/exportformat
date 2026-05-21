<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { saveCatalog } from '@shared/field-catalog'

const store = useEditorStore()
const filter = ref('')

const currentVersion = chrome.runtime.getManifest().version
const updateStatus = ref<'idle' | 'checking' | 'available' | 'up-to-date'>('idle')
const remoteVersion = ref('')

async function checkForUpdates(): Promise<void> {
  updateStatus.value = 'checking'
  try {
    const resp = await fetch(
      'https://raw.githubusercontent.com/XS-Direct/exportformat/main/pace-editor-extension/package.json',
      { cache: 'no-store' },
    )
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const pkg = await resp.json()
    remoteVersion.value = pkg.version
    updateStatus.value = pkg.version !== currentVersion ? 'available' : 'up-to-date'
  } catch {
    updateStatus.value = 'idle'
  }
}

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

    <section class="rounded border border-slate-200 bg-white p-2">
      <div class="flex items-center gap-2">
        <h3 class="text-xs font-semibold text-slate-700">Versie {{ currentVersion }}</h3>
        <button
          class="rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:bg-slate-100 disabled:opacity-50"
          :disabled="updateStatus === 'checking'"
          @click="checkForUpdates"
        >{{ updateStatus === 'checking' ? 'Checken...' : 'Check updates' }}</button>
      </div>
      <p v-if="updateStatus === 'up-to-date'" class="mt-1 text-[11px] text-emerald-700">Je hebt de nieuwste versie.</p>
      <div v-if="updateStatus === 'available'" class="mt-1 rounded bg-amber-50 p-1.5 text-[11px] text-amber-900">
        <strong>v{{ remoteVersion }}</strong> beschikbaar!
        <code class="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px]">git pull && npm run build</code>
        + reload extension
      </div>
    </section>

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

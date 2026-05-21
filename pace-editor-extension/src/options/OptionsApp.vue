<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  loadCatalog,
  saveCatalog,
  type CatalogEntry,
} from '@shared/field-catalog'

const entries = ref<CatalogEntry[]>([])
const importError = ref<string | null>(null)

onMounted(async () => {
  entries.value = await loadCatalog()
})

async function importFile(ev: Event): Promise<void> {
  importError.value = null
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as CatalogEntry[]
    if (!Array.isArray(parsed)) throw new Error('JSON moet een array van CatalogEntry zijn')
    entries.value = parsed
    await saveCatalog(parsed)
  } catch (err) {
    importError.value = (err as Error).message
  }
  input.value = ''
}

function exportFile(): void {
  const blob = new Blob([JSON.stringify(entries.value, null, 2)], {
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
  <main class="mx-auto max-w-2xl space-y-6 p-6">
    <header>
      <h1 class="text-xl font-semibold">Pace Visual Template Editor</h1>
      <p class="text-sm text-slate-600">
        Beheer van de field catalog en algemene instellingen.
      </p>
    </header>

    <section class="space-y-2 rounded border border-slate-200 bg-white p-4">
      <h2 class="text-sm font-semibold text-slate-700">Field catalog</h2>
      <p class="text-xs text-slate-600">
        Aantal velden opgeslagen: <strong>{{ entries.length }}</strong>
      </p>
      <div class="flex gap-2">
        <label class="cursor-pointer rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50">
          Import JSON
          <input type="file" accept="application/json" class="hidden" @change="importFile" />
        </label>
        <button
          class="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50"
          @click="exportFile"
        >Export JSON</button>
      </div>
      <p
        v-if="importError"
        class="text-xs text-rose-700"
      >Import faalde: {{ importError }}</p>
    </section>

    <section class="space-y-2 rounded border border-slate-200 bg-white p-4 text-xs text-slate-600">
      <h2 class="text-sm font-semibold text-slate-700">Host</h2>
      <p>
        De extensie injecteert alleen op
        <code class="rounded bg-slate-100 px-1">pace-bp.xsdirect.nl</code>.
        Andere hosts (zoals staging) vereisen een nieuwe extensie-build met aangepaste
        <code>host_permissions</code>.
      </p>
    </section>

    <section class="space-y-2 rounded border border-slate-200 bg-white p-4 text-xs text-slate-600">
      <h2 class="text-sm font-semibold text-slate-700">Beveiliging</h2>
      <ul class="ml-4 list-disc space-y-1">
        <li>Geen externe netwerk-calls (alles draait offline in de browser).</li>
        <li>Geen telemetry.</li>
        <li>Repeating code wordt alleen geschreven na klikken op "Send to Pace".</li>
        <li>Geen echte donor-data opgeslagen — alleen IR en synthetische fixtures.</li>
      </ul>
    </section>
  </main>
</template>

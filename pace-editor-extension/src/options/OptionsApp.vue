<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  loadCatalog,
  saveCatalog,
  type CatalogEntry,
} from '@shared/field-catalog'
import {
  loadConfiguredHosts,
  saveExtraHosts,
  normalizeHostInput,
  type ConfiguredHost,
} from '@shared/hosts'

const entries = ref<CatalogEntry[]>([])
const importError = ref<string | null>(null)

const hosts = ref<ConfiguredHost[]>([])
const grantedOrigins = ref<Set<string>>(new Set())
const newHostInput = ref('')
const newHostLabel = ref('')
const hostError = ref<string | null>(null)

async function refreshPermissions(): Promise<void> {
  const granted = await chrome.permissions.getAll()
  grantedOrigins.value = new Set(granted.origins ?? [])
}

async function refreshHosts(): Promise<void> {
  hosts.value = await loadConfiguredHosts()
  await refreshPermissions()
}

onMounted(async () => {
  entries.value = await loadCatalog()
  await refreshHosts()
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

async function addHost(): Promise<void> {
  hostError.value = null
  const pattern = normalizeHostInput(newHostInput.value)
  if (!pattern) {
    hostError.value = 'Onbruikbare host — geef bv. `pace-bp-stg.xsdirect.nl` op.'
    return
  }
  if (hosts.value.some((h) => h.pattern === pattern)) {
    hostError.value = 'Deze host is al toegevoegd.'
    return
  }
  try {
    const granted = await chrome.permissions.request({ origins: [pattern] })
    if (!granted) {
      hostError.value = 'Permissie geweigerd door de browser.'
      return
    }
    const extras = hosts.value
      .filter((h) => !h.builtin)
      .concat({ label: newHostLabel.value.trim() || pattern, pattern })
    await saveExtraHosts(extras)
    newHostInput.value = ''
    newHostLabel.value = ''
    await refreshHosts()
  } catch (err) {
    hostError.value = (err as Error).message
  }
}

async function removeHost(host: ConfiguredHost): Promise<void> {
  if (host.builtin) return
  if (!confirm(`Host ${host.pattern} verwijderen en permissie intrekken?`)) return
  try {
    await chrome.permissions.remove({ origins: [host.pattern] })
  } catch (err) {
    console.warn('permissions.remove failed', err)
  }
  const extras = hosts.value.filter((h) => h.pattern !== host.pattern && !h.builtin)
  await saveExtraHosts(extras)
  await refreshHosts()
}

async function reRequestPermission(host: ConfiguredHost): Promise<void> {
  try {
    await chrome.permissions.request({ origins: [host.pattern] })
    await refreshPermissions()
  } catch (err) {
    hostError.value = (err as Error).message
  }
}
</script>

<template>
  <main class="mx-auto max-w-2xl space-y-6 p-6">
    <header>
      <h1 class="text-xl font-semibold">Pace Visual Template Editor</h1>
      <p class="text-sm text-slate-600">
        Beheer van hosts, de field catalog en overige instellingen.
      </p>
    </header>

    <section class="space-y-3 rounded border border-slate-200 bg-white p-4">
      <header class="flex items-baseline justify-between">
        <h2 class="text-sm font-semibold text-slate-700">Hosts</h2>
        <p class="text-[11px] text-slate-500">
          Subdomeinen van <code class="font-mono">xsdirect.nl</code> kunnen
          opt-in worden geactiveerd.
        </p>
      </header>

      <ul class="space-y-1">
        <li
          v-for="h in hosts"
          :key="h.pattern"
          class="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs"
        >
          <span class="font-medium text-slate-700">{{ h.label }}</span>
          <code class="font-mono text-slate-500">{{ h.pattern }}</code>
          <span
            v-if="h.builtin"
            class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600"
          >ingebouwd</span>
          <span
            v-else-if="grantedOrigins.has(h.pattern)"
            class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase text-emerald-800"
          >actief</span>
          <span
            v-else
            class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-900"
          >geen permissie</span>
          <button
            v-if="!h.builtin && !grantedOrigins.has(h.pattern)"
            class="ml-auto text-blue-700 hover:underline"
            @click="reRequestPermission(h)"
          >Permissie aanvragen</button>
          <button
            v-if="!h.builtin"
            class="text-rose-700 hover:underline"
            :class="grantedOrigins.has(h.pattern) ? 'ml-auto' : ''"
            @click="removeHost(h)"
          >Verwijderen</button>
        </li>
      </ul>

      <div class="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <div>
          <label class="block text-[11px] font-semibold uppercase text-slate-500">
            Host
          </label>
          <input
            v-model="newHostInput"
            class="rounded border border-slate-300 px-2 py-1 text-xs"
            placeholder="pace-bp-stg.xsdirect.nl"
          />
        </div>
        <div>
          <label class="block text-[11px] font-semibold uppercase text-slate-500">
            Label (optioneel)
          </label>
          <input
            v-model="newHostLabel"
            class="rounded border border-slate-300 px-2 py-1 text-xs"
            placeholder="Pace Staging"
          />
        </div>
        <button
          class="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          @click="addHost"
        >Toevoegen</button>
      </div>
      <p v-if="hostError" class="text-xs text-rose-700">{{ hostError }}</p>
    </section>

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

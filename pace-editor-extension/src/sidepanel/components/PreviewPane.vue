<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { buildAutoFixtures } from '@shared/auto-fixtures'
import { runSimulation } from '@shared/simulator'

const store = useEditorStore()
const showRaw = ref(false)
const liveLoading = ref(false)
const liveError = ref('')

// Download simulated CSV
function downloadSimCsv(): void {
  if (!result.value) return
  const title = store.snapshot?.title ?? 'export'
  const output = fileOutput.value
  const blob = new Blob([output], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}_preview.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Download real CSV via r.php API (requires Pace API token in settings)
async function downloadRealCsv(): Promise<void> {
  const models = store.models
  const title = store.snapshot?.title
  const model = title ? models.find((m) => m.title === title) : null
  if (!model) {
    liveError.value = 'Model niet gevonden. Laad eerst een model.'
    return
  }

  // Get API token from storage
  const data = await chrome.storage.local.get('pace.apiToken')
  const token = data['pace.apiToken']
  if (!token) {
    liveError.value = 'Geen Pace API token. Stel deze in bij Instellingen.'
    return
  }

  liveLoading.value = true
  liveError.value = ''
  try {
    const resp = await fetch(`https://pace-bp.xsdirect.nl/r.php?_name=${encodeURIComponent(model.title)}`, {
      headers: { 'X-Token': token },
    })
    if (!resp.ok) {
      liveError.value = `HTTP ${resp.status}: ${resp.statusText}`
      return
    }
    const output = await resp.text()
    // Trigger download
    const blob = new Blob([output], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${model.title}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    liveError.value = (err as Error).message
  } finally {
    liveLoading.value = false
  }
}

const autoFixture = computed(() => {
  if (!store.repeatingCode) return null
  return buildAutoFixtures(
    store.snapshot?.title ?? '',
    store.codeBefore,
    store.repeatingCode,
    store.codeAfter,
  )
})

const result = computed(() => {
  if (!autoFixture.value) return null
  return runSimulation({
    codeBefore: store.codeBefore,
    repeatingCode: store.repeatingCode,
    codeAfter: store.codeAfter,
    bundle: autoFixture.value,
  })
})

// Parse Code Before as the header row — split by whatever delimiter it uses
const columnHeaders = computed(() => {
  const raw = store.codeBefore
  if (!raw) return []
  // Strip Pace functions that produce no output
  const cleaned = raw.replace(/\$(?:var|storevar|rem)\[[^\]]*\](?:\[[^\]]*\])?/g, '').trim()
  if (!cleaned) return []
  // Detect delimiter
  if (cleaned.includes('&#9;') || cleaned.includes('\t')) {
    return cleaned.split(/&#9;|\t/).map((s) => s.replace(/"/g, '').trim())
  }
  if (cleaned.includes(';')) {
    return cleaned.split(';').map((s) => s.replace(/"/g, '').trim())
  }
  if (cleaned.includes(',')) {
    return cleaned.split(',').map((s) => s.replace(/"/g, '').trim())
  }
  return [cleaned]
})

// Split a CSV/TSV row respecting quoted values: "val1";"val2" → [val1, val2]
function splitCsvRow(row: string, delim: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (inQuote) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else if (ch === '"') {
        inQuote = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuote = true
    } else if (row.startsWith(delim, i)) {
      cells.push(current)
      current = ''
      i += delim.length - 1
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

// Detect delimiter in a string
function detectDelimiter(text: string): string {
  const tabCount = (text.match(/\t/g) || []).length
  const semiCount = (text.match(/;/g) || []).length
  const commaCount = (text.match(/,/g) || []).length
  if (tabCount >= semiCount && tabCount >= commaCount && tabCount > 0) return '\t'
  if (semiCount >= commaCount && semiCount > 0) return ';'
  if (commaCount > 0) return ','
  return '\t'
}

// Parse the header line into column names using its own delimiter

// Data rows: split each row's raw output by the actual delimiter used.
// The simulator splits on &#9;/tab, but some models use ; or , instead.
const dataDelimiter = computed(() => {
  if (!result.value || result.value.rows.length === 0) return '\t'
  const raw = result.value.rows[0].raw.replace(/&#9;/g, '\t')
  return detectDelimiter(raw)
})

const dataRows = computed(() => {
  if (!result.value) return []
  const delim = dataDelimiter.value
  // If the delimiter is tab and the simulator already split correctly, use columns
  if (delim === '\t' && result.value.rows[0]?.columns.length > 1) {
    return result.value.rows.map((r) => r.columns)
  }
  // Otherwise re-split the raw output by the actual delimiter
  return result.value.rows.map((r) => {
    const raw = r.raw.replace(/&#9;/g, '\t')
    return splitCsvRow(raw, delim)
  })
})

const maxCols = computed(() => dataRows.value[0]?.length ?? 0)

// Build the raw file output for the "Raw" view
const fileOutput = computed(() => {
  if (!result.value) return ''
  return result.value.combined.replace(/&#9;/g, '\t')
})

const originalDiff = computed(() => {
  if (!store.snapshot) return null
  if (store.snapshot.repeatingCode === store.repeatingCode) return null
  return { before: store.snapshot.repeatingCode }
})
</script>

<template>
  <section class="space-y-3 p-3">
    <div>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700">Export preview</h2>
        <div class="flex gap-1">
          <button
            class="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
            @click="downloadSimCsv"
            title="Download gesimuleerde CSV (testdata)"
          >Sim CSV</button>
          <button
            class="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            :disabled="liveLoading"
            @click="downloadRealCsv"
            title="Download echte export via Pace API"
          >{{ liveLoading ? 'Laden...' : 'Echte CSV' }}</button>
          <button
            class="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
            @click="showRaw = !showRaw"
          >{{ showRaw ? 'Tabel' : 'Raw' }}</button>
        </div>
      </div>
      <p class="mb-2 text-[11px] text-slate-500">
        Zo ziet het exportbestand eruit (met testdata).
      </p>
      <div
        v-if="columnHeaders.length > 0 && dataRows.length > 0 && columnHeaders.length !== dataRows[0].length"
        class="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900"
      >
        <strong>Let op:</strong> Code Before header heeft {{ columnHeaders.length }} kolommen (;-gescheiden)
        maar de data heeft {{ dataRows[0].length }} kolommen (tab-gescheiden).
        Kolomnamen kunnen verschoven zijn. Controleer het template.
      </div>

      <p v-if="liveError" class="text-xs text-rose-700">{{ liveError }}</p>

      <pre v-if="showRaw" class="mono max-h-96 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs text-slate-100 whitespace-pre-wrap break-all">{{ fileOutput || '(leeg)' }}</pre>

      <div v-else-if="dataRows.length > 0" class="overflow-x-auto rounded border border-slate-200">
        <table class="w-full border-collapse text-[11px]">
          <thead>
            <tr class="bg-slate-100">
              <th
                v-for="ci in maxCols"
                :key="'h'+ci"
                class="whitespace-nowrap border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700"
              >{{ columnHeaders[ci - 1] || ci }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, ri) in dataRows"
              :key="ri"
              class="hover:bg-blue-50"
              :class="ri % 2 === 1 ? 'bg-slate-50' : 'bg-white'"
            >
              <td
                v-for="ci in maxCols"
                :key="ci"
                class="whitespace-nowrap border border-slate-200 px-2 py-1 text-slate-800"
                :class="(row[ci - 1]) ? '' : 'text-slate-300'"
              >{{ row[ci - 1] || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else-if="liveError" class="text-xs text-rose-700">{{ liveError }}</p>

      <p v-else-if="dataRows.length === 0" class="text-xs text-slate-500 italic">Geen template geladen.</p>
    </div>

    <!-- Diff with original -->
    <details v-if="originalDiff" class="rounded border border-amber-200 bg-amber-50">
      <summary class="cursor-pointer px-3 py-1.5 text-xs font-medium text-amber-700">
        Vergelijk met origineel
      </summary>
      <pre class="mono max-h-32 overflow-auto p-2 text-xs text-amber-900/70 whitespace-pre-wrap break-all">{{ originalDiff.before }}</pre>
    </details>
  </section>
</template>

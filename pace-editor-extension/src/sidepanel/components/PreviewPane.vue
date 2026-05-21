<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { buildAutoFixtures } from '@shared/auto-fixtures'
import { runSimulation } from '@shared/simulator'

import type { ExtensionMessage } from '@shared/messages'

const store = useEditorStore()
const showRaw = ref(false)
const previewMode = ref<'sim' | 'live'>('sim')
const liveOutput = ref('')
const liveLoading = ref(false)
const liveError = ref('')

async function runLiveExport(): Promise<void> {
  // Find the block ID from the models list or current snapshot
  const models = store.models
  const title = store.snapshot?.title
  const model = title ? models.find((m) => m.title === title) : null
  if (!model) {
    liveError.value = 'Kan het model niet vinden. Gebruik "Lezen" om het model eerst te laden.'
    return
  }
  liveLoading.value = true
  liveError.value = ''
  liveOutput.value = ''
  try {
    const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
      type: 'PACE_RUN_LIVE_EXPORT',
      blockId: model.id,
    })
    if (reply?.ok) {
      liveOutput.value = reply.output
      previewMode.value = 'live'
    } else {
      liveError.value = reply?.error ?? 'Export mislukt'
    }
  } catch (err) {
    liveError.value = (err as Error).message
  } finally {
    liveLoading.value = false
  }
}

// Parse live output into table rows
const liveRows = computed(() => {
  if (!liveOutput.value) return []
  const text = liveOutput.value.replace(/&#9;/g, '\t')
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return []
  const delim = detectDelimiter(lines[0])
  return lines.map((line) => splitCsvRow(line, delim))
})

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
            class="rounded border px-2 py-0.5 text-[11px] font-medium"
            :class="previewMode === 'sim' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'"
            @click="previewMode = 'sim'"
          >Simulatie</button>
          <button
            class="rounded border px-2 py-0.5 text-[11px] font-medium"
            :class="previewMode === 'live' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'"
            :disabled="liveLoading"
            @click="runLiveExport"
          >{{ liveLoading ? 'Laden...' : 'Live export' }}</button>
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

      <pre v-if="showRaw && previewMode === 'sim'" class="mono max-h-96 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs text-slate-100 whitespace-pre-wrap break-all">{{ fileOutput || '(leeg)' }}</pre>

      <pre v-else-if="showRaw && previewMode === 'live' && liveOutput" class="mono max-h-96 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs text-slate-100 whitespace-pre-wrap break-all">{{ liveOutput }}</pre>

      <div v-else-if="previewMode === 'sim' && dataRows.length > 0" class="overflow-x-auto rounded border border-slate-200">
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

      <!-- Live export output -->
      <p v-else-if="previewMode === 'live' && liveError" class="text-xs text-rose-700">{{ liveError }}</p>

      <div v-else-if="previewMode === 'live' && liveRows.length > 0" class="overflow-x-auto rounded border border-emerald-200">
        <div class="bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
          Live data van Pace ({{ liveRows.length }} rijen)
        </div>
        <table class="w-full border-collapse text-[11px]">
          <thead>
            <tr class="bg-slate-100">
              <th
                v-for="(_, ci) in liveRows[0]"
                :key="'lh'+ci"
                class="whitespace-nowrap border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700"
              >{{ liveRows[0][ci] || (ci + 1) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, ri) in liveRows.slice(1)"
              :key="'lr'+ri"
              class="hover:bg-blue-50"
              :class="ri % 2 === 1 ? 'bg-slate-50' : 'bg-white'"
            >
              <td
                v-for="(cell, ci) in row"
                :key="ci"
                class="whitespace-nowrap border border-slate-200 px-2 py-1 text-slate-800"
              >{{ cell || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else-if="previewMode === 'live' && !liveLoading" class="text-xs text-slate-500 italic">
        Klik "Live export" om echte data op te halen.
      </p>

      <p v-else-if="previewMode === 'sim' && dataRows.length === 0" class="text-xs text-slate-500 italic">Geen template geladen.</p>
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

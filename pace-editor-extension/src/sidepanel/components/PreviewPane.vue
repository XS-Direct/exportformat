<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { evaluate, createContext } from '@shared/evaluator'
import { parse } from '@shared/parser'
import { buildAutoFixtures } from '@shared/auto-fixtures'
import { runSimulation } from '@shared/simulator'

const store = useEditorStore()
const showRaw = ref(false)

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

// Evaluate Code Before separately to get the header line
const headerOutput = computed(() => {
  if (!store.codeBefore) return ''
  const tree = parse(store.codeBefore).tree
  const ctx = createContext(new Map(), 0)
  return evaluate(tree, ctx).replace(/&#9;/g, '\t').trim()
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
const headerNames = computed(() => {
  if (!headerOutput.value) return []
  const delim = detectDelimiter(headerOutput.value)
  return headerOutput.value.split(delim).map((s) => s.replace(/"/g, '').trim())
})

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

// Determine the max column count (header vs data)
const maxCols = computed(() => {
  const headerCols = headerNames.value.length
  const dataCols = dataRows.value[0]?.length ?? 0
  return Math.max(headerCols, dataCols)
})

// Build the raw file output for the "Raw" view
const fileOutput = computed(() => {
  if (!result.value) return ''
  const header = headerOutput.value
  const rows = result.value.rows.map((r) => r.raw.replace(/&#9;/g, '\t'))
  const afterTree = parse(store.codeAfter).tree
  const afterCtx = createContext(new Map(), 0)
  const footer = evaluate(afterTree, afterCtx).replace(/&#9;/g, '\t').trim()
  return [header, ...rows, footer].filter(Boolean).join('\n')
})

const delimiterLabel = computed(() => {
  const hd = headerOutput.value ? detectDelimiter(headerOutput.value) : ''
  return hd === '\t' ? 'tab' : hd || '?'
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
        <button
          class="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
          @click="showRaw = !showRaw"
        >{{ showRaw ? 'Tabel' : 'Raw' }}</button>
      </div>
      <p class="mb-2 text-[11px] text-slate-500">
        Zo ziet het exportbestand eruit (met testdata).
        <span v-if="headerNames.length > 0 && dataRows.length > 0 && headerNames.length !== dataRows[0].length" class="text-amber-600">
          Header: {{ headerNames.length }} kol. ({{ delimiterLabel }}) | Data: {{ dataRows[0]?.length }} kol. (tab)
        </span>
      </p>

      <!-- Raw file output -->
      <pre v-if="showRaw" class="mono max-h-96 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs text-slate-100 whitespace-pre-wrap break-all">{{ fileOutput || '(leeg)' }}</pre>

      <!-- Table view -->
      <div v-else-if="dataRows.length > 0 || headerNames.length > 0" class="overflow-x-auto rounded border border-slate-200">
        <table class="w-full border-collapse text-[11px]">
          <thead v-if="headerNames.length > 0">
            <tr class="bg-slate-100">
              <th
                v-for="ci in maxCols"
                :key="'h'+ci"
                class="whitespace-nowrap border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700"
              >{{ headerNames[ci - 1] || ci }}</th>
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

      <p v-else class="text-xs text-slate-500 italic">Geen template geladen.</p>
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

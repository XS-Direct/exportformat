<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../store'
import { runSimulation } from '@shared/simulator'
import { buildAutoFixtures } from '@shared/auto-fixtures'

const store = useEditorStore()

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

// Parse header names from Code Before
const headerNames = computed(() => {
  const raw = store.codeBefore
  if (!raw) return []
  const cleaned = raw.replace(/\$(?:var|storevar|rem)\[[^\]]*\](?:\[[^\]]*\])?/g, '').trim()
  if (!cleaned) return []
  let sep: string | RegExp
  if (cleaned.includes('&#9;') || cleaned.includes('\t')) {
    sep = /&#9;|\t/
  } else if (cleaned.includes(';')) {
    sep = ';'
  } else if (cleaned.includes(',')) {
    sep = ','
  } else {
    return [cleaned]
  }
  return cleaned.split(sep).map((s) => s.replace(/"/g, '').trim()).filter(Boolean)
})

const originalDiff = computed(() => {
  if (!store.snapshot) return null
  if (store.snapshot.repeatingCode === store.repeatingCode) return null
  return {
    before: store.snapshot.repeatingCode,
    after: store.repeatingCode,
  }
})
</script>

<template>
  <section class="space-y-3 p-3">
    <div>
      <h2 class="mb-1 text-sm font-semibold text-slate-700">Live preview</h2>
      <p class="mb-2 text-[11px] text-slate-500">
        Voorbeeld-output met automatisch gegenereerde testdata.
      </p>

      <div v-if="result && result.rows.length > 0" class="overflow-x-auto rounded border border-slate-200">
        <table class="w-full border-collapse text-[11px]">
          <!-- Header row from Code Before -->
          <thead v-if="headerNames.length > 0">
            <tr class="bg-slate-100">
              <th
                v-for="(name, i) in headerNames"
                :key="'h'+i"
                class="whitespace-nowrap border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700"
              >{{ name }}</th>
            </tr>
          </thead>
          <!-- Data rows -->
          <tbody>
            <tr
              v-for="(row, ri) in result.rows"
              :key="ri"
              class="hover:bg-blue-50"
              :class="ri % 2 === 1 ? 'bg-slate-50' : 'bg-white'"
            >
              <td
                v-for="(col, ci) in row.columns"
                :key="ci"
                class="whitespace-nowrap border border-slate-200 px-2 py-1 text-slate-800"
              >{{ col }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="headerNames.length > 0 && headerNames.length !== result.rows[0]?.columns.length" class="bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
          Header: {{ headerNames.length }} kolommen | Data: {{ result.rows[0]?.columns.length }} kolommen
        </div>
      </div>

      <p v-else class="text-xs text-slate-500 italic">Geen template geladen.</p>
    </div>

    <!-- Serialized raw code -->
    <details class="rounded border border-slate-200 bg-white">
      <summary class="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-600">
        Geserialiseerde code
      </summary>
      <pre class="mono max-h-48 overflow-auto bg-slate-900 p-2 text-xs text-slate-100 whitespace-pre-wrap break-all">{{ store.repeatingCode || '(leeg)' }}</pre>
    </details>

    <!-- Diff with original -->
    <details v-if="originalDiff" class="rounded border border-amber-200 bg-amber-50">
      <summary class="cursor-pointer px-3 py-1.5 text-xs font-medium text-amber-700">
        Vergelijk met origineel
      </summary>
      <pre class="mono max-h-32 overflow-auto p-2 text-xs text-amber-900/70 whitespace-pre-wrap break-all">{{ originalDiff.before }}</pre>
    </details>
  </section>
</template>

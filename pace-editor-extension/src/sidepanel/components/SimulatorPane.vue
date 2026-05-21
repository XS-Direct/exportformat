<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { runSimulation, toCsv, toTsv } from '@shared/simulator'
import { BUILTIN_FIXTURES } from '@shared/fixtures'
import { buildAutoFixtures } from '@shared/auto-fixtures'

const store = useEditorStore()

// Build auto-generated fixtures from the current template's field references
const autoFixture = computed(() => {
  if (!store.repeatingCode) return null
  return buildAutoFixtures(
    store.snapshot?.title ?? '',
    store.codeBefore,
    store.repeatingCode,
    store.codeAfter,
  )
})

// Filter built-in fixtures to only show those matching the current model
const matchingBuiltins = computed(() => {
  const title = store.snapshot?.title ?? ''
  if (!title) return []
  return BUILTIN_FIXTURES.filter(
    (b) => title.toLowerCase().includes(b.modelTitle.toLowerCase()),
  )
})

// All available fixture options: auto first, then matching built-ins
const availableFixtures = computed(() => {
  const list: { id: string; name: string }[] = []
  if (autoFixture.value) {
    list.push({ id: '__auto__', name: `${autoFixture.value.name}` })
  }
  for (const b of matchingBuiltins.value) {
    list.push({ id: b.id, name: b.name })
  }
  return list
})

const selectedFixtureId = ref('__auto__')

const activeBundle = computed(() => {
  if (selectedFixtureId.value === '__auto__') return autoFixture.value
  return BUILTIN_FIXTURES.find((b) => b.id === selectedFixtureId.value) ?? autoFixture.value
})

const result = computed(() => {
  if (!activeBundle.value) return null
  return runSimulation({
    codeBefore: store.codeBefore,
    repeatingCode: store.repeatingCode,
    codeAfter: store.codeAfter,
    bundle: activeBundle.value,
  })
})

const passingCount = computed(() => {
  if (!result.value) return 0
  return result.value.rows.filter((r) => r.diff.every((d) => d.ok)).length
})

const hasExpectations = computed(() => {
  return activeBundle.value?.scenarios.some((s) => s.expected) ?? false
})

function download(format: 'csv' | 'tsv'): void {
  if (!result.value) return
  const blob = new Blob(
    [format === 'csv' ? toCsv(result.value.rows) : toTsv(result.value.rows)],
    { type: 'text/plain;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeBundle.value?.id ?? 'export'}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="space-y-3 p-3">
    <header class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-700">Simulator</h2>
      <select
        v-if="availableFixtures.length > 1"
        v-model="selectedFixtureId"
        class="rounded border border-slate-300 px-1 py-0.5 text-xs"
      >
        <option v-for="f in availableFixtures" :key="f.id" :value="f.id">
          {{ f.name }}
        </option>
      </select>
    </header>

    <div v-if="!activeBundle || !result" class="text-xs text-slate-500">
      Geen template geladen.
    </div>

    <template v-else>
      <p v-if="hasExpectations" class="text-xs text-slate-600">
        <span class="font-semibold">{{ passingCount }}</span>
        van
        <span class="font-semibold">{{ result.rows.length }}</span>
        scenario's matchen het verwachte resultaat.
      </p>
      <p v-else class="text-xs text-slate-500">
        {{ result.rows.length }} scenario's met automatisch gegenereerde testdata.
        Geen verwachte output gedefinieerd — controleer de output hieronder visueel.
      </p>

      <div class="flex gap-1">
        <button
          class="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100"
          @click="download('tsv')"
        >Download .tsv</button>
        <button
          class="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100"
          @click="download('csv')"
        >Download .csv</button>
      </div>

      <div
        v-for="row in result.rows"
        :key="row.scenarioId"
        class="rounded border border-slate-200 bg-white"
      >
        <header class="flex items-center gap-2 border-b border-slate-100 px-2 py-1 text-xs">
          <span
            v-if="hasExpectations"
            class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            :class="row.diff.every((d) => d.ok)
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'"
          >{{ row.diff.every((d) => d.ok) ? 'pass' : 'fail' }}</span>
          <span class="font-medium text-slate-700">{{ row.scenarioId }}</span>
          <span class="ml-2 truncate text-slate-500">{{ row.description }}</span>
        </header>
        <table class="w-full table-fixed text-[11px]">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="w-10 px-2 py-1 text-left">#</th>
              <th class="px-2 py-1 text-left">Output</th>
              <th v-if="hasExpectations" class="px-2 py-1 text-left">Verwacht</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="d in row.diff"
              :key="d.index"
              :class="d.ok ? '' : 'bg-rose-50'"
            >
              <td class="px-2 py-1 text-slate-400">{{ d.index }}</td>
              <td class="mono break-all px-2 py-1 text-slate-800">{{ d.actual }}</td>
              <td v-if="hasExpectations" class="mono px-2 py-1 text-slate-600">
                <span v-if="d.expected === null || d.expected === undefined" class="italic">—</span>
                <span v-else>{{ d.expected }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

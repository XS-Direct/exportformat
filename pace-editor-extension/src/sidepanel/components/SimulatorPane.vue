<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { runSimulation, toCsv, toTsv } from '@shared/simulator'
import { BUILTIN_FIXTURES } from '@shared/fixtures'

const store = useEditorStore()
const selectedFixtureId = ref(BUILTIN_FIXTURES[0]?.id ?? '')

const fixture = computed(
  () => BUILTIN_FIXTURES.find((b) => b.id === selectedFixtureId.value) ?? BUILTIN_FIXTURES[0],
)

const result = computed(() => {
  if (!fixture.value) return null
  return runSimulation({
    codeBefore: store.codeBefore,
    repeatingCode: store.repeatingCode,
    codeAfter: store.codeAfter,
    bundle: fixture.value,
  })
})

const passingCount = computed(() => {
  if (!result.value) return 0
  return result.value.rows.filter((r) => r.diff.every((d) => d.ok)).length
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
  a.download = `${fixture.value!.id}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="space-y-3 p-3">
    <header class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-700">Simulator</h2>
      <select
        v-model="selectedFixtureId"
        class="rounded border border-slate-300 px-1 py-0.5 text-xs"
      >
        <option v-for="b in BUILTIN_FIXTURES" :key="b.id" :value="b.id">
          {{ b.name }}
        </option>
      </select>
    </header>

    <p class="text-xs text-slate-600">
      <span class="font-semibold">{{ passingCount }}</span>
      van
      <span class="font-semibold">{{ result?.rows.length ?? 0 }}</span>
      scenario's matchen het verwachte resultaat.
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
      v-for="row in result?.rows ?? []"
      :key="row.scenarioId"
      class="rounded border border-slate-200 bg-white"
    >
      <header class="flex items-center gap-2 border-b border-slate-100 px-2 py-1 text-xs">
        <span
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
            <th class="px-2 py-1 text-left">Actual</th>
            <th class="px-2 py-1 text-left">Expected</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="d in row.diff"
            :key="d.index"
            :class="d.ok ? '' : 'bg-rose-50'"
          >
            <td class="px-2 py-1 text-slate-400">{{ d.index }}</td>
            <td class="mono px-2 py-1 text-slate-800">{{ d.actual }}</td>
            <td class="mono px-2 py-1 text-slate-600">
              <span v-if="d.expected === null || d.expected === undefined" class="italic">—</span>
              <span v-else>{{ d.expected }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

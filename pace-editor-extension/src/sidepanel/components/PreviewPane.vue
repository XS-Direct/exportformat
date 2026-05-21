<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { runSimulation } from '@shared/simulator'
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
      <h2 class="mb-1 text-sm font-semibold text-slate-700">Geserialiseerd</h2>
      <pre class="mono max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2 text-xs">{{ store.repeatingCode }}</pre>
    </div>

    <div v-if="originalDiff" class="rounded border border-slate-200 bg-white p-2 text-xs">
      <p class="mb-1 text-[11px] font-semibold uppercase text-slate-500">Vorige versie</p>
      <pre class="mono max-h-32 overflow-auto text-slate-500">{{ originalDiff.before }}</pre>
    </div>

    <div>
      <div class="mb-1 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700">Preview met fixture</h2>
        <select
          v-model="selectedFixtureId"
          class="rounded border border-slate-300 px-1 py-0.5 text-xs"
        >
          <option v-for="b in BUILTIN_FIXTURES" :key="b.id" :value="b.id">
            {{ b.name }}
          </option>
        </select>
      </div>
      <pre
        v-if="result"
        class="mono max-h-72 overflow-auto rounded border border-slate-200 bg-slate-900 p-2 text-xs text-slate-100"
      >{{ result.combined }}</pre>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'

defineProps<{
  raw: string
  onChange: (raw: string) => void
}>()

const store = useEditorStore()
const query = ref('')
const customMode = ref(false)

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  const all = store.catalog
  if (!q) return all.slice(0, 25)
  return all
    .filter((e) => e.raw.toLowerCase().includes(q))
    .slice(0, 25)
})
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-center gap-1">
      <code class="mono rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900">
        {{ '{' + raw + '}' }}
      </code>
      <button
        class="ml-auto text-[11px] text-slate-500 underline-offset-2 hover:underline"
        @click="customMode = !customMode"
      >{{ customMode ? 'kies uit catalog' : 'aangepast' }}</button>
    </div>

    <input
      v-if="customMode"
      class="mono w-full rounded border border-slate-300 p-1.5 text-xs"
      :value="raw"
      @input="(e) => onChange((e.target as HTMLInputElement).value)"
    />

    <template v-else>
      <input
        v-model="query"
        class="w-full rounded border border-slate-300 p-1.5 text-xs"
        placeholder="zoek veld (id of label)"
      />
      <ul class="max-h-32 space-y-0.5 overflow-y-auto rounded border border-slate-200 bg-white p-1">
        <li v-if="!suggestions.length" class="px-1 py-0.5 text-[11px] italic text-slate-400">
          Geen resultaten — open een Pace modelEdit-pagina om de catalog te vullen.
        </li>
        <li
          v-for="entry in suggestions"
          :key="entry.raw"
          class="cursor-pointer rounded px-1 py-0.5 text-xs hover:bg-emerald-50"
          @click="onChange(entry.raw)"
        >
          <span class="font-semibold text-emerald-800">{{ entry.id }}</span>
          <span class="text-slate-500"> — {{ entry.label || '(geen label)' }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

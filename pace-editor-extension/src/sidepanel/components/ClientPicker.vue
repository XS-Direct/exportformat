<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEditorStore } from '../store'
import type { PaceModelInfo } from '@shared/messages'

const store = useEditorStore()
const search = ref('')
const loading = ref(true)

const emit = defineEmits<{
  select: [model: PaceModelInfo]
}>()

onMounted(async () => {
  await store.loadModels()
  loading.value = false
})

// Group models by client name
const clientGroups = computed(() => {
  const groups = new Map<string, PaceModelInfo[]>()
  for (const m of store.models) {
    const existing = groups.get(m.client) ?? []
    existing.push(m)
    groups.set(m.client, existing)
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

// Filter by search
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return clientGroups.value
  return clientGroups.value.filter(([client, models]) =>
    client.toLowerCase().includes(q) ||
    models.some((m) => m.title.toLowerCase().includes(q)),
  )
})
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Search -->
    <div class="border-b border-slate-200 bg-white px-3 py-2">
      <input
        v-model="search"
        class="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
        placeholder="Zoek klant of export..."
        autofocus
      />
    </div>

    <!-- Client list -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="p-4 text-center text-sm text-slate-400">
        Modellen laden...
      </div>

      <div v-else-if="filtered.length === 0" class="p-4 text-center text-sm text-slate-400">
        Geen klanten gevonden.
      </div>

      <div v-else>
        <div
          v-for="[client, models] in filtered"
          :key="client"
          class="border-b border-slate-100 px-3 py-2 hover:bg-slate-50"
        >
          <div class="text-sm font-semibold text-slate-800">{{ client }}</div>
          <div class="mt-1 flex flex-wrap gap-1">
            <button
              v-for="m in models"
              :key="m.id"
              class="rounded px-2.5 py-1 text-xs font-medium transition-colors"
              :class="m.type === 'download'
                ? 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                : m.type === 'export'
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
              @click="emit('select', m)"
            >
              <span v-if="m.type === 'download'">Download</span>
              <span v-else-if="m.type === 'export'">Export</span>
              <span v-else>{{ m.title }}</span>
              <span class="ml-1 text-[10px] opacity-60">#{{ m.id }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-400">
      {{ store.models.length }} modellen gevonden
    </div>
  </div>
</template>

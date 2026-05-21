<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEditorStore } from '../store'
import type { PaceModelInfo } from '@shared/messages'

const store = useEditorStore()
const search = ref('')
const loading = ref(true)

const emit = defineEmits<{
  select: [model: PaceModelInfo]
  create: [type: 'download' | 'export', client: string, basedOn: PaceModelInfo]
}>()

onMounted(async () => {
  await store.loadModels()
  loading.value = false
})

interface ClientGroup {
  client: string
  download: PaceModelInfo | null
  export_: PaceModelInfo | null
  others: PaceModelInfo[]
}

const clientGroups = computed<ClientGroup[]>(() => {
  const groups = new Map<string, PaceModelInfo[]>()
  for (const m of store.models) {
    const existing = groups.get(m.client) ?? []
    existing.push(m)
    groups.set(m.client, existing)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([client, models]) => ({
      client,
      download: models.find((m) => m.type === 'download') ?? null,
      export_: models.find((m) => m.type === 'export') ?? null,
      others: models.filter((m) => m.type === 'other'),
    }))
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return clientGroups.value
  return clientGroups.value.filter((g) =>
    g.client.toLowerCase().includes(q) ||
    g.download?.title.toLowerCase().includes(q) ||
    g.export_?.title.toLowerCase().includes(q),
  )
})

function handleCreate(type: 'download' | 'export', group: ClientGroup): void {
  const basedOn = type === 'download' ? group.export_! : group.download!
  emit('create', type, group.client, basedOn)
}
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
          v-for="group in filtered"
          :key="group.client"
          class="border-b border-slate-100 px-3 py-2 hover:bg-slate-50"
        >
          <div class="text-sm font-semibold text-slate-800">{{ group.client }}</div>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <!-- Download button (solid if exists, dashed if missing) -->
            <button
              v-if="group.download"
              class="rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-200"
              @click="emit('select', group.download!)"
            >
              Download
              <span class="ml-1 text-[10px] opacity-60">#{{ group.download.id }}</span>
            </button>
            <button
              v-else-if="group.export_"
              class="rounded border-2 border-dashed border-sky-300 px-2.5 py-1 text-xs font-medium text-sky-500 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
              title="Maak Download aan op basis van Export"
              @click="handleCreate('download', group)"
            >+ Download</button>

            <!-- Export button (solid if exists, dashed if missing) -->
            <button
              v-if="group.export_"
              class="rounded bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200"
              @click="emit('select', group.export_!)"
            >
              Export
              <span class="ml-1 text-[10px] opacity-60">#{{ group.export_.id }}</span>
            </button>
            <button
              v-else-if="group.download"
              class="rounded border-2 border-dashed border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-500 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
              title="Maak Export aan op basis van Download (voegt <<exportedId>> toe)"
              @click="handleCreate('export', group)"
            >+ Export</button>

            <!-- Other models -->
            <button
              v-for="m in group.others"
              :key="m.id"
              class="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              @click="emit('select', m)"
            >
              {{ m.title }}
              <span class="ml-1 text-[10px] opacity-60">#{{ m.id }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-400">
      {{ store.models.length }} modellen &middot; {{ clientGroups.length }} klanten
    </div>
  </div>
</template>

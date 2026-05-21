<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { serialize } from '@shared/serializer'
import { parse } from '@shared/parser'
import { extractAllFieldRefs } from '@shared/auto-fixtures'
import type { ExtensionMessage, PaceModelInfo } from '@shared/messages'
import ColumnEditor from './ColumnEditor.vue'
import BlockTree from './BlockTree.vue'

const store = useEditorStore()
const mode = ref<'columns' | 'blocks' | 'raw'>('columns')
const showImport = ref(false)
const importing = ref(false)

// Find sibling models (same client, different type) + all other models
const importOptions = computed(() => {
  const current = store.snapshot?.title ?? ''
  return store.models.filter((m) => m.title !== current)
})

async function importFrom(model: PaceModelInfo): Promise<void> {
  importing.value = true
  try {
    const reply = await chrome.runtime.sendMessage<ExtensionMessage>({
      type: 'PACE_REQUEST_SNAPSHOT_BY_ID',
      blockId: model.id,
    })
    if (reply?.ok && reply.snapshot) {
      store.codeBefore = reply.snapshot.codeBefore
      store.repeatingCode = reply.snapshot.repeatingCode
      store.codeAfter = reply.snapshot.codeAfter
    }
  } catch { /* silent */ }
  importing.value = false
  showImport.value = false
}

const tree = computed(() => store.parsed.tree)

function applyTree(next: ReturnType<typeof parse>['tree']): void {
  store.repeatingCode = serialize(next)
}

const usedFields = computed(() =>
  extractAllFieldRefs(store.codeBefore, store.repeatingCode, store.codeAfter),
)
</script>

<template>
  <section class="space-y-3 p-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-700">Repeating code</h2>
      <div class="flex gap-0.5 rounded border border-slate-200 bg-slate-100 p-0.5 text-[11px]">
        <button
          class="rounded px-2 py-0.5"
          :class="mode === 'columns' ? 'bg-white font-semibold text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'"
          @click="mode = 'columns'"
        >Kolommen</button>
        <button
          class="rounded px-2 py-0.5"
          :class="mode === 'blocks' ? 'bg-white font-semibold text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'"
          @click="mode = 'blocks'"
        >Blokken</button>
        <button
          class="rounded px-2 py-0.5"
          :class="mode === 'raw' ? 'bg-white font-semibold text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'"
          @click="mode = 'raw'"
        >Raw</button>
      </div>
    </div>

    <!-- Import from other model -->
    <div class="flex items-center gap-1">
      <button
        class="rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100"
        @click="showImport = !showImport; if (showImport) store.loadModels()"
      >Importeer van...</button>
    </div>

    <div v-if="showImport" class="rounded border border-violet-200 bg-violet-50 p-2">
      <p class="mb-1.5 text-[11px] text-violet-800">Kies een model om de code over te nemen:</p>
      <div class="max-h-48 overflow-y-auto space-y-0.5">
        <button
          v-for="m in importOptions"
          :key="m.id"
          class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-violet-100"
          :disabled="importing"
          @click="importFrom(m)"
        >
          <span
            class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
            :class="m.type === 'download' ? 'bg-sky-100 text-sky-800' : m.type === 'export' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'"
          >{{ m.type === 'download' ? 'DL' : m.type === 'export' ? 'EX' : '?' }}</span>
          <span class="font-medium text-slate-800">{{ m.client }}</span>
          <span class="text-[10px] text-slate-400">{{ m.title }} #{{ m.id }}</span>
        </button>
      </div>
    </div>

    <details class="rounded border border-slate-200 bg-white">
      <summary class="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-600">
        Code before / Code after
      </summary>
      <div class="space-y-2 p-3">
        <label class="block text-[11px] font-semibold uppercase text-slate-500">Code before</label>
        <textarea
          v-model="store.codeBefore"
          class="mono w-full rounded border border-slate-300 p-2 text-xs"
          rows="3"
          spellcheck="false"
        />
        <label class="block text-[11px] font-semibold uppercase text-slate-500">Code after</label>
        <textarea
          v-model="store.codeAfter"
          class="mono w-full rounded border border-slate-300 p-2 text-xs"
          rows="3"
          spellcheck="false"
        />
      </div>
    </details>

    <!-- Parse errors -->
    <div
      v-if="store.parsed.hasErrors"
      class="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900"
    >
      <p class="font-semibold">Parser-fouten</p>
      <ul class="mt-1 list-disc pl-5">
        <li v-for="(e, i) in store.parsed.errors" :key="i">{{ e }}</li>
      </ul>
    </div>

    <!-- Stats bar -->
    <div class="flex gap-3 text-[11px] text-slate-500">
      <span>{{ usedFields.length }} velden</span>
      <span>{{ tree.length }} blokken</span>
      <span v-if="store.dirty" class="font-semibold text-amber-700">Niet opgeslagen</span>
    </div>

    <!-- Column editor (default) -->
    <ColumnEditor v-if="mode === 'columns'" />

    <!-- Block tree editor (advanced) -->
    <div v-else-if="mode === 'blocks'" class="rounded border border-slate-200 bg-white p-2">
      <BlockTree :nodes="tree" :on-change="applyTree" />
    </div>

    <!-- Raw editor -->
    <textarea
      v-else
      v-model="store.repeatingCode"
      class="mono w-full rounded border border-slate-300 p-2 text-xs"
      rows="14"
      spellcheck="false"
    />
  </section>
</template>

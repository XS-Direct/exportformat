<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { serialize } from '@shared/serializer'
import { parse } from '@shared/parser'
import { extractAllFieldRefs } from '@shared/auto-fixtures'
import ColumnEditor from './ColumnEditor.vue'
import BlockTree from './BlockTree.vue'

const store = useEditorStore()
const mode = ref<'columns' | 'blocks' | 'raw'>('columns')

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

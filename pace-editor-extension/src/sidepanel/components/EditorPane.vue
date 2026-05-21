<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../store'
import { serialize } from '@shared/serializer'
import { parse } from '@shared/parser'
import BlockTree from './BlockTree.vue'

const store = useEditorStore()
const mode = ref<'visual' | 'raw'>('visual')

// Mutating the IR rewrites the textarea via serialize. We keep the tree
// reactive by re-parsing on demand rather than maintaining a parallel
// editable IR — small templates parse in well under a millisecond, and
// avoiding parallel state keeps round-trip identity trivially correct.
const tree = computed(() => store.parsed.tree)

function applyTree(next: ReturnType<typeof parse>['tree']): void {
  store.repeatingCode = serialize(next)
}
</script>

<template>
  <section class="space-y-3 p-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-700">Repeating code</h2>
      <div class="flex gap-1 text-xs">
        <button
          class="rounded border px-2 py-1"
          :class="mode === 'visual'
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-slate-300 text-slate-600'"
          @click="mode = 'visual'"
        >Visueel</button>
        <button
          class="rounded border px-2 py-1"
          :class="mode === 'raw'
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-slate-300 text-slate-600'"
          @click="mode = 'raw'"
        >Raw</button>
      </div>
    </div>

    <details class="rounded border border-slate-200 bg-white">
      <summary class="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-600">
        Code before / Code after
      </summary>
      <div class="space-y-2 p-3">
        <label class="block text-[11px] font-semibold uppercase text-slate-500">
          Code before
        </label>
        <textarea
          v-model="store.codeBefore"
          class="mono w-full rounded border border-slate-300 p-2"
          rows="3"
        />
        <label class="block text-[11px] font-semibold uppercase text-slate-500">
          Code after
        </label>
        <textarea
          v-model="store.codeAfter"
          class="mono w-full rounded border border-slate-300 p-2"
          rows="3"
        />
      </div>
    </details>

    <div
      v-if="store.parsed.hasErrors"
      class="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900"
    >
      <p class="font-semibold">Parser-fouten</p>
      <ul class="mt-1 list-disc pl-5">
        <li v-for="(e, i) in store.parsed.errors" :key="i">{{ e }}</li>
      </ul>
    </div>

    <div v-if="mode === 'visual'" class="rounded border border-slate-200 bg-white p-2">
      <BlockTree :nodes="tree" :on-change="applyTree" />
    </div>

    <textarea
      v-else
      v-model="store.repeatingCode"
      class="mono w-full rounded border border-slate-300 p-2"
      rows="14"
      spellcheck="false"
    />
  </section>
</template>

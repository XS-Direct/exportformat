<script setup lang="ts">
import { useEditorStore } from '../store'

const store = useEditorStore()

async function send(): Promise<void> {
  await store.sendRepeatingCode()
}
</script>

<template>
  <footer class="border-t border-slate-200 bg-white px-3 py-2">
    <div class="flex items-center gap-2 text-xs">
      <span class="text-slate-500">Velden in catalog:</span>
      <span class="font-medium text-slate-700">{{ store.catalog.length }}</span>
      <span
        v-if="!store.roundTripOk && !store.parsed.hasErrors"
        class="ml-auto rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-900"
        title="serialize(parse(x)) wijkt af van de bron — meld dit"
      >Round-trip mismatch</span>
      <button
        class="ml-auto rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100"
        :disabled="!store.dirty"
        :class="{ 'opacity-50 cursor-not-allowed': !store.dirty }"
        @click="store.revertChanges()"
      >
        Reset
      </button>
      <button
        class="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        :disabled="!store.dirty || store.writing || store.parsed.hasErrors"
        @click="send"
      >
        {{ store.writing ? 'Bezig…' : 'Send to Pace' }}
      </button>
    </div>
    <p
      v-if="store.writeError"
      class="mt-1 text-xs"
      :class="store.copiedToClipboard ? 'text-amber-700' : 'text-rose-700'"
    >{{ store.writeError }}</p>
  </footer>
</template>

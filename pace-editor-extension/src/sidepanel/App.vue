<script setup lang="ts">
import { onMounted } from 'vue'
import { useEditorStore } from './store'
import HeaderBar from './components/HeaderBar.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import SimulatorPane from './components/SimulatorPane.vue'
import SettingsPane from './components/SettingsPane.vue'
import StatusBar from './components/StatusBar.vue'

const store = useEditorStore()

onMounted(() => {
  void store.loadSnapshot()
})
</script>

<template>
  <HeaderBar />
  <main class="flex-1 overflow-y-auto">
    <div
      v-if="store.loadError"
      class="m-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p class="font-semibold">Kon Pace niet uitlezen</p>
      <p class="mt-1">{{ store.loadError }}</p>
      <button
        class="mt-2 rounded bg-amber-700 px-2 py-1 text-xs font-medium text-white hover:bg-amber-800"
        @click="store.loadSnapshot()"
      >
        Opnieuw proberen
      </button>
    </div>

    <div
      v-else-if="store.snapshot && store.snapshot.outputFormat === 'json'"
      class="m-3 rounded border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900"
    >
      Dit model heeft JSON-output. De visuele editor ondersteunt voorlopig alleen
      <strong>Custom</strong> output. Codes worden alleen-lezen weergegeven.
    </div>

    <EditorPane v-show="store.tab === 'editor'" />
    <PreviewPane v-show="store.tab === 'preview'" />
    <SimulatorPane v-show="store.tab === 'simulator'" />
    <SettingsPane v-show="store.tab === 'settings'" />
  </main>
  <StatusBar />
</template>

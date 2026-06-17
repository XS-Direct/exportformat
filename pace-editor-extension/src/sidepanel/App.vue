<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEditorStore } from './store'
import type { PaceModelInfo } from '@shared/messages'
import ClientPicker from './components/ClientPicker.vue'
import HeaderBar from './components/HeaderBar.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import ExportPane from './components/ExportPane.vue'
import SimulatorPane from './components/SimulatorPane.vue'
import AiAssistant from './components/AiAssistant.vue'
import MonitorPane from './components/MonitorPane.vue'
import SettingsPane from './components/SettingsPane.vue'
import StatusBar from './components/StatusBar.vue'

const store = useEditorStore()
const screen = ref<'picker' | 'editor'>('picker')

onMounted(async () => {
  await store.loadModels()
})

async function onSelectModel(model: PaceModelInfo): Promise<void> {
  await store.loadSnapshotById(model.id)
  screen.value = 'editor'
}

async function onCreateModel(type: 'download' | 'export', client: string, basedOn: PaceModelInfo): Promise<void> {
  // Load the existing model as starting point
  await store.loadSnapshotById(basedOn.id)
  screen.value = 'editor'

  if (type === 'export') {
    // Creating Export from Download: add <<exportedId>> and newline
    let code = store.repeatingCode
    if (!code.endsWith('\n')) code += '\n'
    if (!code.includes('<<exportedId=')) {
      code += '<<exportedId={471: id}>>\n'
    }
    store.repeatingCode = code
  } else {
    // Creating Download from Export: remove <<exportedId>> and <<...>> directives
    store.repeatingCode = store.repeatingCode
      .replace(/\n<<exportedId=[^>]+>>\s*/g, '\n')
      .replace(/\n<<[^>]+>>\s*$/g, '\n')
  }

  // Update the snapshot title to reflect the new model
  const newTitle = type === 'download' ? `download${client.replace(/\s/g, '')}` : `export${client.replace(/\s/g, '')}`
  if (store.snapshot) {
    store.snapshot = { ...store.snapshot, title: newTitle }
  }
}

function backToPicker(): void {
  screen.value = 'picker'
}
</script>

<template>
  <!-- Start screen: Client/model picker -->
  <div v-if="screen === 'picker'" class="flex h-full flex-col">
    <div class="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <div class="text-sm font-semibold text-slate-800">Pace Editor</div>
      <div class="ml-auto text-[11px] text-slate-400">Kies een klant</div>
    </div>
    <ClientPicker @select="onSelectModel" @create="onCreateModel" />
  </div>

  <!-- Editor screen -->
  <template v-else>
    <HeaderBar @back="backToPicker" />
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

      <EditorPane v-show="store.tab === 'editor'" />
      <PreviewPane v-show="store.tab === 'preview'" />
      <ExportPane v-show="store.tab === 'export'" />
      <SimulatorPane v-show="store.tab === 'simulator'" />
      <AiAssistant v-show="store.tab === 'ai'" />
      <MonitorPane v-show="store.tab === 'monitor'" />
      <SettingsPane v-show="store.tab === 'settings'" />
    </main>
    <StatusBar />
  </template>
</template>

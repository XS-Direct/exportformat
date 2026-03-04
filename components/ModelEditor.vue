<template>
  <div v-if="model" class="flex flex-col h-full">
    <!-- Header -->
    <div class="p-4 bg-white border-b border-gray-200 flex items-center gap-4">
      <input
        v-model="model.title"
        class="text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
        @change="save"
      />

      <div class="flex items-center gap-3 ml-auto">
        <label class="flex items-center gap-2 text-sm">
          <span class="text-gray-500">Type:</span>
          <select
            v-model="model.type"
            class="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
            @change="save"
          >
            <option value="download">Download (test)</option>
            <option value="export">Export</option>
          </select>
        </label>

        <label class="flex items-center gap-2 text-sm">
          <span class="text-gray-500">Output:</span>
          <select
            v-model="model.outputFormat"
            class="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
            @change="save"
          >
            <option value="custom">Custom</option>
            <option value="json">JSON</option>
          </select>
        </label>

        <button
          class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
          @click="save"
        >
          Opslaan
        </button>

        <button
          class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
          @click="handleDelete"
        >
          Verwijder
        </button>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Editor panels -->
      <div class="flex-1 flex flex-col overflow-auto p-4 gap-4">
        <!-- Code Before -->
        <div class="bg-white rounded border border-gray-200">
          <div class="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Code before (header)
          </div>
          <textarea
            v-model="model.codeBefore"
            class="w-full p-3 font-mono text-sm resize-none focus:outline-none"
            rows="6"
            placeholder="Header template code..."
            spellcheck="false"
            @input="debouncedPreview"
          />
        </div>

        <!-- Repeating Code -->
        <div class="bg-white rounded border border-gray-200">
          <div class="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Repeating code (per row)
          </div>
          <textarea
            v-model="model.repeatingCode"
            class="w-full p-3 font-mono text-sm resize-none focus:outline-none"
            rows="10"
            placeholder="Repeating row template code..."
            spellcheck="false"
            @input="debouncedPreview"
          />
        </div>

        <!-- Code After -->
        <div class="bg-white rounded border border-gray-200">
          <div class="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Code after (footer)
          </div>
          <textarea
            v-model="model.codeAfter"
            class="w-full p-3 font-mono text-sm resize-none focus:outline-none"
            rows="4"
            placeholder="Footer template code..."
            spellcheck="false"
            @input="debouncedPreview"
          />
        </div>
      </div>

      <!-- Right panel: mock fields + preview -->
      <div class="w-96 flex flex-col border-l border-gray-200 overflow-auto">
        <!-- Mock Fields -->
        <MockFields :model="model" @update="debouncedPreview" />

        <!-- Preview -->
        <PreviewPanel :output="previewOutput" :output-format="model.outputFormat" />
      </div>
    </div>
  </div>

  <div v-else class="flex items-center justify-center h-full text-gray-400">
    <div class="text-center">
      <p class="text-lg">Selecteer een model of maak een nieuw model aan</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { activeModel: model, updateModel, deleteModel } = useModels()
const { generatePreview } = useParser()

const previewOutput = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function updatePreview() {
  if (!model.value) return
  previewOutput.value = generatePreview(
    model.value.codeBefore,
    model.value.repeatingCode,
    model.value.codeAfter,
    model.value.mockFields,
    3
  )
}

function debouncedPreview() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(updatePreview, 200)
}

async function save() {
  if (!model.value) return
  await updateModel(model.value)
  updatePreview()
}

async function handleDelete() {
  if (!model.value?.id) return
  if (confirm(`Weet je zeker dat je "${model.value.title}" wilt verwijderen?`)) {
    await deleteModel(model.value.id)
  }
}

watch(model, () => {
  updatePreview()
}, { immediate: true, deep: false })

watch(() => model.value?.id, () => {
  updatePreview()
})
</script>

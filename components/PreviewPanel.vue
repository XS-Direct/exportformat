<template>
  <div class="flex-1 flex flex-col min-h-0">
    <div class="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
      <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Preview output</span>
      <div class="flex gap-2">
        <button
          class="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition"
          @click="copyOutput"
        >
          {{ copied ? 'Gekopieerd!' : 'Kopieer' }}
        </button>
        <button
          class="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition"
          @click="downloadOutput"
        >
          Download
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto bg-gray-900 p-3">
      <pre class="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">{{ output || 'Voer template code in om de preview te zien...' }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  output: string
  outputFormat: string
}>()

const copied = ref(false)

function copyOutput() {
  navigator.clipboard.writeText(props.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function downloadOutput() {
  const ext = props.outputFormat === 'json' ? 'json' : 'txt'
  const blob = new Blob([props.output], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `export-preview.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

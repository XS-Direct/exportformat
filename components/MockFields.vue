<template>
  <div class="border-b border-gray-200">
    <div class="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
      <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Mock velden</span>
      <button
        class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        @click="addField"
      >
        + Veld
      </button>
    </div>

    <div class="p-3 space-y-2 max-h-64 overflow-y-auto">
      <div v-if="!model.mockFields.length" class="text-xs text-gray-400 text-center py-2">
        Voeg mock velden toe die overeenkomen met {id: label} referenties in je template
      </div>

      <div
        v-for="(field, idx) in model.mockFields"
        :key="idx"
        class="flex gap-1 items-start"
      >
        <input
          v-model="field.id"
          class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono"
          placeholder="34-445: Person: Sex"
          @input="$emit('update')"
        />
        <input
          v-model="field.value"
          class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Mock waarde"
          @input="$emit('update')"
        />
        <button
          class="text-red-400 hover:text-red-600 px-1 text-sm"
          @click="removeField(idx)"
        >
          &times;
        </button>
      </div>
    </div>

    <div class="px-3 pb-3">
      <button
        class="w-full text-xs px-2 py-1.5 border border-dashed border-gray-300 text-gray-500 rounded hover:border-blue-400 hover:text-blue-500 transition"
        @click="detectFields"
      >
        Auto-detect velden uit template
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExportModel, MockField } from '~/composables/useModels'

const props = defineProps<{ model: ExportModel }>()
const emit = defineEmits<{ update: [] }>()

function addField() {
  props.model.mockFields.push({ id: '', label: '', value: '' })
  emit('update')
}

function removeField(idx: number) {
  props.model.mockFields.splice(idx, 1)
  emit('update')
}

function detectFields() {
  const allCode = `${props.model.codeBefore}\n${props.model.repeatingCode}\n${props.model.codeAfter}`
  const regex = /\{([^}]+)\}/g
  let match
  const existingIds = new Set(props.model.mockFields.map((f) => f.id))

  while ((match = regex.exec(allCode)) !== null) {
    const ref = match[1].trim()
    // Skip if it looks like a function or already exists
    if (ref.startsWith('$') || existingIds.has(ref)) continue
    existingIds.add(ref)

    // Try to split "id: label" format
    const parts = ref.split(':').map((s) => s.trim())
    props.model.mockFields.push({
      id: ref,
      label: parts.length > 1 ? parts.slice(1).join(': ') : parts[0],
      value: '',
    })
  }

  emit('update')
}
</script>

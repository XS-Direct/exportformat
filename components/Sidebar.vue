<template>
  <aside class="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
    <div class="p-4 border-b border-gray-200">
      <h1 class="text-lg font-bold text-gray-800">Export Formatter</h1>
      <p class="text-xs text-gray-500 mt-1">Legacy PHP formatting tool</p>
    </div>

    <div class="p-3 border-b border-gray-200">
      <button
        class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
        @click="createModel"
      >
        + Nieuw model
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto">
      <div
        v-for="model in models"
        :key="model.id"
        class="px-3 py-2 mx-2 my-1 rounded cursor-pointer text-sm flex items-center justify-between group"
        :class="model.id === activeModelId ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-700 hover:bg-gray-50'"
        @click="activeModelId = model.id!"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="inline-block w-2 h-2 rounded-full flex-shrink-0"
            :class="model.type === 'export' ? 'bg-orange-400' : 'bg-green-400'"
          />
          <span class="truncate">{{ model.title }}</span>
        </div>
        <span class="text-xs text-gray-400 flex-shrink-0">{{ model.type }}</span>
      </div>

      <div v-if="!models.length && !loading" class="p-4 text-sm text-gray-400 text-center">
        Geen modellen gevonden
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
const { models, activeModelId, loading, createModel } = useModels()
</script>

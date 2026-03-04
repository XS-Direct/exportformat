<template>
  <ModelEditor />
</template>

<script setup lang="ts">
const { fetchModels } = useModels()

onMounted(() => {
  fetchModels()
})
</script>

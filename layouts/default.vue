<template>
  <div class="flex h-screen bg-gray-100">
    <Sidebar />
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>

<template>
  <main class="right-view-layout">
    <slot />
  </main>
</template>

<style scoped>
.right-view-layout {
  height: 100%;
  border-left: 1px solid #eee;
  width: 100%;
  min-width: 0;
}
</style>

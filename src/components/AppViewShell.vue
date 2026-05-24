<template>
  <!-- This component provides the shared page shell with header and content slots. -->
  <div class="app-view-shell">
    <!-- Reserve the top area for the common application header. -->
    <header class="app-view-header">
      <HeaderBar />
    </header>

    <!-- Render an optional toolbar slot between the header and page body. -->
    <div v-if="$slots.toolbar" class="app-view-toolbar">
      <slot name="toolbar" />
    </div>

    <!-- Render the main page content in the flexible body area. -->
    <main class="app-view-body">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import HeaderBar from "@/components/HeaderBar.vue";
</script>

<style lang="scss" scoped>
.app-view-shell {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-view-header {
  height: 48px;
  flex: 0 0 auto;
}

.app-view-toolbar {
  flex: 0 0 auto;
}

.app-view-body {
  flex: 1 1 auto;
  min-height: 0;
}
</style>

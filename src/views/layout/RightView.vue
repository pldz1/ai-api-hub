<template>
  <section class="right-view-layout">
    <header v-if="$slots.header" class="right-view-header">
      <slot name="header" />
    </header>

    <main class="right-view-main">
      <slot />
    </main>

    <footer v-if="$slots.footer" class="right-view-footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.right-view-layout {
  height: 100%;
  border-left: 1px solid oklch(var(--bc) / 0.08);
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-view-header,
.right-view-footer {
  flex: 0 0 auto;
}

.right-view-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
</style>

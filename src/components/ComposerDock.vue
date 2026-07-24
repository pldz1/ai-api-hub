<template>
  <footer class="composer-dock">
    <slot />
  </footer>
</template>

<style scoped lang="scss">
.composer-dock {
  position: relative;
  width: 100%;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  box-sizing: border-box;
  padding: 10px 18px max(14px, env(safe-area-inset-bottom));
}

@media (max-width: 640px) {
  .composer-dock {
    padding: 8px 8px max(10px, env(safe-area-inset-bottom));
  }
}
</style>

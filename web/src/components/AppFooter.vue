<template>
  <footer class="app-footer">
    <span class="app-footer-copy">
      AI API HUB · v0.0.1 ·
      <a href="https://github.com/pldz1/ai-api-hub" target="_blank" rel="noopener noreferrer">Made by pldz1</a>
    </span>
  </footer>
</template>

<style lang="scss" scoped>
.app-footer {
  flex: 0 0 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  background-image: none !important;
  backdrop-filter: none;
  color: oklch(var(--bc) / 0.56);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  z-index: 999;
  user-select: none;
}

.app-footer-copy {
  display: inline-block;
  user-select: text;
  cursor: text;
}

.app-footer-copy a {
  color: inherit;
  text-decoration: none;
  user-select: text;
  cursor: text;
}

.app-footer-copy a:hover {
  text-decoration: underline;
}
</style>

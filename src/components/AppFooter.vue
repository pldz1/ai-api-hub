<template>
  <!-- This component renders the application footer and credit link. -->
  <footer class="app-footer">
    <!-- Keep the product version and repository credit in one compact line. -->
    <span class="app-footer-copy">
      <a :href="REPO_SOURCE_LINK" target="_blank" rel="noopener noreferrer">{{ APP_NAME + "·" + APP_VERSION }}</a>
    </span>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { APP_NAME, APP_VERSION, REPO_SOURCE_LINK } from "@/constants";

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.app-footer {
  flex: 0 0 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  cursor: pointer;
}

.app-footer-copy a:hover {
  text-decoration: underline;
}
</style>

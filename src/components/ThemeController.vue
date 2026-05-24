<template>
  <!-- This component lets users switch the active application theme. -->
  <!-- Pair the theme selector with a tooltip and dropdown menu. -->
  <AppTooltip :text="t('theme.tooltip')" placement="bottom">
    <AppDropdownMenu :items="themeOptions" placement="bottom-end" :width="140" @select="handleThemeChange">
      <!-- Use a compact trigger button that opens the theme list. -->
      <template #trigger="{ toggle }">
        <button type="button" class="btn m-1 btn-color1" @click="toggle">
          {{ t("theme.label") }}
          <svg width="12px" height="12px" class="inline-block h-2 w-2 fill-current opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
            <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
          </svg>
        </button>
      </template>
    </AppDropdownMenu>
  </AppTooltip>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { applyTheme, getStoredTheme } from "@/utils/theme";
import AppTooltip from "@/components/AppTooltip.vue";
import AppDropdownMenu from "@/components/AppDropdownMenu.vue";

type ThemeOption = {
  key: string;
  value: string;
  label: string;
  active: boolean;
};

const { t } = useI18n();
const currentTheme = ref(getStoredTheme());
const themeOptions = computed<ThemeOption[]>(() => [
  { key: "light", value: "light", label: t("theme.options.light"), active: currentTheme.value === "light" },
  { key: "dark", value: "dark", label: t("theme.options.dark"), active: currentTheme.value === "dark" },
  { key: "cupcake", value: "cupcake", label: t("theme.options.cupcake"), active: currentTheme.value === "cupcake" },
  { key: "acid", value: "acid", label: t("theme.options.acid"), active: currentTheme.value === "acid" },
  { key: "lemonade", value: "lemonade", label: t("theme.options.lemonade"), active: currentTheme.value === "lemonade" },
]);

const handleThemeChange = (item: ThemeOption) => {
  currentTheme.value = item.value;
  applyTheme(item.value);
};
</script>

<style lang="scss" scoped>
.btn-color1 {
  background-color: transparent;
  box-shadow: initial;
  border-color: transparent;

  &:hover {
    background-color: oklch(var(--nc) / 0.1);
  }
}
</style>

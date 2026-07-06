<template>
  <!-- This component lets users switch the application language. -->
  <!-- Pair the language selector with a tooltip and dropdown menu. -->
  <AppTooltip :text="t('language.tooltip')" placement="bottom">
    <AppDropdownMenu :items="localeOptions" placement="bottom-end" :width="140" @select="handleLocaleChange">
      <!-- Use a compact trigger button that opens the locale list. -->
      <template #trigger="{ toggle }">
        <button type="button" class="btn controller-button" @click="toggle">
          {{ t("language.label") }}
          <svg class="controller-caret" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" aria-hidden="true">
            <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
          </svg>
        </button>
      </template>
    </AppDropdownMenu>
  </AppTooltip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { setAppLocale } from "@/i18n";
import AppTooltip from "@/components/AppTooltip.vue";
import AppDropdownMenu from "@/components/AppDropdownMenu.vue";

type LocaleOption = {
  key: "zh-CN" | "en-US";
  value: "zh-CN" | "en-US";
  label: string;
  active: boolean;
};

const { t, locale } = useI18n();

const localeOptions = computed<LocaleOption[]>(() => [
  { key: "zh-CN", value: "zh-CN", label: t("language.options.zh-CN"), active: locale.value === "zh-CN" },
  { key: "en-US", value: "en-US", label: t("language.options.en-US"), active: locale.value === "en-US" },
]);

const handleLocaleChange = (item: LocaleOption) => {
  setAppLocale(item.value);
};
</script>

<style scoped>
.controller-button {
  margin: 4px;
  background-color: transparent;
  box-shadow: initial;
  border-color: transparent;
}

.controller-button:hover {
  background-color: oklch(var(--nc) / 0.08);
}

.controller-caret {
  width: 8px;
  height: 8px;
  display: inline-block;
  fill: currentColor;
  opacity: 0.6;
}
</style>

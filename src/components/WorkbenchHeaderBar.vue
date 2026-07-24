<template>
  <header class="workbench-header-bar">
    <div class="workbench-header-identity">
      <strong>{{ title }}</strong>
      <span v-if="count > 0">{{ count }}</span>
    </div>

    <div class="workbench-header-actions">
      <span v-if="running" class="workbench-header-running">{{ t("chat.runtimeRunning") }}</span>
      <AppTooltip :text="tokenBreakdown" placement="bottom">
        <span class="workbench-header-tokens">{{ formatTokenCount(tokenUsage?.total_tokens || 0) }} tokens</span>
      </AppTooltip>
      <slot name="actions"></slot>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppTooltip from "@/components/AppTooltip.vue";
import type { TokenUsage } from "@/types";

const props = withDefaults(
  defineProps<{
    title: string;
    count?: number;
    tokenUsage?: TokenUsage | null;
    running?: boolean;
  }>(),
  {
    count: 0,
    tokenUsage: null,
    running: false,
  },
);

const { t, locale } = useI18n();
const compactNumber = computed(() => new Intl.NumberFormat(locale.value, { notation: "compact", maximumFractionDigits: 1 }));
const formatTokenCount = (value: number) => compactNumber.value.format(Math.max(0, Number(value) || 0));
const tokenBreakdown = computed(() =>
  t("common.sessionTokenBreakdown", {
    input: formatTokenCount(props.tokenUsage?.input_tokens || 0),
    output: formatTokenCount(props.tokenUsage?.output_tokens || 0),
    total: formatTokenCount(props.tokenUsage?.total_tokens || 0),
  }),
);
</script>

<style scoped lang="scss">
.workbench-header-bar {
  position: relative;
  z-index: 45;
  flex: 0 0 auto;
  width: 100%;
  min-height: 48px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 8px 14px 8px 18px;
}

.workbench-header-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    overflow: hidden;
    color: oklch(var(--bc) / 0.76);
    font-size: 13px;
    font-weight: 650;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  span {
    min-width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: oklch(var(--bc) / 0.05);
    color: oklch(var(--bc) / 0.5);
    font-size: 10px;
  }
}

.workbench-header-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.workbench-header-running {
  color: oklch(var(--p));
  font-size: 11px;
}

.workbench-header-tokens {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 9px;
  background: oklch(var(--bc) / 0.045);
  color: oklch(var(--bc) / 0.54);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .workbench-header-bar {
    gap: 10px;
    padding: 8px 8px 8px 52px;
  }
  .workbench-header-running {
    display: none;
  }
}

@media (max-width: 420px) {
  .workbench-header-tokens {
    padding: 0 7px;
  }
}
</style>

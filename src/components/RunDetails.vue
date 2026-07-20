<template>
  <details v-if="run?.result" class="run-details" :data-status="run.status">
    <summary>
      <span class="run-label">{{ t("chat.runBubble.label") }}</span>
      <span class="run-model">{{ run.route.model }}</span>
      <span class="run-metrics">{{ metrics }}</span>
    </summary>

    <div class="run-body">
      <dl class="run-facts">
        <div><dt>{{ t("chat.runBubble.fields.provider") }}</dt><dd>{{ run.route.provider || empty }}</dd></div>
        <div class="is-technical"><dt>{{ t("chat.runBubble.fields.adapter") }}</dt><dd>{{ run.route.adapterId || empty }}</dd></div>
        <div class="is-technical"><dt>{{ t("chat.runBubble.fields.binding") }}</dt><dd>{{ run.route.bindingKey || empty }}</dd></div>
        <div class="is-wide is-technical"><dt>{{ t("chat.runBubble.fields.connectionUrl") }}</dt><dd>{{ run.route.connectionURL || empty }}</dd></div>
        <div><dt>{{ t("chat.runBubble.fields.messageCount") }}</dt><dd>{{ run.request.inputCount }}</dd></div>
        <div><dt>{{ t("chat.runBubble.fields.capabilities") }}</dt><dd>{{ capabilities || empty }}</dd></div>
      </dl>

      <details class="run-params">
        <summary>{{ t("chat.runBubble.fields.parameters") }}</summary>
        <pre>{{ JSON.stringify(run.request.params, null, 2) }}</pre>
      </details>

      <div v-if="run.error" class="run-error">{{ t("chat.runBubble.fields.error") }}: {{ run.error }}</div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RunSnapshot } from "@/types";

const props = defineProps<{ run: RunSnapshot | null | undefined }>();
const { t } = useI18n();
const empty = computed(() => t("chat.runBubble.none"));
const capabilities = computed(() =>
  Object.entries(props.run?.request.capabilities || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .join(", "),
);
const metrics = computed(() => {
  if (!props.run) return "";
  const duration = props.run.durationMs < 1000 ? `${Math.round(props.run.durationMs)}ms` : `${(props.run.durationMs / 1000).toFixed(1)}s`;
  const tokens = Number(props.run.result?.usage.total_tokens || 0);
  return [props.run.status, duration, tokens > 0 ? `${tokens.toLocaleString()} tokens` : ""].filter(Boolean).join(" · ");
});
</script>

<style scoped lang="scss">
.run-details {
  max-width: 760px;
  min-width: 0;
  color: oklch(var(--bc) / 0.52);
  font-size: 13px;

  > summary {
    display: flex;
    align-items: center;
    gap: 7px;
    width: fit-content;
    max-width: 100%;
    min-height: 28px;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker { display: none; }
    &::before {
      content: "";
      width: 5px;
      height: 5px;
      flex: 0 0 5px;
      border-right: 1px solid currentColor;
      border-bottom: 1px solid currentColor;
      transform: rotate(-45deg);
      transition: transform 0.15s ease;
    }
  }

  &[open] > summary::before { transform: rotate(45deg) translate(-1px, -1px); }
}

.run-label,
.run-model,
.run-metrics { font-size: 13px; white-space: nowrap; }
.run-label { color: oklch(var(--bc) / 0.66); font-weight: 650; }
.run-model { max-width: 240px; overflow: hidden; text-overflow: ellipsis; color: oklch(var(--bc) / 0.56); }
.run-metrics { color: oklch(var(--bc) / 0.46); }
.run-body { margin: 5px 0 4px 3px; padding: 7px 0 3px 14px; border-left: 1px solid oklch(var(--bc) / 0.12); }
.run-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px 14px; margin: 0 0 10px; }
.run-facts > div { min-width: 0; }
.run-facts .is-wide { grid-column: 1 / -1; }
dt, dd { margin: 0; }
dt { color: oklch(var(--bc) / 0.48); font-size: 12px; font-weight: 650; }
dd { margin-top: 4px; overflow-wrap: anywhere; color: oklch(var(--bc) / 0.72); font-size: 13px; line-height: 1.5; }
.is-technical dd, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.run-params > summary { width: fit-content; cursor: pointer; color: oklch(var(--bc) / 0.54); font-size: 12px; font-weight: 650; }
pre { max-height: 180px; margin: 7px 0 0; padding: 8px 10px; overflow: auto; border-radius: 8px; background: oklch(var(--b2) / 0.34); white-space: pre-wrap; overflow-wrap: anywhere; }
.run-error { margin-top: 8px; padding: 7px 8px; border-radius: 7px; background: oklch(var(--er) / 0.08); color: oklch(var(--er)); overflow-wrap: anywhere; }

@media (max-width: 640px) {
  .run-facts { grid-template-columns: 1fr; }
  .run-facts .is-wide { grid-column: auto; }
  .run-model { max-width: 110px; }
  .run-metrics { overflow: hidden; text-overflow: ellipsis; }
}
</style>

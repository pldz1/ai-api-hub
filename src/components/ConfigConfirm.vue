<template>
  <dialog ref="dialogRef" class="modal config-import-confirm" @cancel.prevent="resolveConfirmation(false)" @close="resolveConfirmation(false)">
    <div class="modal-box">
      <h3 class="config-import-confirm-title">{{ t("user.importLinkConfirmTitle") }}</h3>
      <p class="config-import-confirm-message">{{ t("user.importLinkConfirm") }}</p>
      <div class="modal-action config-import-confirm-actions">
        <button class="btn btn-ghost" type="button" @click="resolveConfirmation(false)">
          {{ t("chat.confirmActionCancel") }}
        </button>
        <button class="btn btn-primary" type="button" @click="resolveConfirmation(true)">
          {{ t("user.importLinkConfirmAction") }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const dialogRef = ref<HTMLDialogElement | null>(null);
let confirmationResolve: ((confirmed: boolean) => void) | null = null;

function confirm(): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = dialogRef.value;
    if (!dialog?.showModal) {
      resolve(window.confirm(t("user.importLinkConfirm")));
      return;
    }

    confirmationResolve = resolve;
    dialog.showModal();
  });
}

function resolveConfirmation(confirmed: boolean): void {
  if (confirmationResolve) {
    confirmationResolve(Boolean(confirmed));
    confirmationResolve = null;
  }

  const dialog = dialogRef.value;
  if (dialog?.open) dialog.close();
}

defineExpose({ confirm });
</script>

<style lang="scss" scoped>
.config-import-confirm {
  .modal-box {
    max-width: 460px;
    border: 1px solid oklch(var(--bc) / 0.12);
    border-radius: 8px;
    background: oklch(var(--b1));
    box-shadow: 0 18px 48px oklch(var(--bc) / 0.16);
  }

  .config-import-confirm-title {
    margin: 0;
    color: oklch(var(--bc));
    font-size: 18px;
    font-weight: 700;
  }

  .config-import-confirm-message {
    margin: 12px 0 0;
    color: oklch(var(--bc) / 0.72);
    line-height: 1.6;
  }

  .config-import-confirm-actions {
    gap: 8px;
  }
}
</style>

<template>
  <dialog ref="dialogRef" class="modal config-import-confirm" @cancel.prevent="resolveConfirmation(false)" @close="resolveConfirmation(false)">
    <div class="modal-box">
      <h3 class="config-import-confirm-title">{{ t("user.importLinkConfirmTitle") }}</h3>
      <p class="config-import-confirm-message">{{ t("user.importLinkConfirm") }}</p>

      <!-- 密码门控：当 URL 携带 &password= 时展示 -->
      <div v-if="encryptedPassword" class="config-import-confirm-password">
        <label class="config-import-confirm-password-label" for="import-password-input">
          {{ t("user.importPasswordLabel") }}
        </label>
        <input
          id="import-password-input"
          ref="passwordInputRef"
          v-model="passwordInput"
          type="password"
          class="input input-bordered config-import-confirm-password-input"
          :class="{ 'input-error': passwordError }"
          :placeholder="t('user.importPasswordPlaceholder')"
          autocomplete="off"
          @keydown.enter="handleConfirm"
        />
        <p v-if="passwordError" class="config-import-confirm-password-error">
          {{ passwordError }}
        </p>
      </div>

      <div class="modal-action config-import-confirm-actions">
        <button class="btn btn-ghost" type="button" @click="resolveConfirmation(false)">
          {{ t("chat.confirmActionCancel") }}
        </button>
        <button class="btn btn-primary" type="button" :disabled="passwordLoading" @click="handleConfirm">
          {{ passwordLoading ? t("user.importPasswordVerifying") : t("user.importLinkConfirmAction") }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { verifyImportPassword } from "@/services";

const { t } = useI18n();

const props = defineProps<{
  encryptedPassword?: string;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const passwordInputRef = ref<HTMLInputElement | null>(null);
const passwordInput = ref("");
const passwordLoading = ref(false);
const passwordError = ref("");

let confirmationResolve: ((confirmed: boolean) => void) | null = null;

function confirm(): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = dialogRef.value;
    if (!dialog?.showModal) {
      resolve(window.confirm(t("user.importLinkConfirm")));
      return;
    }

    // 每次打开重置状态
    passwordInput.value = "";
    passwordError.value = "";
    passwordLoading.value = false;
    confirmationResolve = resolve;
    dialog.showModal();

    // 如果有密码门控，自动聚焦输入框
    if (props.encryptedPassword) {
      nextTick(() => passwordInputRef.value?.focus());
    }
  });
}

async function handleConfirm(): Promise<void> {
  // 有密码门控时先验证
  if (props.encryptedPassword) {
    if (!passwordInput.value.trim()) {
      passwordError.value = t("user.importPasswordRequired");
      passwordInputRef.value?.focus();
      return;
    }

    passwordLoading.value = true;
    passwordError.value = "";

    const result = await verifyImportPassword(passwordInput.value.trim(), props.encryptedPassword);
    passwordLoading.value = false;

    if (result === null) {
      passwordError.value = t("user.importPasswordInvalid");
      passwordInput.value = "";
      passwordInputRef.value?.focus();
      return;
    }
  }

  resolveConfirmation(true);
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

  .config-import-confirm-password {
    margin-top: 16px;

    .config-import-confirm-password-label {
      display: block;
      margin-bottom: 6px;
      color: oklch(var(--bc) / 0.82);
      font-size: 14px;
      font-weight: 500;
    }

    .config-import-confirm-password-input {
      width: 100%;
    }

    .config-import-confirm-password-error {
      margin: 6px 0 0;
      color: oklch(var(--er));
      font-size: 13px;
    }
  }

  .config-import-confirm-actions {
    gap: 8px;
  }
}
</style>

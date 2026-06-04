<template>
  <div class="home">
    <div class="home-shell">
      <div class="home-toolbar">
        <LanguageController />
        <ThemeController />
      </div>

      <!-- LEFT: Hero + Provider Grid -->
      <section class="home-left">
        <div class="home-hero">
          <span class="home-kicker">{{ APP_NAME }}</span>
          <h1 class="home-title">{{ t("login.title") }}</h1>
          <p class="home-copy">{{ t("login.description") }}</p>
        </div>

        <!-- Mobile-only CTA button -->
        <button class="mobile-btn" @click="onStart">{{ t("login.loginAction") }}</button>

        <!-- 2×2 provider grid -->
        <div class="prov-grid">
          <div v-for="p in providers" :key="p.name" class="prov-card" :style="{ '--brand': p.color, '--brand-grad-from': p.gradFrom }">
            <div class="pc-head">
              <span class="pc-icon">
                <SvgIcon :src="p.icon"></SvgIcon>
              </span>
              <div>
                <span class="pc-name">{{ p.name }}</span>
                <span class="pc-count">{{ p.models.length }} models</span>
              </div>
            </div>
            <div class="pc-chips">
              <span v-for="m in p.models" :key="m" class="pc-chip">{{ m }}</span>
            </div>
          </div>
        </div>

        <p class="home-updated">LATEST-UPDATE-TIME: {{ UPDATE_TIME }}</p>
      </section>

      <!-- RIGHT: Sign-in -->
      <section class="home-right">
        <div class="sign-card">
          <div class="sign-header">
            <span class="sign-label">{{ t("login.signInLabel") }}</span>
            <h2>{{ t("login.signInTitle") }}</h2>
          </div>
          <div class="sign-body">
            <div class="sign-readiness">
              <span class="sign-dot"></span>
              <div>
                <strong>{{ t("login.browserModeTitle") }}</strong>
                <p>{{ t("login.browserModeDescription") }}</p>
              </div>
            </div>
            <div class="sign-caps">
              <div v-for="cap in capabilityHighlights" :key="cap.label" class="sign-cap">
                <span class="sign-cap-icon">{{ cap.icon }}</span>
                <span>{{ cap.label }}</span>
              </div>
            </div>
          </div>
          <button class="sign-button" @click="onStart">
            <span>{{ t("login.loginAction") }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import ThemeController from "@/components/ThemeController.vue";
import LanguageController from "@/components/LanguageController.vue";
import { APP_NAME, UPDATE_TIME } from "@/constants";
import openaiIcon from "@/assets/svg/chatgpt-logo.svg";
import azureIcon from "@/assets/svg/azure-logo.svg";
import qwenIcon from "@/assets/svg/qwenlm-logo.svg";
import deepseekIcon from "@/assets/svg/deepseek-logo.svg";
import SvgIcon from "@/components/SvgIcon.vue";

const router = useRouter();
const { t } = useI18n();

const onStart = async () => {
  router.push({ path: "/chat" });
};

const providers = [
  {
    name: "OpenAI",
    color: "#10a37f",
    gradFrom: "rgba(16,163,127,0.06)",
    models: ["GPT-5.5", "GPT-5.4", "GPT-4.1", "GPT-4o", "GPT-Image-2"],
    icon: openaiIcon,
  },
  {
    name: "Azure",
    color: "#0078d4",
    gradFrom: "rgba(0,120,212,0.06)",
    models: ["GPT-5.5", "GPT-5.4", "GPT-4.1", "GPT-4o", "GPT-Image-2"],
    icon: azureIcon,
  },
  {
    name: "DeepSeek",
    color: "#4d6bfe",
    gradFrom: "rgba(77,107,254,0.06)",
    models: ["DeepSeek V4 Pro", "DeepSeek V4 Flash"],
    icon: deepseekIcon,
  },
  {
    name: "DashScope",
    color: "#ff6a00",
    gradFrom: "rgba(255,106,0,0.06)",
    models: ["Qwen 3.7 Max", "Qwen-Image-2.0 Pro", "Wan2.7 I2V", "Wan2.7 T2V", "Wan2.7 R2V", "Wan2.7 VideoEdit"],
    icon: qwenIcon,
  },
];

const capabilityHighlights = [
  { icon: "🌊", label: "Streaming SSE" },
  { icon: "🌐", label: "Web Search" },
  { icon: "🔒", label: "100% Local" },
  { icon: "🎨", label: "11 Themes" },
];
</script>

<style lang="scss" scoped>
/* ── Container ── */
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  padding: 28px;
  overflow-y: auto;
  background:
    radial-gradient(ellipse at 10% 4%, oklch(var(--p) / 0.13), transparent 32%), radial-gradient(ellipse at 90% 96%, oklch(var(--a) / 0.11), transparent 34%),
    oklch(var(--b1));
}

.home-shell {
  position: relative;
  width: min(1160px, 100%);
  min-height: 640px;
  max-height: calc(100dvh - 56px);
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 370px);
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 24px;
  overflow: hidden;
  background: oklch(var(--b1) / 0.94);
  box-shadow: 0 18px 50px oklch(var(--bc) / 0.07);
}

.home-toolbar {
  position: absolute;
  right: 18px;
  top: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Left panel ── */
.home-left {
  padding: 44px 32px 28px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  overflow-y: auto;
  background: linear-gradient(170deg, oklch(var(--b2) / 0.82), oklch(var(--b1) / 0.5));
}

.home-hero {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.home-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: oklch(var(--bc) / 0.46);
}

.home-title {
  max-width: 560px;
  font-size: clamp(34px, 4.5vw, 52px);
  line-height: 1.1;
  font-weight: 850;
  letter-spacing: -0.04em;
  color: oklch(var(--bc));
  margin: 0;
}

.home-copy {
  max-width: 480px;
  font-size: 15px;
  line-height: 1.6;
  color: oklch(var(--bc) / 0.62);
  margin: 0;
}

/* ── 2×2 Provider Grid ── */
.prov-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.prov-card {
  padding: 14px 15px;
  border-radius: 14px;
  border: 1px solid oklch(var(--bc) / 0.07);
  background: linear-gradient(155deg, var(--brand-grad-from, transparent) 0%, transparent 55%), oklch(var(--b1) / 0.7);
  box-shadow: 2px 0 0 0 var(--brand) inset;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition:
    box-shadow 0.2s ease,
    background 0.2s ease;

  &:hover {
    background: linear-gradient(155deg, var(--brand-grad-from, transparent) 0%, transparent 45%), oklch(var(--b1) / 0.82);
    box-shadow:
      0 4px 14px oklch(var(--bc) / 0.06),
      2px 0 0 0 var(--brand) inset;
  }
}

.pc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pc-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand);
}

.pc-name {
  font-size: 14px;
  font-weight: 750;
  letter-spacing: 0.02em;
  color: oklch(var(--bc) / 0.82);
}

.pc-count {
  font-size: 11px;
  font-weight: 550;
  color: oklch(var(--bc) / 0.44);
  margin-left: 4px;
}

.pc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pc-chip {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  border: 0.6px solid oklch(var(--bc) / 0.06);
  background: oklch(var(--b1) / 0.5);
  font-size: 11px;
  font-weight: 550;
  letter-spacing: 0.02em;
  color: oklch(var(--bc) / 0.58);
  white-space: nowrap;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: var(--brand);
    color: oklch(var(--bc) / 0.85);
  }
}

.mobile-btn {
  display: none;
  height: 50px;
  width: 100%;
  border-radius: 13px;
  border: 1px solid oklch(var(--bc) / 0.07);
  background: linear-gradient(160deg, oklch(var(--p)), oklch(var(--n)));
  color: oklch(var(--pc));
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 10px 22px oklch(var(--bc) / 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover { transform: translateY(-2px); }
  &:active { transform: translateY(0); }
}

.home-updated {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: oklch(var(--bc) / 0.24);
  margin: 0;
}

/* ── Right panel ── */
.home-right {
  padding: 40px 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  background: oklch(var(--b1) / 0.7);
}

.sign-card {
  width: 100%;
  max-width: 310px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sign-header {
  .sign-label {
    display: inline-block;
    margin-bottom: 5px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.5);
  }
  h2 {
    margin: 0;
    font-size: 28px;
    line-height: 1.15;
    font-weight: 800;
    color: oklch(var(--bc));
  }
}

.sign-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sign-readiness {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  padding: 13px 15px;
  border-radius: 12px;
  border: 1px solid oklch(var(--bc) / 0.07);
  background: oklch(var(--b1) / 0.72);

  strong {
    display: block;
    font-size: 14px;
    font-weight: 750;
    color: oklch(var(--bc));
  }
  p {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.55;
    color: oklch(var(--bc) / 0.56);
  }
}

.sign-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 3px;
  flex-shrink: 0;
  background: oklch(0.82 0.16 87);
  box-shadow: 0 0 0 3px oklch(0.82 0.16 87 / 0.1);
}

.sign-caps {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.sign-cap {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid oklch(var(--bc) / 0.05);
  background: oklch(var(--b1) / 0.45);
  font-size: 12px;
  font-weight: 600;
  color: oklch(var(--bc) / 0.58);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: oklch(var(--bc) / 0.11);
    background: oklch(var(--b1) / 0.62);
  }
}

.sign-cap-icon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

/* ── Button ── */
.sign-button {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  border: 1px solid oklch(var(--bc) / 0.07);
  background: linear-gradient(160deg, oklch(var(--p)), oklch(var(--n)));
  color: oklch(var(--pc));
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 10px 22px oklch(var(--bc) / 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px oklch(var(--bc) / 0.18);
  }
  &:active { transform: translateY(0); }
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .home {
    padding: 14px;
  }
  .home-shell {
    grid-template-columns: 1fr;
    min-height: auto;
    max-height: none;
    border-radius: 18px;
  }
  .home-toolbar {
    right: 10px;
    top: 10px;
  }
  .home-left {
    padding: 34px 24px 24px;
    gap: 22px;
  }
  .home-title {
    font-size: clamp(24px, 5vw, 34px);
  }
  .home-right {
    display: none;
  }
  .mobile-btn {
    display: block;
  }
  .home-updated { display: none; }
}

@media (max-width: 640px) {
  .home { padding: 8px; }
  .home-shell { border-radius: 14px; }
  .home-left { padding: 26px 14px 16px; gap: 20px; }
}
</style>

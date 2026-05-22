<template>
  <div class="component-header-bar">
    <div class="comphb-left">
      <button class="comphb-brand" @click="onBackLogin">
        <SvgIcon class="comphb-brand-mark" :src="appIcon" colored style="width: 28px; height: 28px" />
        <div class="comphb-brand-copy">
          <span class="comphb-brand-kicker">AI API HUB</span>
        </div>
      </button>
      <div v-if="showNavigation" class="comphb-nav-shell">
        <nav class="comphb-nav" :aria-label="t('header.menu')">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="comphb-nav-item"
            :class="{ active: isActivePath(item.path) }"
            :aria-current="isActivePath(item.path) ? 'page' : undefined"
            @click="onSelectNavItem(item.path)"
          >
            <SvgIcon class="comphb-nav-icon" :src="item.icon" />
            <span class="comphb-nav-label">{{ item.label }}</span>
          </button>
        </nav>
      </div>
    </div>
    <div class="comphb-actions">
      <LanguageController />
      <ThemeController class="comphb-theme-controller"></ThemeController>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import appIcon from "@/assets/svg/app32.svg";
import navChatIcon from "@/assets/svg/navChat24.svg";
import navImageIcon from "@/assets/svg/navImage24.svg";
import navSettingsIcon from "@/assets/svg/navSettings24.svg";
import ThemeController from "@/components/ThemeController.vue";
import LanguageController from "@/components/LanguageController.vue";
import SvgIcon from "@/components/SvgIcon.vue";

const props = defineProps({
  showNavigation: {
    type: Boolean,
    default: true,
  },
  showMenu: {
    type: Boolean,
    default: true,
  },
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const showNavigation = computed(() => props.showNavigation && props.showMenu);
const navItems = computed(() => [
  { key: "chat", label: t("header.chat"), icon: navChatIcon, path: "/chat" },
  { key: "image", label: t("header.image"), icon: navImageIcon, path: "/image" },
  { key: "settings", label: t("header.settings"), icon: navSettingsIcon, path: "/settings" },
]);

const onBackLogin = () => {
  router.push({ path: "/login" });
};

const isActivePath = (path) => route.path === path || route.path.startsWith(`${path}/`);

const onSelectNavItem = (path) => {
  if (!isActivePath(path)) {
    router.push({ path });
  }
};
</script>

<style lang="scss" scoped>
.component-header-bar {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 10px 20px;
  border-bottom: 1px solid oklch(var(--bc) / 0.05);
  background: transparent;
  z-index: 301;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: oklch(var(--bc));

  .comphb-left,
  .comphb-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .comphb-left {
    min-width: 0;
    flex: 1 1 auto;
  }

  .comphb-nav-shell {
    min-width: 0;
    flex: 0 1 auto;
    display: flex;
    justify-content: flex-start;
  }

  .comphb-nav {
    max-width: 100%;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    padding: 0 4px;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .comphb-nav-item {
    position: relative;
    min-width: max-content;
    height: 40px;
    padding: 0 14px;
    border: none;
    border-bottom: 2px solid transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: transparent;
    color: oklch(var(--bc) / 0.68);
    cursor: pointer;
    transition:
      color 0.18s ease,
      transform 0.18s ease;

    &:hover {
      color: oklch(var(--bc));
    }

    &.active {
      color: oklch(var(--bc));
      border-bottom-color: oklch(var(--er));
    }
  }

  .comphb-nav-icon {
    width: 16px;
    height: 16px;
    opacity: 0.84;
  }

  .comphb-nav-label {
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
  }

  .comphb-actions {
    justify-content: flex-end;
    flex: 0 0 auto;
  }

  .comphb-brand {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    border: none;
    border-radius: 18px;
    background: transparent;
    cursor: pointer;
    color: inherit;
  }

  .comphb-brand-mark {
    height: 42px;
    width: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .comphb-brand-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }

  .comphb-brand-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.62);
  }

  @media (max-width: 960px) {
    padding: 10px 14px;
  }

  @media (max-width: 640px) {
    gap: 10px;

    .comphb-nav-item {
      padding: 0 10px;
    }

    .comphb-nav-label {
      font-size: 12px;
    }

    .comphb-brand-copy {
      display: none;
    }
  }
}
</style>

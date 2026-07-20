<template>
  <section class="sidebar-section">
    <button class="section-toggle" :class="{ 'is-collapsed': !open }" type="button" :aria-expanded="open" @click="$emit('update:open', !open)">
      <span class="section-title">{{ title }}</span>
      <span class="section-count">{{ items.length }}</span>
      <span class="section-caret"></span>
    </button>

    <Transition name="section-list">
      <div v-if="open" class="section-body">
        <div v-if="items.length === 0" class="empty-tip">{{ emptyText }}</div>
        <div v-else class="recents-list">
          <div v-for="item in items" :key="item.id" class="history-item-wrapper">
            <input
              v-if="renameLabel && editingId === item.id"
              ref="renameInputRefs"
              :value="editingValue"
              type="text"
              class="rename-input"
              @input="$emit('update:editing-value', ($event.target as HTMLInputElement).value)"
              @blur="$emit('commit-rename')"
              @keydown.enter.prevent="$emit('commit-rename')"
            />

            <div v-else class="history-item" :class="{ 'is-active': item.active, 'is-selected': item.selected, 'has-runtime-status': item.statusVisible }">
              <input
                v-if="deleteMode"
                class="row-select-checkbox"
                type="checkbox"
                :checked="item.selected"
                :aria-label="`Select ${item.title}`"
                @click.stop
                @change="$emit('toggle-selected', item.id, ($event.target as HTMLInputElement).checked)"
              />
              <button class="history-main-btn" type="button" @click="$emit('select', item.id)">
                <span class="history-title-text">{{ item.title }}</span>
              </button>
              <span v-if="item.statusVisible" class="session-status-dot" :class="item.statusClass" :title="item.statusLabel" aria-hidden="true"></span>

              <AppDropdownMenu placement="bottom-end">
                <template #trigger="{ toggle }">
                  <button class="history-menu-btn" :aria-label="menuLabel" @click.stop="toggle">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  </button>
                </template>
                <template #default="{ close }">
                  <button class="menu-option" type="button" @click="close(); $emit('export', item.id)">
                    <SvgIcon class="menu-option-icon" :src="saveIcon" /><span>{{ exportLabel }}</span>
                  </button>
                  <button v-if="renameLabel" class="menu-option" type="button" @click="close(); $emit('rename', item.id)">
                    <SvgIcon class="menu-option-icon" :src="editIcon" /><span>{{ renameLabel }}</span>
                  </button>
                  <button class="menu-option is-danger" type="button" @click="close(); $emit('delete', item.id)">
                    <SvgIcon class="menu-option-icon" :src="deleteIcon" /><span>{{ deleteLabel }}</span>
                  </button>
                </template>
              </AppDropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import AppDropdownMenu from "@/components/AppDropdownMenu.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import deleteIcon from "@/assets/svg/delete16.svg";
import editIcon from "@/assets/svg/edit24.svg";
import saveIcon from "@/assets/svg/save18.svg";

export interface SidebarHistoryItem {
  id: string;
  title: string;
  active: boolean;
  selected: boolean;
  statusVisible: boolean;
  statusClass?: Record<string, boolean>;
  statusLabel?: string;
}

const props = withDefaults(defineProps<{
  title: string;
  emptyText: string;
  items: SidebarHistoryItem[];
  open?: boolean;
  deleteMode?: boolean;
  menuLabel: string;
  exportLabel: string;
  deleteLabel: string;
  renameLabel?: string;
  editingId?: string;
  editingValue?: string;
}>(), { open: true, deleteMode: false, renameLabel: "", editingId: "", editingValue: "" });

defineEmits<{
  "update:open": [value: boolean];
  "update:editing-value": [value: string];
  "toggle-selected": [id: string, checked: boolean];
  "commit-rename": [];
  select: [id: string];
  export: [id: string];
  rename: [id: string];
  delete: [id: string];
}>();

const renameInputRefs = ref<HTMLInputElement[]>([]);
watch(() => props.editingId, async (id) => {
  if (!id) return;
  await nextTick();
  const input = renameInputRefs.value[0];
  input?.focus();
  input?.select();
});
</script>

<style scoped lang="scss">
.sidebar-section { display: flex; flex-direction: column; gap: 4px; }
.section-toggle { width: 100%; min-height: 30px; display: grid; grid-template-columns: minmax(0, 1fr) auto 16px; align-items: center; gap: 7px; padding: 0 7px; border: 0; border-radius: 8px; background: transparent; color: oklch(var(--bc) / 0.45); cursor: pointer; transition: background-color 0.16s ease, color 0.16s ease; }
.section-toggle:hover { background: oklch(var(--bc) / 0.04); color: oklch(var(--bc) / 0.62); }
.section-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; font-size: 10px; font-weight: 750; letter-spacing: 0.05em; text-transform: uppercase; }
.section-count { min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: oklch(var(--bc) / 0.04); color: oklch(var(--bc) / 0.62); font-size: 10px; }
.section-caret { width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-1px); transition: transform 0.16s ease; }
.section-toggle.is-collapsed .section-caret { transform: rotate(-45deg); }
.section-body { min-height: 0; }
.recents-list { display: flex; flex-direction: column; gap: 3px; }
.section-list-enter-active, .section-list-leave-active { overflow: hidden; transition: opacity 0.14s ease, max-height 0.18s ease; }
.section-list-enter-from, .section-list-leave-to { max-height: 0; opacity: 0; }
.section-list-enter-to, .section-list-leave-from { max-height: 540px; opacity: 1; }
.empty-tip { padding: 8px 10px; color: oklch(var(--bc) / 0.45); font-size: 11px; }
.history-item-wrapper { min-width: 0; }
.history-item { min-height: 36px; display: flex; align-items: center; gap: 5px; border-radius: 10px; padding: 0 4px 0 8px; color: oklch(var(--bc) / 0.82); transition: background-color 0.16s ease, color 0.16s ease; }
.history-item:hover, .history-item.is-active, .history-item.is-selected { background: oklch(var(--p) / 0.12); }
.history-item.is-active .history-title-text { font-weight: 650; }
.row-select-checkbox { width: 15px; height: 15px; flex: 0 0 auto; accent-color: oklch(var(--p)); }
.history-main-btn { min-width: 0; flex: 1 1 auto; height: 34px; display: flex; align-items: center; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.history-title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: oklch(var(--bc) / 0.82); font-size: 12px; }
.history-menu-btn { width: 28px; height: 28px; flex: 0 0 28px; display: flex; align-items: center; justify-content: center; gap: 2.5px; padding: 0; border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
.history-menu-btn:hover { background: rgba(0, 0, 0, 0.06); }
.dot { width: 3.5px; height: 3.5px; border-radius: 50%; background: oklch(var(--bc) / 0.62); }
.session-status-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: oklch(var(--su)); }
.session-status-dot.is-running { background: oklch(var(--p)); animation: session-status-pulse 1.2s ease-in-out infinite; }
.session-status-dot.is-error { background: oklch(var(--er)); }
.session-status-dot.is-stopped { background: oklch(var(--bc) / 0.42); }
@keyframes session-status-pulse { 0%, 100% { transform: scale(0.9); opacity: 0.72; } 50% { transform: scale(1.18); opacity: 1; } }
.menu-option { width: 100%; min-height: 36px; display: flex; align-items: center; gap: 9px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: oklch(var(--bc) / 0.82); font-size: 12px; cursor: pointer; text-align: left; }
.menu-option:hover { background: oklch(var(--bc) / 0.05); }
.menu-option.is-danger { color: oklch(var(--er)); }
.menu-option-icon { width: 15px; height: 15px; color: oklch(var(--bc) / 0.62); }
.rename-input { width: 100%; height: 34px; padding: 0 9px; border: 1px solid oklch(var(--p) / 0.32); border-radius: 9px; background: oklch(var(--b1)); color: oklch(var(--bc)); font-size: 12px; outline: none; }
.rename-input:focus { box-shadow: 0 0 0 2px oklch(var(--p) / 0.1); }
</style>

<template>
  <AppViewShell class="chat-page-shell">
    <div class="chat-page-content">
      <SidebarCard />
      <ChatCard />
    </div>
  </AppViewShell>
  <ImageModal />
</template>

<script setup>
import { onMounted } from "vue";
import { getChatList } from "@/services";
import AppViewShell from "@/components/AppViewShell.vue";
import SidebarCard from "@/views/chat/components/SidebarCard.vue";
import ChatCard from "@/views/chat/components/ChatCard.vue";
import ImageModal from "@/views/chat/components/ImageModal.vue";

onMounted(async () => {
  await getChatList();
});
</script>

<style lang="scss" scoped>
.chat-page-shell {
  background:
    radial-gradient(circle at top left, oklch(var(--p) / 0.04), transparent 24%),
    radial-gradient(circle at bottom right, oklch(var(--a) / 0.04), transparent 26%);
}

.chat-page-content {
  height: 100%;
  display: flex;
  flex-direction: row;
  gap: 14px;
  padding: 14px;
}
</style>

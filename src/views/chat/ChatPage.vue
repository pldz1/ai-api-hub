<template>
  <div class="chat-homepage-container">
    <!-- 头部 -->
    <div class="chpc-header">
      <HeaderBar></HeaderBar>
    </div>
    <!-- 对话内容 -->
    <div class="chpc-content">
      <!-- 对话侧边栏 -->
      <SidebarCard />
      <!-- 对话的主卡片 -->
      <ChatCard />
    </div>
  </div>
  <!-- 全局弹窗 -->
  <ImageModal />
</template>

<script setup>
import { onMounted } from "vue";
import { getChatList, getChatInsTemplateList } from "@/services";

import SidebarCard from "@/views/chat/components/SidebarCard.vue";
import ChatCard from "@/views/chat/components/ChatCard.vue";
import HeaderBar from "@/components/HeaderBar.vue";
import ImageModal from "@/views/chat/components/ImageModal.vue";

onMounted(async () => {
  await getChatList();
  await getChatInsTemplateList();
});
</script>

<style lang="scss" scoped>
.chat-homepage-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, oklch(var(--p) / 0.04), transparent 24%),
    radial-gradient(circle at bottom right, oklch(var(--a) / 0.04), transparent 26%);

  .chpc-header {
    height: 48px;
    flex: 0 0 auto;
  }

  .chpc-content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: row;
    gap: 14px;
    padding: 14px;
  }
}
</style>

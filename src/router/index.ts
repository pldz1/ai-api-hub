import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";
import HomePage from "@/views/HomePage.vue";
import MainView from "@/views/MainView.vue";
import ChatIndex from "@/views/chat/ChatIndex.vue";
import ImageIndex from "@/views/image/ImageIndex.vue";
import VideoIndex from "@/views/video/VideoIndex.vue";
import AssetsIndex from "@/views/assets/AssetsIndex.vue";
import QAIndex from "@/views/qa/QAIndex.vue";
import SettingIndex from "@/views/setting/SettingIndex.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: HomePage,
  },
  {
    path: "/",
    component: MainView,
    children: [
      {
        path: "chat/:cid?",
        name: "chat",
        component: ChatIndex,
      },
      {
        path: "image/:iid?",
        name: "image",
        component: ImageIndex,
      },
      {
        path: "video/:vid?",
        name: "video",
        component: VideoIndex,
      },
      {
        path: "assets",
        name: "assets",
        component: AssetsIndex,
      },
      {
        path: "qa",
        name: "qa",
        component: QAIndex,
        meta: { hideSidebar: true },
      },
      {
        path: "settings",
        redirect: "/settings/chat-models",
      },
      {
        path: "settings/chat-templates",
        name: "settings-chat-templates",
        component: SettingIndex,
        props: { activeTab: "chat-templates" as const },
      },
      {
        path: "settings/chat-models",
        name: "settings-chat-models",
        component: SettingIndex,
        props: { activeTab: "chat-models" as const },
      },
      {
        path: "settings/image-models",
        name: "settings-image-models",
        component: SettingIndex,
        props: { activeTab: "image-models" as const },
      },
      {
        path: "settings/video-models",
        name: "settings-video-models",
        component: SettingIndex,
        props: { activeTab: "video-models" as const },
      },
      {
        path: "settings/app",
        name: "settings-app",
        component: SettingIndex,
        props: { activeTab: "app" as const },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;

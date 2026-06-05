import { createRouter, createWebHashHistory } from "vue-router";
import HomePage from "@/views/HomePage.vue";
import MainView from "@/views/MainView.vue";
import SettingIndex from "@/views/setting/SettingIndex.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage,
    },
    {
      path: "/chat/:cid?",
      name: "chat",
      component: MainView,
      props: true,
    },
    {
      path: "/image/:iid?",
      name: "image",
      component: MainView,
      props: true,
    },
    {
      path: "/video/:vid?",
      name: "video",
      component: MainView,
      props: true,
    },
    {
      path: "/qa",
      name: "qa",
      component: MainView,
    },
    {
      path: "/settings",
      component: MainView,
      children: [
        {
          path: "",
          redirect: "/settings/chat-models",
        },
        {
          path: "chat-templates",
          name: "settings-chat-templates",
          component: SettingIndex,
          props: { activeTab: "chat-templates" as const },
        },
        {
          path: "chat-models",
          name: "settings-chat-models",
          component: SettingIndex,
          props: { activeTab: "chat-models" as const },
        },
        {
          path: "image-models",
          name: "settings-image-models",
          component: SettingIndex,
          props: { activeTab: "image-models" as const },
        },
        {
          path: "video-models",
          name: "settings-video-models",
          component: SettingIndex,
          props: { activeTab: "video-models" as const },
        },
        {
          path: "app",
          name: "settings-app",
          component: SettingIndex,
          props: { activeTab: "app" as const },
        },
      ],
    },
  ],
});

export default router;

import { createRouter, createWebHashHistory } from "vue-router";
import LoginPage from "@/views/home/LoginPage.vue";
import LandingPage from "@/views/home/LandingPage.vue";
import ChatPage from "@/views/chat/ChatPage.vue";
import ImagePage from "@/views/image/ImagePage.vue";
import SettingsView from "@/views/settings/SettingsView.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      redirect: "/login",
    },
    {
      path: "/login",
      component: LoginPage,
    },
    {
      path: "/home",
      component: LandingPage,
    },
    {
      path: "/chat",
      component: ChatPage,
    },
    {
      path: "/image",
      component: ImagePage,
      props: true,
    },
    {
      path: "/settings",
      component: SettingsView,
    },
  ],
});
export default router;

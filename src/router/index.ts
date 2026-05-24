import { createRouter, createWebHashHistory } from "vue-router";
import LoginPage from "@/views/LoginPage.vue";
import MainView from "@/views/MainView.vue";
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: LoginPage,
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
      path: "/settings",
      name: "settings",
      component: MainView,
    },
  ],
});
export default router;

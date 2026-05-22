import { createRouter, createWebHashHistory } from "vue-router";
import LoginPage from "@/views/LoginPage.vue";
import ImagePage from "@/views/image/ImagePage.vue";
import MainView from "@/views/MainView.vue";
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
      path: "/main",
      component: MainView,
    },
    {
      path: "/chat",
      component: MainView,
    },
    {
      path: "/image",
      component: ImagePage,
      props: true,
    },
    {
      path: "/settings",
      component: MainView,
    },
  ],
});
export default router;

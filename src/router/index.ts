import { createRouter, createWebHashHistory } from "vue-router";
import HomePage from "@/views/HomePage.vue";
import MainView from "@/views/MainView.vue";
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
      path: "/settings",
      name: "settings",
      component: MainView,
    },
  ],
});
export default router;

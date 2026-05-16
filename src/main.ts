import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import store from "./store";
import { applyTheme, getStoredTheme } from "./utils/theme";
import { setAppLocale } from "./i18n";
import "./assets/style/index.scss";

const app = createApp(App);
app.use(store);
app.use(router);
app.use(i18n);
applyTheme(getStoredTheme());
setAppLocale(i18n.global.locale.value);
app.mount("#app");

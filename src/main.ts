import { createApp } from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import router from "./router/index";
import { createPinia } from "pinia";
import { loadFonts } from "./plugins/webfontloader";
import i18n from "./locales/i18n";

import "bootstrap";

import "./globalVariables";

import "./styles/css/main.stylesheet.css";
import "../node_modules/bootstrap/scss/bootstrap.scss";
import "./styles/color_theme.scss";
import "./styles/simulator.scss";
import "./styles/tutorials.scss";
import "@fortawesome/fontawesome-free/css/all.css";

loadFonts();

const app = createApp(App);

app.use(createPinia());
app.use(vuetify);
app.use(router);
app.use(i18n);

// Service Worker: cache Yosys WASM assets 
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(function (reg) {
            console.log('[SW] Registered:', reg.scope)
        })
        .catch(function (err) {
            console.warn('[SW] Registration failed:', err)
        })
}

app.mount("#app");

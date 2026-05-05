import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import { router } from './router'
import { i18n } from './i18n'
import { initOfflineQueueReplay } from './services/offlineQueueService'
import { initPwa } from './pwa'
import { initTheme } from './composables/useTheme'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

initTheme()
app.mount('#app')
initOfflineQueueReplay()
void initPwa()

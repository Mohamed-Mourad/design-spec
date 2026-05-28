import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import router from '@/router'
import App from '@/App.vue'
import { captureError } from '@/utils/telemetry'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import '@/styles/main.css'

const app = createApp(App)
const pinia = createPinia()
const head = createHead()

app.use(pinia)
app.use(router)
app.use(head)

app.config.errorHandler = (err, _instance, info) => {
  let context: Record<string, unknown> = { vueInfo: info }
  try {
    const store = useDesignSystemStore()
    context = {
      ...context,
      actionTrace: store.actionTrace.slice(-20),
      schemaName: store.schema.name,
      frameworks: store.schema.export.frameworks,
    }
  } catch {
    // store not yet initialized — send error without context
  }
  captureError(err as Error, context)
  if (import.meta.env.DEV) console.error('[vue error]', err)
}

window.addEventListener('unhandledrejection', (e) => {
  captureError(new Error(String(e.reason)), { type: 'unhandledrejection' })
})

app.mount('#app')

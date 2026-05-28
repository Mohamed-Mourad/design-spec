import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/views/LandingView.vue'),
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('@/views/WorkspaceView.vue'),
    },
    {
      path: '/preview',
      name: 'preview',
      component: () => import('@/views/PreviewView.vue'),
    },
    {
      path: '/preview/:id',
      name: 'preview-shared',
      component: () => import('@/views/PreviewView.vue'),
    },
    {
      path: '/features',
      name: 'features',
      component: () => import('@/views/FeaturesView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

export default router

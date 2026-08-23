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
      // Pro short link — the same view, reading a stored snapshot rather than
      // the workspace or a hash.
      path: '/preview/:id',
      name: 'preview-snapshot',
      component: () => import('@/views/PreviewView.vue'),
    },
    {
      path: '/p/:slug',
      name: 'proposal',
      component: () => import('@/views/ProposalView.vue'),
    },
    {
      path: '/embed/:slug',
      name: 'embed',
      component: () => import('@/views/EmbedView.vue'),
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

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../modules/auth/views/LoginView.vue'),
      meta: { publicOnly: true },
    },
    {
      path: '/books',
      name: 'books',
      component: () => import('../modules/books/views/BooksView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/books/:id',
      name: 'book-detail',
      component: () => import('../modules/books/views/BookDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/reading',
      name: 'reading',
      component: () => import('../modules/reading/views/ReadingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../modules/stats/views/StatsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sync',
      name: 'sync',
      component: () => import('../modules/sync/views/SyncCenterView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.initAuth()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.publicOnly && authStore.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import HomeView from '../views/HomeView.vue'
import LoginView from '../modules/auth/views/LoginView.vue'
import BooksView from '../modules/books/views/BooksView.vue'
import BookDetailView from '../modules/books/views/BookDetailView.vue'
import ReadingView from '../modules/reading/views/ReadingView.vue'
import StatsView from '../modules/stats/views/StatsView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { publicOnly: true },
    },
    {
      path: '/books',
      name: 'books',
      component: BooksView,
      meta: { requiresAuth: true },
    },
    {
      path: '/books/:id',
      name: 'book-detail',
      component: BookDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: '/reading',
      name: 'reading',
      component: ReadingView,
      meta: { requiresAuth: true },
    },
    {
      path: '/stats',
      name: 'stats',
      component: StatsView,
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

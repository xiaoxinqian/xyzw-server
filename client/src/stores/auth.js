import { defineStore } from 'pinia'
import api from '../utils/api'
import { connectWebSocket, disconnectWebSocket } from '../utils/ws'

export const useAuthStore = defineStore('auth', {
  state: () => {
    const token = localStorage.getItem('token') || ''
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    // 页面刷新时自动重连 WebSocket
    if (token) {
      setTimeout(() => connectWebSocket(token), 500)
    }
    return { token, user }
  },
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => s.user?.role === 'admin'
  },
  actions: {
    async login(username, password) {
      const res = await api.post('/auth/login', { username, password })
      this.token = res.token
      this.user = res.user
      localStorage.setItem('token', this.token)
      localStorage.setItem('user', JSON.stringify(this.user))
      connectWebSocket(this.token)
    },
    logout() {
      disconnectWebSocket()
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
    async fetchProfile() {
      const res = await api.get('/auth/profile')
      this.user = res.user
      localStorage.setItem('user', JSON.stringify(this.user))
    }
  }
})

/**
 * Auth Adapter for demo
 *
 * Validates credentials against users stored in localStorage.
 * Users are seeded from fixtures in main.js on first load.
 *
 * Demo accounts (password = username):
 *   - admin (role: admin) - Full access
 *   - bob, june (role: user) - Limited access
 */

const AUTH_STORAGE_KEY = 'qdadm_demo_auth'
const USERS_STORAGE_KEY = 'qdadm_demo_users'

function getStoredAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function setStoredAuth(data) {
  if (data) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

function getUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export const authAdapter = {
  /**
   * Login with username/password
   * Validates against users in localStorage (seeded from fixtures)
   * @returns {Promise<{user: object, token: string}>}
   */
  async login({ username, password }) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300))

    const users = getUsers()
    const user = users.find(u => u.username === username && u.password === password)

    if (!user) {
      throw new Error('Invalid credentials')
    }

    const token = btoa(`${user.id}:${Date.now()}`)
    const authData = {
      user: { id: user.id, username: user.username, role: user.role },
      token
    }

    setStoredAuth(authData)
    return authData
  },

  /**
   * Logout current user
   */
  logout() {
    setStoredAuth(null)
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!getStoredAuth()?.token
  },

  /**
   * Get current auth token
   * @returns {string|null}
   */
  getToken() {
    return getStoredAuth()?.token || null
  },

  /**
   * Get current user
   * @returns {object|null}
   */
  getUser() {
    return getStoredAuth()?.user || null
  }
}

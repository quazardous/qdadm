/**
 * Auth Adapter for demo
 *
 * Extends SessionAuthAdapter to validate credentials against users
 * stored via MockApiStorage. Users are seeded from fixtures in main.js.
 *
 * Demo accounts (password = username):
 *   - admin (role: admin) - Full access
 *   - bob, june (role: user) - Limited access
 */

import { LocalStorageSessionAuthAdapter } from 'qdadm'

// MockApiStorage key pattern: mockapi_${entityName}_data
const USERS_STORAGE_KEY = 'mockapi_users_data'

function getUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

class DemoSessionAuthAdapter extends LocalStorageSessionAuthAdapter {
  constructor() {
    super('qdadm_demo_auth')
  }

  /**
   * Login with username/password
   * Validates against users in MockApiStorage (seeded from fixtures)
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
    const userData = { id: user.id, username: user.username, role: user.role }

    this.setSession(token, userData)
    this.persist()

    return { user: userData, token }
  }
}

export const authAdapter = new DemoSessionAuthAdapter()

import { LocalStorageSessionAuthAdapter } from '@quazardous/qdadm'

const USERS = [
  { id: '1', username: 'admin', password: 'admin', role: 'ROLE_ADMIN' },
  { id: '2', username: 'bob', password: 'bob', role: 'ROLE_USER' },
]

class MyAuthAdapter extends LocalStorageSessionAuthAdapter {
  constructor() {
    super('my_admin_auth')
  }

  async login({ username, password }: { username: string; password: string }) {
    const user = USERS.find(u => u.username === username && u.password === password)
    if (!user) throw new Error('Invalid credentials')

    const token = btoa(`${user.id}:${Date.now()}`)
    const userData = { id: user.id, username: user.username, role: user.role }
    this.setSession(token, userData)
    this.persist()
    return { user: userData, token }
  }
}

export const authAdapter = new MyAuthAdapter()

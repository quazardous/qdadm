/**
 * A fake sessions server for the demo (#4336), kept in localStorage so two
 * browser tabs share it. A session is the signed-in user; its tabs beat. The
 * "simulated" people come and go from the Sessions demo page.
 */
import { authAdapter } from '../../adapters/authAdapter'

const KEY = 'qdadm-demo-sessions'
const STALE_MS = 90_000

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') ?? { sessions: {}, history: [] }
  } catch {
    return { sessions: {}, history: [] }
  }
}

function write(db) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

const now = () => new Date().toISOString()

function mySession(db) {
  const user = authAdapter.getUser?.()
  if (!user) return null
  const id = `user-${user.id}`
  if (!db.sessions[id]) {
    db.sessions[id] = { id, login: user.username, via: 'local', since: now(), seen: now(), tabs: {}, ip: '192.168.1.20', agent: navigator.userAgent.split(' ').slice(-1)[0] }
    db.history.unshift({ at: now(), event: 'login', login: user.username, via: 'local', source: 'demo' })
  }
  return db.sessions[id]
}

/** Sessions not seen for a while are gone (a closed browser) */
function prune(db) {
  const limit = Date.now() - STALE_MS
  for (const [id, s] of Object.entries(db.sessions)) {
    if (!s.simulated && Date.parse(s.seen) < limit) delete db.sessions[id]
  }
}

const view = ({ tabs, simulated, ...s }) => ({ ...s, tabs: Object.keys(tabs ?? {}).length || 1 })

export const fakeSessionsAdapter = {
  async heartbeat(tab) {
    const db = read()
    prune(db)
    const me = mySession(db)
    if (me) {
      me.tabs[tab] = now()
      me.seen = now()
    }
    write(db)
    return { others: Object.values(db.sessions).filter((s) => s.id !== me?.id).map(({ ip, agent, ...s }) => view(s)) }
  },
  async list() {
    const db = read()
    prune(db)
    const me = mySession(db)
    write(db)
    return { sessions: Object.values(db.sessions).map(view), mine: me?.id ?? null }
  },
  async history({ limit, offset }) {
    const db = read()
    return {
      history: db.history.slice(offset, offset + limit),
      // The demo's "provider" history is down until it is turned back on
      notice: db.providerDown ? 'The identity provider history is unreachable: local events only.' : null,
    }
  },
  async close(id, reason) {
    const db = read()
    const s = db.sessions[id]
    delete db.sessions[id]
    db.history.unshift({ at: now(), event: 'closed', login: s?.login, by: authAdapter.getUser?.()?.username, reason, source: 'demo' })
    write(db)
  },
}

/** A simulated person signs in or out */
export function simulate(login, on) {
  const db = read()
  const id = `sim-${login}`
  if (on && !db.sessions[id]) {
    db.sessions[id] = { id, login, via: 'oidc', since: new Date(Date.now() - 10 * 60000).toISOString(), seen: now(), tabs: { a: now(), b: now() }, ip: '10.1.2.3', agent: 'Firefox/141', simulated: true }
    db.history.unshift({ at: now(), event: 'login', login, via: 'oidc', source: 'demo' })
  } else if (!on && db.sessions[id]) {
    delete db.sessions[id]
    db.history.unshift({ at: now(), event: 'logout', login, via: 'oidc', source: 'demo' })
  }
  write(db)
}

export function isSimulated(login) {
  return !!read().sessions[`sim-${login}`]
}

export function setProviderDown(down) {
  const db = read()
  db.providerDown = down
  write(db)
}

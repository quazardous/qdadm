/**
 * Values a create reveals once (#5319): a key's token, which the API hands
 * back once and keeps only as a hash.
 *
 * `revealOnce` on the entity takes them out of the create response before
 * the cache, the hooks and the signals see it; `createRevealing()` hands them
 * to the caller; the create form shows them in QdRevealOnce and navigates
 * only once the user says they copied them.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { EntityManager } from '../../src/entity/EntityManager'
import { splitRevealed } from '../../src/entity/EntityManager.crud'
import QdRevealOnce from '../../src/components/dialogs/QdRevealOnce.vue'

const TOKEN = 'sbx_s3cr3t'

class KeysStorage {
  static capabilities = { supportsTotal: true, supportsFilters: false, supportsPagination: true, supportsCaching: true }
  constructor() {
    this.items = []
  }
  async list() {
    return { items: this.items.map((i) => ({ ...i })), total: this.items.length }
  }
  async get(id) {
    return { ...this.items.find((i) => i.id === id) }
  }
  async create(data) {
    const key = { id: `k${this.items.length + 1}`, ...data, state: 'active' }
    this.items.push(key)
    return { key: { ...key }, token: TOKEN }
  }
}

function keysManager(options = {}) {
  const storage = new KeysStorage()
  const manager = new EntityManager({ name: 'keys', storage, revealOnce: { keys: ['token'], item: 'key' }, ...options })
  const signals = { emitEntity: vi.fn(), emit: vi.fn(), on: vi.fn(() => () => {}) }
  const hooks = { invoke: vi.fn(async () => {}) }
  manager.setSignals(signals)
  manager.setHooks(hooks)
  return { manager, storage, signals, hooks }
}

const carriesToken = (value) => JSON.stringify(value ?? null).includes(TOKEN)

describe('splitRevealed', () => {
  it('takes the keys out, the entity from `item` or the rest', () => {
    expect(splitRevealed({ key: { id: 1 }, token: 't' }, { keys: ['token'], item: 'key' })).toEqual({ entity: { id: 1 }, revealed: { token: 't' } })
    expect(splitRevealed({ id: 1, password: 'p' }, { keys: ['password'] })).toEqual({ entity: { id: 1 }, revealed: { password: 'p' } })
    // A key also inside the item never stays there
    expect(splitRevealed({ key: { id: 1, token: 't' }, token: 't' }, { keys: ['token'], item: 'key' }).entity).toEqual({ id: 1 })
  })

  it('a response without them reveals nothing; no config changes nothing', () => {
    expect(splitRevealed({ id: 1 }, { keys: ['token'] })).toEqual({ entity: { id: 1 }, revealed: {} })
    const raw = { id: 1, token: 't' }
    expect(splitRevealed(raw, null)).toEqual({ entity: raw, revealed: {} })
  })
})

describe('EntityManager revealOnce', () => {
  it('createRevealing hands back the entity and the token apart', async () => {
    const { manager } = keysManager()
    const { entity, revealed } = await manager.createRevealing({ name: 'ci' })
    expect(entity).toEqual({ id: 'k1', name: 'ci', state: 'active' })
    expect(revealed).toEqual({ token: TOKEN })
  })

  it('create() returns the entity alone', async () => {
    const { manager } = keysManager()
    expect(await manager.create({ name: 'ci' })).toEqual({ id: 'k1', name: 'ci', state: 'active' })
  })

  it('neither the signals nor the postsave hooks see the token', async () => {
    const { manager, signals, hooks } = keysManager()
    await manager.createRevealing({ name: 'ci' })
    expect(signals.emitEntity).toHaveBeenCalledWith('keys', 'created', expect.objectContaining({ id: 'k1' }))
    expect(carriesToken(signals.emitEntity.mock.calls)).toBe(false)
    expect(carriesToken(signals.emit.mock.calls)).toBe(false)
    const postsave = hooks.invoke.mock.calls.find(([name]) => name === 'entity:postsave')
    expect(postsave).toBeTruthy()
    const { manager: _m, ...context } = postsave[1]
    expect(carriesToken(context)).toBe(false)
  })

  it('nor does the cache', async () => {
    const { manager } = keysManager()
    await manager.list()
    await manager.createRevealing({ name: 'ci' })
    const { items } = await manager.list()
    expect(items).toHaveLength(1)
    expect(carriesToken(items)).toBe(false)
    expect(carriesToken(await manager.get('k1'))).toBe(false)
  })

  it('an entity without revealOnce is unchanged', async () => {
    const { manager } = keysManager({ revealOnce: undefined })
    expect(manager.revealOnce).toBeNull()
    expect((await manager.createRevealing({ name: 'ci' })).revealed).toEqual({})
  })
})

describe('QdRevealOnce', () => {
  let writeText

  beforeEach(() => {
    writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })
  afterEach(() => {
    delete navigator.clipboard
  })

  function mountDialog(revealed) {
    return mount(QdRevealOnce, {
      props: { revealed },
      global: {
        provide: { qdadmOrchestrator: { get: () => ({ label: 'API key' }) } },
        stubs: {
          Dialog: {
            props: ['visible', 'header'],
            template: '<div v-if="visible" class="dialog"><h2>{{ header }}</h2><slot /><slot name="footer" /></div>',
          },
        },
      },
    })
  }

  it('shows each value with a copy button, and confirms', async () => {
    const wrapper = mountDialog({ entity: 'keys', values: { token: TOKEN } })
    expect(wrapper.find('.qd-reveal-once-value').text()).toBe(TOKEN)
    await wrapper.find('.qd-reveal-once-copy').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(TOKEN)
    expect(wrapper.find('.qd-reveal-once-status--ok').exists()).toBe(true)
    await wrapper.find('.qd-reveal-once-confirm').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('renders nothing without values', () => {
    expect(mountDialog(null).find('.dialog').exists()).toBe(false)
  })
})

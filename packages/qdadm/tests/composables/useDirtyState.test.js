/**
 * Unit tests for useDirtyState (qdadm #1194).
 *
 * Written to lock behavior BEFORE the KPI-7 perf optimization (per-key
 * snapshot strings cached at takeSnapshot instead of re-stringifying the
 * initial side on every checkDirty).
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { useDirtyState } from '../../src/composables/useDirtyState'

async function makeState(form) {
  const state = { form }
  const ds = useDirtyState(() => ({ form: state.form }))
  ds.takeSnapshot()
  await nextTick()
  return { state, ds }
}

describe('useDirtyState (#1194)', () => {
  it('clean after snapshot, dirty after change, per-field tracking', async () => {
    const { state, ds } = await makeState({ name: 'Dune', year: 1965 })
    ds.checkDirty()
    expect(ds.dirty.value).toBe(false)
    expect(ds.dirtyFields.value).toEqual([])

    state.form = { name: 'Dune!', year: 1965 }
    ds.checkDirty()
    expect(ds.dirty.value).toBe(true)
    expect(ds.dirtyFields.value).toEqual(['name'])
    expect(ds.isFieldDirty('name')).toBe(true)
    expect(ds.isFieldDirty('year')).toBe(false)
  })

  it('reverting the change goes back to clean', async () => {
    const { state, ds } = await makeState({ name: 'Dune' })
    state.form = { name: 'X' }
    ds.checkDirty()
    expect(ds.dirty.value).toBe(true)
    state.form = { name: 'Dune' }
    ds.checkDirty()
    expect(ds.dirty.value).toBe(false)
    expect(ds.dirtyFields.value).toEqual([])
  })

  it('nested values compare deeply', async () => {
    const { state, ds } = await makeState({ tags: ['a', 'b'], meta: { x: 1 } })
    state.form = { tags: ['a', 'b'], meta: { x: 1 } }
    ds.checkDirty()
    expect(ds.dirty.value).toBe(false)

    state.form = { tags: ['a', 'b', 'c'], meta: { x: 1 } }
    ds.checkDirty()
    expect(ds.dirtyFields.value).toEqual(['tags'])
  })

  it('a key added after the snapshot is dirty', async () => {
    const { state, ds } = await makeState({ name: 'Dune' })
    state.form = { name: 'Dune', extra: 'new' }
    ds.checkDirty()
    expect(ds.dirty.value).toBe(true)
    expect(ds.dirtyFields.value).toEqual(['extra'])
  })

  it('undefined-valued keys are not false positives', async () => {
    const { state, ds } = await makeState({ name: 'Dune', opt: undefined })
    state.form = { name: 'Dune', opt: undefined }
    ds.checkDirty()
    expect(ds.dirty.value).toBe(false)
    expect(ds.dirtyFields.value).toEqual([])
  })

  it('checkDirty is a no-op before the snapshot settles', async () => {
    const state = { form: { a: 1 } }
    const ds = useDirtyState(() => ({ form: state.form }))
    ds.checkDirty() // before takeSnapshot
    expect(ds.dirty.value).toBe(false)
  })

  describe('path-aware isFieldDirty (#1396)', () => {
    it('a nested sub-field lights up like a root field', async () => {
      const { state, ds } = await makeState({
        name: 'proxy-1',
        config: { login: 'bob', password: 'x' },
      })
      state.form = { name: 'proxy-1', config: { login: 'alice', password: 'x' } }
      ds.checkDirty()

      expect(ds.isFieldDirty('config.login')).toBe(true)
      expect(ds.isFieldDirty('config.password')).toBe(false)
      // root + global behavior untouched
      expect(ds.isFieldDirty('config')).toBe(true)
      expect(ds.dirtyFields.value).toEqual(['config'])
    })

    it('clean parent short-circuits every sub-path', async () => {
      const { state, ds } = await makeState({
        name: 'proxy-1',
        config: { login: 'bob' },
      })
      state.form = { name: 'renamed', config: { login: 'bob' } }
      ds.checkDirty()

      expect(ds.isFieldDirty('name')).toBe(true)
      expect(ds.isFieldDirty('config.login')).toBe(false)
    })

    it('whole-object replacement marks the touched sub-field only', async () => {
      const { state, ds } = await makeState({ config: { a: 1, b: 2 } })
      state.form = { config: { a: 1, b: 3 } }
      ds.checkDirty()

      expect(ds.isFieldDirty('config.a')).toBe(false)
      expect(ds.isFieldDirty('config.b')).toBe(true)
    })

    it('missing paths and non-object segments resolve to not-dirty', async () => {
      const { state, ds } = await makeState({ config: { a: 1 } })
      state.form = { config: { a: 2 } }
      ds.checkDirty()

      expect(ds.isFieldDirty('config.nope')).toBe(false)
      expect(ds.isFieldDirty('config.a.deeper')).toBe(false)
      expect(ds.isFieldDirty('ghost.path')).toBe(false)
    })

    it('a sub-field added after the snapshot is dirty', async () => {
      const { state, ds } = await makeState({ config: { a: 1 } })
      state.form = { config: { a: 1, added: true } }
      ds.checkDirty()

      expect(ds.isFieldDirty('config.added')).toBe(true)
      expect(ds.isFieldDirty('config.a')).toBe(false)
    })

    it('deep paths work (three segments)', async () => {
      const { state, ds } = await makeState({ config: { auth: { user: 'bob' } } })
      state.form = { config: { auth: { user: 'alice' } } }
      ds.checkDirty()

      expect(ds.isFieldDirty('config.auth.user')).toBe(true)
    })
  })

  it('reset clears everything', async () => {
    const { state, ds } = await makeState({ name: 'Dune' })
    state.form = { name: 'X' }
    ds.checkDirty()
    ds.reset()
    expect(ds.dirty.value).toBe(false)
    expect(ds.ready.value).toBe(false)
    ds.checkDirty()
    expect(ds.dirty.value).toBe(false) // not ready → no-op
  })
})

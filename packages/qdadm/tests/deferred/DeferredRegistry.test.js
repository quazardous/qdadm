import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeferredRegistry, createDeferredRegistry } from '../../src/deferred/DeferredRegistry'

describe('DeferredRegistry', () => {
  let registry

  beforeEach(() => {
    registry = new DeferredRegistry()
  })

  describe('await()', () => {
    it('creates a pending promise for unknown key', () => {
      const promise = registry.await('test')
      expect(promise).toBeInstanceOf(Promise)
      expect(registry.status('test')).toBe('pending')
    })

    it('returns same promise for same key', () => {
      const p1 = registry.await('test')
      const p2 = registry.await('test')
      expect(p1).toBe(p2)
    })

    it('can be called before queue()', async () => {
      const promise = registry.await('test')

      // Queue after await
      registry.queue('test', () => 'result')

      const result = await promise
      expect(result).toBe('result')
    })
  })

  describe('queue()', () => {
    it('executes task and resolves promise', async () => {
      const result = await registry.queue('test', () => 'hello')
      expect(result).toBe('hello')
      expect(registry.status('test')).toBe('completed')
    })

    it('handles async executors', async () => {
      const result = await registry.queue('test', async () => {
        await new Promise(r => setTimeout(r, 10))
        return 'async result'
      })
      expect(result).toBe('async result')
    })

    it('is idempotent - returns same promise on second call', async () => {
      const executor = vi.fn().mockReturnValue('first')
      const secondExecutor = vi.fn().mockReturnValue('second')

      const p1 = registry.queue('test', executor)
      const p2 = registry.queue('test', secondExecutor)

      // Same promise returned
      expect(p1).toBe(p2)

      // Await to let executor run
      const result = await p1
      expect(result).toBe('first')

      // First executor called once, second never called
      expect(executor).toHaveBeenCalledTimes(1)
      expect(secondExecutor).toHaveBeenCalledTimes(0)
    })

    it('handles executor errors', async () => {
      const error = new Error('Task failed')

      await expect(
        registry.queue('test', () => { throw error })
      ).rejects.toThrow('Task failed')

      expect(registry.status('test')).toBe('failed')
    })

    it('stores value on completion', async () => {
      await registry.queue('test', () => 'stored')
      expect(registry.value('test')).toBe('stored')
    })
  })

  describe('resolve()', () => {
    it('resolves pending promise externally', async () => {
      const promise = registry.await('test')

      const resolved = registry.resolve('test', 'external')
      expect(resolved).toBe(true)

      const result = await promise
      expect(result).toBe('external')
      expect(registry.status('test')).toBe('completed')
    })

    it('returns false if already completed', async () => {
      await registry.queue('test', () => 'first')

      const resolved = registry.resolve('test', 'second')
      expect(resolved).toBe(false)
      expect(registry.value('test')).toBe('first')
    })
  })

  describe('reject()', () => {
    it('rejects pending promise externally', async () => {
      const promise = registry.await('test')
      const error = new Error('External rejection')

      const rejected = registry.reject('test', error)
      expect(rejected).toBe(true)

      await expect(promise).rejects.toThrow('External rejection')
      expect(registry.status('test')).toBe('failed')
    })

    it('returns false if already failed', async () => {
      await registry.queue('test', () => { throw new Error('first') }).catch(() => {})

      const rejected = registry.reject('test', new Error('second'))
      expect(rejected).toBe(false)
    })
  })

  describe('status helpers', () => {
    it('has() returns true for existing keys', () => {
      registry.await('test')
      expect(registry.has('test')).toBe(true)
      expect(registry.has('unknown')).toBe(false)
    })

    it('isSettled() returns true for completed/failed', async () => {
      expect(registry.isSettled('test')).toBe(false)

      await registry.queue('test', () => 'done')
      expect(registry.isSettled('test')).toBe(true)
    })

    it('keys() returns all registered keys', () => {
      registry.await('a')
      registry.await('b')
      registry.await('c')

      expect(registry.keys()).toEqual(['a', 'b', 'c'])
    })

    it('entries() returns key/status/timestamp', () => {
      registry.await('pending-task')

      const entries = registry.entries()
      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe('pending-task')
      expect(entries[0].status).toBe('pending')
      expect(entries[0].timestamp).toBeGreaterThan(0)
    })
  })

  describe('clear()', () => {
    it('removes a specific entry', () => {
      registry.await('test')
      expect(registry.has('test')).toBe(true)

      registry.clear('test')
      expect(registry.has('test')).toBe(false)
    })

    it('clearAll() removes all entries', () => {
      registry.await('a')
      registry.await('b')

      registry.clearAll()

      expect(registry.keys()).toEqual([])
    })
  })

  describe('kernel integration', () => {
    it('emits events on kernel if provided', async () => {
      const kernel = {
        emit: vi.fn()
      }

      registry = new DeferredRegistry({ kernel })

      await registry.queue('test', () => 'result')

      expect(kernel.emit).toHaveBeenCalledWith('deferred:started', { key: 'test' })
      expect(kernel.emit).toHaveBeenCalledWith('deferred:completed', { key: 'test', value: 'result' })
    })

    it('emits failed event on error', async () => {
      const kernel = { emit: vi.fn() }
      registry = new DeferredRegistry({ kernel })

      const error = new Error('fail')
      await registry.queue('test', () => { throw error }).catch(() => {})

      expect(kernel.emit).toHaveBeenCalledWith('deferred:failed', { key: 'test', error })
    })
  })

  describe('factory function', () => {
    it('createDeferredRegistry() creates instance', () => {
      const reg = createDeferredRegistry({ debug: false })
      expect(reg).toBeInstanceOf(DeferredRegistry)
    })
  })

  describe('Promise.all pattern', () => {
    it('works with Promise.all for multiple dependencies', async () => {
      // Simulate warmup: queue services
      registry.queue('users', async () => {
        await new Promise(r => setTimeout(r, 10))
        return { users: ['alice', 'bob'] }
      })
      registry.queue('config', () => ({ theme: 'dark' }))

      // Simulate component: await multiple
      const [users, config] = await Promise.all([
        registry.await('users'),
        registry.await('config')
      ])

      expect(users).toEqual({ users: ['alice', 'bob'] })
      expect(config).toEqual({ theme: 'dark' })
    })
  })
})

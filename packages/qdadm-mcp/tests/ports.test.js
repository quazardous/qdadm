// @vitest-environment node
/**
 * The relay walks its port list instead of dying on EADDRINUSE (#2231).
 *
 * Measured before the fix: 7777 (the old default) held by an unrelated
 * daemon, 17777 by a container, and the relay crashing on both.
 *
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createServer } from 'node:net'
import { AllPortsBusyError, listenOnFirstFreePort, openWebSocketServer } from '../src/relay/ports.ts'

const opened = []
afterEach(async () => {
  await Promise.all(opened.splice(0).map((s) => new Promise((r) => s.close(() => r()))))
})

const occupy = () =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      opened.push(s)
      resolve(s.address().port)
    })
  })

const freePort = async () => {
  const port = await occupy()
  await new Promise((r) => opened.pop().close(() => r()))
  return port
}

describe('listenOnFirstFreePort', () => {
  it('skips a busy port and listens on the next one', async () => {
    const busy = await occupy()
    const free = await freePort()

    const { port, value, busy: skipped } = await listenOnFirstFreePort([busy, free], (p) => openWebSocketServer(p))
    opened.push(value)

    expect(port).toBe(free)
    expect(skipped).toEqual([busy])
  })

  it('says so when every port is taken, naming them', async () => {
    const a = await occupy()
    const b = await occupy()

    const failure = listenOnFirstFreePort([a, b], (p) => openWebSocketServer(p))
    await expect(failure).rejects.toBeInstanceOf(AllPortsBusyError)
    await expect(failure).rejects.toMatchObject({ ports: [a, b] })
  })

  it('does not swallow errors that are not about the port being taken', async () => {
    const boom = Object.assign(new Error('boom'), { code: 'EINVAL' })
    await expect(listenOnFirstFreePort([1], () => Promise.reject(boom))).rejects.toBe(boom)
  })
})

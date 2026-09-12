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
import { AllPortsBusyError, listenOnFirstFreePort, openWebSocketServer, relayPorts } from '../src/relay/ports.ts'
import { RELAY_PORTS } from '../src/protocol.ts'

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

describe('relayPorts — QDADM_RELAY_PORT forces one port', () => {
  it('walks the built-in list when the variable is not set', () => {
    expect(relayPorts({})).toEqual(RELAY_PORTS)
    expect(relayPorts({ QDADM_RELAY_PORT: '   ' })).toEqual(RELAY_PORTS)
  })

  it('listens on that port alone when it is set', () => {
    expect(relayPorts({ QDADM_RELAY_PORT: '50000' })).toEqual([50000])
    expect(relayPorts({ QDADM_RELAY_PORT: ' 50000\n' })).toEqual([50000])
  })

  it('refuses what is not a port instead of falling back silently', () => {
    // Silence would start the relay on 47761 and leave the user hunting for why.
    for (const value of ['', 'no', '0', '70000', '8080.5', '8080 8081']) {
      const ports = () => relayPorts({ QDADM_RELAY_PORT: value })
      if (value === '') expect(ports()).toEqual(RELAY_PORTS)
      else expect(ports).toThrow(/QDADM_RELAY_PORT is not a port number/)
    }
  })
})

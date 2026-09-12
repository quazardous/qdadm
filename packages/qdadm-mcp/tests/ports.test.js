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
import {
  AllPortsBusyError,
  isLoopbackHost,
  listenOnFirstFreePort,
  openWebSocketServer,
  relayBaseUrl,
  relayBindHost,
  relayMcpEndpoint,
  relayPorts,
} from '../src/relay/ports.ts'
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

describe('relayBaseUrl — QDADM_RELAY_URL says the relay is elsewhere', () => {
  it('is null when it is not set', () => {
    expect(relayBaseUrl({})).toBeNull()
    expect(relayBaseUrl({ QDADM_RELAY_URL: '  ' })).toBeNull()
  })

  it('takes an http or https base', () => {
    expect(relayBaseUrl({ QDADM_RELAY_URL: 'http://relay.internal:47761' })?.href).toBe('http://relay.internal:47761/')
    expect(relayBaseUrl({ QDADM_RELAY_URL: 'https://dev.example.com/qdadm' })?.href).toBe(
      'https://dev.example.com/qdadm'
    )
  })

  it('refuses what it cannot dial, instead of falling back to the local relay', () => {
    // Falling back would answer about the wrong browser, which is worse than failing.
    expect(() => relayBaseUrl({ QDADM_RELAY_URL: 'http://[nope' })).toThrow(/is not a URL/)
    expect(() => relayBaseUrl({ QDADM_RELAY_URL: 'ws://relay.internal:47761' })).toThrow(/must be http/)
    expect(() => relayBaseUrl({ QDADM_RELAY_URL: 'file:///tmp/relay' })).toThrow(/must be http/)
    // A host and a port with no scheme parses as a scheme of its own: it is still not dialable.
    expect(() => relayBaseUrl({ QDADM_RELAY_URL: 'relay.internal:47761' })).toThrow(/must be http/)
  })

  it('keeps the path of a relay behind a proxy prefix', () => {
    const proxied = relayBaseUrl({ QDADM_RELAY_URL: 'https://dev.example.com/qdadm/' })
    expect(relayMcpEndpoint(proxied).href).toBe('https://dev.example.com/qdadm/mcp')
  })

  it('reaches /mcp on a bare host', () => {
    expect(relayMcpEndpoint(relayBaseUrl({ QDADM_RELAY_URL: 'http://127.0.0.1:50000' })).href).toBe(
      'http://127.0.0.1:50000/mcp'
    )
  })
})

describe('relayBindHost — which interface the relay answers on (#2400)', () => {
  it('keeps the relay to this machine unless asked otherwise', () => {
    expect(relayBindHost({})).toBe('127.0.0.1')
    expect(relayBindHost({ QDADM_RELAY_HOST: '  ' })).toBe('127.0.0.1')
  })

  it('takes the host it is given', () => {
    expect(relayBindHost({ QDADM_RELAY_HOST: '0.0.0.0' })).toBe('0.0.0.0')
    expect(relayBindHost({ QDADM_RELAY_HOST: ' 127.0.0.2\n' })).toBe('127.0.0.2')
  })

  it('knows which hosts stay on this machine — the wider ones get warned about', () => {
    for (const host of ['127.0.0.1', '127.0.0.2', 'localhost', '::1']) {
      expect(isLoopbackHost(host)).toBe(true)
    }
    for (const host of ['0.0.0.0', '::', '192.168.1.10', '172.17.0.2']) {
      expect(isLoopbackHost(host)).toBe(false)
    }
  })
})

/**
 * Listening on a port that may be taken (#2231).
 *
 * The relay used to die on an unhandled EADDRINUSE the moment its one fixed
 * port was held by something else. It now walks a list, and says plainly
 * when the whole list is taken.
 */
import { createServer, type RequestListener, type Server } from 'node:http'
import { WebSocketServer } from 'ws'
import { RELAY_PORTS } from '../protocol.ts'

/**
 * The ports the shared relay may listen on, and the one everything else
 * looks for it on.
 *
 * `QDADM_RELAY_PORT=<port>` forces a single one — for a machine where
 * 47761–47765 are taken, firewalled, or forwarded somewhere. It stays the
 * machine's one shared relay: run file, lock, every tab and agent. (A relay
 * on a port of its own, shared with nobody, is `--port` instead.)
 */
export function relayPorts(env: NodeJS.ProcessEnv = process.env): readonly number[] {
  const forced = env.QDADM_RELAY_PORT?.trim()
  if (!forced) return RELAY_PORTS
  const port = Number(forced)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`QDADM_RELAY_PORT is not a port number: ${JSON.stringify(env.QDADM_RELAY_PORT)}`)
  }
  return [port]
}

/** What each scheme means on the wire: tabs speak ws, agents speak http, to the same relay. */
const AS_HTTP: Record<string, string> = { 'http:': 'http:', 'https:': 'https:', 'ws:': 'http:', 'wss:': 'https:' }
const AS_WS: Record<string, string> = { 'ws:': 'ws:', 'wss:': 'wss:', 'http:': 'ws:', 'https:': 'wss:' }

/** Parse one of our URL variables, or say which one is wrong and how. */
function parseRelayUrl(name: string, raw: string | undefined, schemes: Record<string, string>): URL | null {
  const value = raw?.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} is not a URL: ${JSON.stringify(raw)}`)
  }
  const wanted = schemes[url.protocol]
  if (!wanted) {
    throw new Error(`${name} must be http://, https://, ws:// or wss://, got ${JSON.stringify(raw)}`)
  }
  // One address serves both sides: ws:// given for an http endpoint is the same relay, said the tabs' way.
  url.protocol = wanted
  return url
}

/**
 * Where the agent's front reaches the relay when it is not on its own
 * loopback: `QDADM_RELAY_URL`, a base URL — typically a reverse proxy in
 * front of a relay running elsewhere (`https://dev.example.com/qdadm`).
 *
 * The relay itself is unchanged by this: it still listens where it listens,
 * and the proxy is what bridges the two. Set, it wins over
 * `QDADM_RELAY_PORT`, nothing local is started, and no run file is read —
 * the URL is the whereabouts. `ws://` and `wss://` are taken too, so one
 * address can be handed to an agent and to a page alike. A malformed one is
 * refused rather than quietly ignored.
 */
export function relayBaseUrl(env: NodeJS.ProcessEnv = process.env): URL | null {
  return parseRelayUrl('QDADM_RELAY_URL', env.QDADM_RELAY_URL, AS_HTTP)
}

/**
 * The address the dev server advertises to its pages:
 * `QDADM_RELAY_PUBLIC_URL`, a `ws://` or `wss://` URL.
 *
 * Different from `QDADM_RELAY_URL`, which says the relay is elsewhere. Here
 * the relay is local — started by the plugin, its token read from its run
 * file — but the **browser** reaches it by another address: a published
 * container port, or a proxy route. Only who is told where changes.
 */
export function relayPublicWsUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = parseRelayUrl('QDADM_RELAY_PUBLIC_URL', env.QDADM_RELAY_PUBLIC_URL, AS_WS)
  if (!url) return null
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
  url.search = ''
  url.hash = ''
  return url.href
}

/** The agents' endpoint on that relay — the base's own path kept, so a proxy prefix survives. */
export function relayMcpEndpoint(base: URL): URL {
  return new URL(`${base.pathname.replace(/\/+$/, '')}/mcp`, base)
}

/**
 * The interface the relay binds: `QDADM_RELAY_HOST` (or `--bind`), and
 * `127.0.0.1` by default — a browser and its agent normally sit on this
 * machine.
 *
 * `0.0.0.0` is what a relay inside a container needs: a socket bound to the
 * loopback refuses what Docker forwards to it from outside, so a published
 * port stays unusable however fixed it is. Binding wider is a door, and the
 * relay says so when it starts.
 */
export function relayBindHost(env: NodeJS.ProcessEnv = process.env): string {
  return env.QDADM_RELAY_HOST?.trim() || '127.0.0.1'
}

/** Whether that host keeps the relay to this machine. */
export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '::1' || /^127\./.test(host)
}

/** Errors meaning "this port is not ours to use" — try the next one. */
const UNAVAILABLE = new Set(['EADDRINUSE', 'EACCES'])

export class AllPortsBusyError extends Error {
  readonly ports: number[]

  constructor(ports: number[]) {
    super(`every port is in use: ${ports.join(', ')}`)
    this.ports = ports
  }
}

/**
 * Open the first port of `ports` that `open` manages to listen on.
 * `busy` lists the ports skipped on the way, for the startup log.
 */
export async function listenOnFirstFreePort<T>(
  ports: readonly number[],
  open: (port: number) => Promise<T>
): Promise<{ port: number; value: T; busy: number[] }> {
  const busy: number[] = []
  for (const port of ports) {
    try {
      return { port, value: await open(port), busy }
    } catch (e) {
      if (UNAVAILABLE.has((e as NodeJS.ErrnoException).code ?? '')) {
        busy.push(port)
        continue
      }
      throw e
    }
  }
  throw new AllPortsBusyError(busy)
}

/**
 * A WebSocket server on the loopback interface only: the relay drives a
 * logged-in browser session, and nothing off this machine has any business
 * reaching it.
 */
export function openWebSocketServer(port: number, host = '127.0.0.1'): Promise<WebSocketServer> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port, host })
    const onError = (e: Error) => {
      wss.close()
      reject(e)
    }
    wss.once('error', onError)
    wss.once('listening', () => {
      wss.off('error', onError)
      resolve(wss)
    })
  })
}

/**
 * An HTTP server on the loopback interface — the relay's single port:
 * WebSockets for tabs upgrade from it, agents POST /mcp to it.
 */
export function openHttpServer(port: number, handler: RequestListener, host = '127.0.0.1'): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler)
    const onError = (e: Error) => {
      server.close()
      reject(e)
    }
    server.once('error', onError)
    server.listen(port, host, () => {
      server.off('error', onError)
      resolve(server)
    })
  })
}

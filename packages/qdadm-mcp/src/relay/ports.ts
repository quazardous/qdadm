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

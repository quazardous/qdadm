/**
 * Listening on a port that may be taken (#2231).
 *
 * The relay used to die on an unhandled EADDRINUSE the moment its one fixed
 * port was held by something else. It now walks a list, and says plainly
 * when the whole list is taken.
 */
import { WebSocketServer } from 'ws'

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

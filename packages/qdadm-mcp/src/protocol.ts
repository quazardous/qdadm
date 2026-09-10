/**
 * What the relay and the page agree on (#2231) — shared by the relay (Node)
 * and the browser connector, so neither can drift from the other.
 */

/**
 * Loopback ports a relay listens on, tried in order; "Pair MCP" scans the
 * same list.
 *
 * A list, not one port: fixed ports collide. Where this was measured, the
 * old default 7777 was held by an unrelated daemon and 17777 by a container,
 * and the relay died on an unhandled EADDRINUSE. Short on purpose — every
 * closed port the page probes prints one red console error nobody can catch.
 */
export const RELAY_PORTS: readonly number[] = [47761, 47762, 47763, 47764, 47765]

/** Bumped when the page ↔ relay messages change incompatibly. */
export const RELAY_PROTOCOL = 2

/** The relay's first message on every connection: who answers on this port. */
export interface RelayIdentity {
  name: 'qdadm-mcp-relay'
  protocol: number
  /** Basename of the directory the relay was started in — usually the project. */
  project: string
  cwd: string
  port: number
  pid: number
  startedAt: number
}

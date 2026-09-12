/**
 * What the relay and the page agree on (#2231) — shared by the relay (Node)
 * and the browser connector, so neither can drift from the other.
 */

/**
 * Loopback ports a relay listens on, tried in order; the MCP tab scans the
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

/**
 * Set by qdadmMcpPlugin in dev pages only (#2231): the dev-server path that
 * returns `{ port, token }`. Its presence is what lets a tab connect to the
 * relay without a pairing code — it never exists in a production build.
 */
export const RELAY_AUTO_GLOBAL = '__qdadmRelayAuto'

export interface RelayAutoConfig {
  port: number
  token: string
  /**
   * The relay's WebSocket URL, when the page must dial an address rather
   * than this machine's loopback: a published container port, or a proxy
   * route (`QDADM_RELAY_PUBLIC_URL`). Absent for the usual local relay,
   * where `port` is enough.
   */
  url?: string
}

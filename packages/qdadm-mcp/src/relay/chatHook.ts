/**
 * `qdadm-mcp-relay --chat-hook stop` (#2252) — an agent Stop hook for the MCP tab's chat.
 *
 * When the agent is about to stop and the user wrote in the chat of a qdadm tab without an answer, it
 * keeps the agent going, with the message as the reason. For Claude Code, in `settings.json`:
 *
 * ```json
 * { "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "npx qdadm-mcp-relay --chat-hook stop", "timeout": 10 }] }] } }
 * ```
 *
 * Each message stops the agent once: that is the loop guard, whatever `stop_hook_active` says. And the hook
 * never gets in the way — no relay, no tab, no message, a relay error: it prints nothing and the agent
 * stops as it would have.
 */
import type { PendingChat } from './broker.ts'
import { findRunningRelay } from './runfile.ts'

export const CHAT_HOOK_EVENTS = ['stop'] as const

/** The Stop hook answer for what the tabs have pending, or null to let the agent stop. */
export function stopDecision(pending: PendingChat[]): { decision: 'block'; reason: string } | null {
  const lines = pending.flatMap((p) => {
    const where = [p.app, p.location].filter(Boolean).join(' ')
    return p.messages.map(
      (m) =>
        `- instance ${p.instance.slice(0, 8)}${where ? ` (${where})` : ''}: ${JSON.stringify(m.text)}` +
        (m.screenshot ? ' (with an annotated screenshot: read it with chat_read)' : '')
    )
  })
  if (lines.length === 0) return null
  return {
    decision: 'block',
    reason:
      `The user wrote in the chat of the qdadm app's MCP tab and has had no answer yet:\n${lines.join('\n')}\n` +
      'Answer with chat_send (pass that instance), then carry on or stop.',
  }
}

export interface ChatHookDeps {
  findRelay?: () => Promise<{ port: number } | null>
  fetch?: typeof fetch
}

/** What the hook prints: the decision as JSON, or an empty string to stay out of the way. */
export async function runChatHook(event: string, deps: ChatHookDeps = {}): Promise<string> {
  if (!(CHAT_HOOK_EVENTS as readonly string[]).includes(event)) {
    throw new Error(`--chat-hook supports ${CHAT_HOOK_EVENTS.join(', ')} (got "${event}")`)
  }
  const relay = await (deps.findRelay ?? (() => findRunningRelay()))().catch(() => null)
  if (!relay) return ''
  try {
    const res = await (deps.fetch ?? fetch)(`http://127.0.0.1:${relay.port}/chat/pending`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mark: true }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return ''
    const body = (await res.json()) as { instances?: PendingChat[] }
    const decision = stopDecision(Array.isArray(body?.instances) ? body.instances : [])
    return decision ? JSON.stringify(decision) : ''
  } catch {
    return ''
  }
}

export async function runChatHookCli(event: string): Promise<void> {
  // The hook's JSON input is not needed. Draining it keeps the caller from writing into a closed pipe.
  if (!process.stdin.isTTY) process.stdin.resume()
  let out = ''
  let code = 0
  try {
    out = await runChatHook(event)
  } catch (e) {
    process.stderr.write(`[qdadm-mcp-relay] ${(e as Error).message}\n`)
    code = 1
  }
  process.stdout.write(out ? `${out}\n` : '', () => process.exit(code))
}

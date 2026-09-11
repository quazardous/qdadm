/**
 * The chat Stop hook (#2252): what it prints for what the tabs have pending, and that it never gets in the
 * agent's way.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { runChatHook, stopDecision } from '../src/relay/chatHook.ts'

const pending = [
  {
    instance: '9fd97119-c90a-4e8a-a2fa-40c88bbffa1f',
    app: 'Book Manager',
    location: '/books',
    messages: [{ text: 'the save button does nothing', at: 1 }],
  },
]

const relayAnswering = (body, ok = true) => ({
  findRelay: async () => ({ port: 47761 }),
  fetch: vi.fn(async () => ({ ok, json: async () => body })),
})

describe('chat Stop hook (#2252)', () => {
  it('blocks the stop with the message, where it was written, and what to do', () => {
    expect(stopDecision(pending)).toEqual({
      decision: 'block',
      reason:
        "The user wrote in the chat of the qdadm app's MCP tab and has had no answer yet:\n" +
        '- instance 9fd97119 (Book Manager /books): "the save button does nothing"\n' +
        'Answer with chat_send (pass that instance), then carry on or stop.',
    })
    expect(stopDecision([])).toBeNull()
  })

  it('says when a message comes with a screenshot, which chat_read hands over (#2309)', () => {
    const reason = stopDecision([{ ...pending[0], messages: [{ text: 'this one', at: 1, screenshot: true }] }]).reason
    expect(reason).toContain('- instance 9fd97119 (Book Manager /books): "this one" (with an annotated screenshot: read it with chat_read)')
  })

  it('asks the relay to mark what it shows, and prints the decision as JSON', async () => {
    const deps = relayAnswering({ instances: pending })
    const out = await runChatHook('stop', deps)
    expect(JSON.parse(out).decision).toBe('block')
    expect(deps.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:47761/chat/pending',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ mark: true }) })
    )
  })

  it('stays out of the way: nothing pending, no relay, a relay error, an unreachable relay', async () => {
    expect(await runChatHook('stop', relayAnswering({ instances: [] }))).toBe('')
    expect(await runChatHook('stop', { findRelay: async () => null })).toBe('')
    expect(await runChatHook('stop', relayAnswering({}, false))).toBe('')
    expect(
      await runChatHook('stop', {
        findRelay: async () => ({ port: 47761 }),
        fetch: async () => {
          throw new Error('ECONNREFUSED')
        },
      })
    ).toBe('')
  })

  it('an event it does not handle is a usage error', async () => {
    await expect(runChatHook('pretooluse', { findRelay: async () => null })).rejects.toThrow('--chat-hook supports stop (got "pretooluse")')
  })
})

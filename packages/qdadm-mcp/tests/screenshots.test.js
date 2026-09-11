// @vitest-environment node
/**
 * Screenshots kept in the project (#2284): the stdio front writes each picture under .aiball/screenshots/ in the
 * directory the agent's client started it in; the relay writes nothing.
 *
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createQdadmMcpServer } from '../src/server.ts'
import { createStdioFront } from '../src/relay/front.ts'
import { keepScreenshot, pageSlug, screenshotFileName } from '../src/relay/screenshots.ts'

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64')
const AT = new Date(2026, 8, 11, 11, 22, 33)
const INSTANCE = '34fcb409-1bfb-461c-963d-54014e8800e1'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'qdadm-shots-'))
  dirs.push(d)
  return d
}

const linked = async (server, name) => {
  const client = new Client({ name, version: '1' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return client
}

/** The relay's MCP server (pairing is what makes it the relay: page tools included), with a tab that answers screenshots. */
const relayServer = () =>
  createQdadmMcpServer(
    {
      ask: async (type) =>
        type === 'screenshot'
          ? { data: PNG, mimeType: 'image/png', width: 10, height: 5, source: 'dom' }
          : type === 'chatRead'
            ? { messages: [{ text: 'this one', at: 1, image: { mimeType: 'image/png', data: PNG } }, { text: 'thanks', at: 2 }] }
            : {},
      pickSession: () => ({ id: INSTANCE, lastSeenAt: Date.now(), meta: { location: '/books/12/edit' } }),
      listSessions: () => [],
      prefix: '/relay',
      pairing: { status: () => ({ waiting: [] }), accept: async () => ({}) },
    },
    { name: 'qdadm-relay' }
  )

const agentOnFront = async (options = {}) => {
  const cwd = tempDir()
  const front = createStdioFront({ connectUpstream: () => linked(relayServer(), 'front'), cwd, now: () => AT, log: () => {}, ...options })
  return { client: await linked(front, 'agent'), cwd }
}
const textOf = (res) => res.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
const FILE = '20260911-112233-34fcb409-books-12-edit.png'

describe('screenshots kept in the project (#2284)', () => {
  it('names a file by time, instance and page', () => {
    expect(pageSlug('/books/12/edit')).toBe('books-12-edit')
    expect(pageSlug('/')).toBe('home')
    expect(pageSlug('/#/books')).toBe('books') // hash routing (#2317)
    expect(pageSlug(null)).toBe('home')
    expect(screenshotFileName(AT, { instance: INSTANCE, location: '/books/12/edit' }, 'image/jpeg')).toBe(
      '20260911-112233-34fcb409-books-12-edit.jpg'
    )
  })

  it('the stdio front writes the picture under .aiball/screenshots/ and says where', async () => {
    const { client, cwd } = await agentOnFront()

    const res = await client.callTool({ name: 'screenshot', arguments: {} })

    expect(res.isError).toBeFalsy()
    expect(res.content.find((c) => c.type === 'image').data).toBe(PNG)
    expect(textOf(res)).toContain(`Saved to ${join('.aiball', 'screenshots', FILE)}.`)
    expect(readFileSync(join(cwd, '.aiball', 'screenshots', FILE)).toString('base64')).toBe(PNG)
    await client.close()
  })

  it('two pictures in the same second do not overwrite each other', async () => {
    const { client, cwd } = await agentOnFront()

    await client.callTool({ name: 'screenshot', arguments: {} })
    await client.callTool({ name: 'screenshot', arguments: {} })

    expect(readdirSync(join(cwd, '.aiball', 'screenshots')).sort()).toEqual([FILE, FILE.replace('.png', '-2.png')].sort())
    await client.close()
  })

  it('save: false skips one picture; --no-save-screenshots skips them all', async () => {
    const once = await agentOnFront()
    const skipped = await once.client.callTool({ name: 'screenshot', arguments: { save: false } })
    expect(textOf(skipped)).not.toContain('Saved')
    expect(existsSync(join(once.cwd, '.aiball'))).toBe(false)
    await once.client.close()

    const off = await agentOnFront({ saveScreenshots: false })
    const res = await off.client.callTool({ name: 'screenshot', arguments: {} })
    expect(res.content.some((c) => c.type === 'image')).toBe(true)
    expect(existsSync(join(off.cwd, '.aiball'))).toBe(false)
    await off.client.close()
  })

  it('the relay itself writes nothing, and tells the front which instance and page the picture shows', async () => {
    const client = await linked(relayServer(), 'agent-on-relay')

    const res = await client.callTool({ name: 'screenshot', arguments: {} })

    expect(textOf(res)).not.toContain('Saved')
    expect(res._meta['qdadm/screenshot']).toEqual({ instance: INSTANCE, location: '/books/12/edit' })
    await client.close()
  })

  it('chat_read hands over the screenshots the user sent, and the front keeps them (#2309)', async () => {
    const { client, cwd } = await agentOnFront()

    const res = await client.callTool({ name: 'chat_read', arguments: {} })

    expect(res.content.filter((c) => c.type === 'image').map((c) => c.data)).toEqual([PNG])
    const listed = JSON.parse(res.content[0].text).data.messages
    expect(listed).toEqual([
      { text: 'this one', at: 1, screenshot: 'image 1 below' },
      { text: 'thanks', at: 2 },
    ])
    expect(textOf(res)).toContain(`Saved to ${join('.aiball', 'screenshots', '20260911-112233-34fcb409-chat.png')}.`)
    expect(readdirSync(join(cwd, '.aiball', 'screenshots'))).toEqual(['20260911-112233-34fcb409-chat.png'])
    await client.close()
  })

  it('an answer from an older relay, without _meta, still gets the instance from its text', () => {
    const cwd = tempDir()
    const res = keepScreenshot(
      { content: [{ type: 'image', data: PNG, mimeType: 'image/jpeg' }, { type: 'text', text: 'Instance abcdef12. 10×5 jpeg.' }] },
      { cwd, now: () => AT }
    )

    expect(textOf(res)).toContain('20260911-112233-abcdef12-home.jpg')
  })

  it('a picture that cannot be written does not fail the screenshot', () => {
    const cwd = tempDir()
    writeFileSync(join(cwd, '.aiball'), 'a file where the folder should be')

    const res = keepScreenshot({ content: [{ type: 'image', data: PNG, mimeType: 'image/png' }] }, { cwd, now: () => AT })

    expect(res.isError).toBeFalsy()
    expect(textOf(res)).toMatch(/^Not saved to \.aiball\/screenshots: /)
  })
})

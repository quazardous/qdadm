/**
 * `qdadm-mcp-relay --call <tool> '<json args>'` (#2263) — one MCP tool call from a shell, then exit.
 *
 * It takes the agent's own path: the stdio front finds the machine relay (or starts one), forwards the call, and keeps
 * a screenshot under `.aiball/screenshots/`. It prints the tool's text answer, and the exit code says how it went:
 * 0 done, 1 the tool answered with an error, 2 the command line was wrong. For scripts, demos and CI checks.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { createStdioFront, type StdioFrontOptions } from './front.ts'

export interface CallOptions extends StdioFrontOptions {
  /** Where the answer goes, one part per call. Default: stdout. */
  write?: (text: string) => void
}

export async function runCall(tool: string, rawArgs: string | undefined, options: CallOptions = {}): Promise<number> {
  const write = options.write ?? ((text: string) => void process.stdout.write(`${text}\n`))
  const log = options.log ?? ((message: string) => console.error(message))
  if (!tool) {
    log(`qdadm-mcp-relay --call needs a tool name, e.g. --call page_snapshot '{"filter":"interactive"}'`)
    return 2
  }
  let args: Record<string, unknown> = {}
  if (rawArgs !== undefined && rawArgs.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(rawArgs)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      args = parsed as Record<string, unknown>
    } catch (e) {
      log(`qdadm-mcp-relay --call ${tool}: the arguments must be a JSON object (${(e as Error).message})`)
      return 2
    }
  }

  const front = createStdioFront({ ...options, log })
  const client = new Client({ name: 'qdadm-mcp-call', version: '1.0.0' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([front.connect(serverSide), client.connect(clientSide)])
  try {
    // A name the relay does not know would come back as "unreachable": say what it is instead.
    const { tools } = await client.listTools()
    if (!tools.some((t) => t.name === tool)) {
      log(`qdadm-mcp-relay --call: unknown tool "${tool}" (known: ${tools.map((t) => t.name).join(', ')})`)
      return 2
    }
    const result = (await client.callTool({ name: tool, arguments: args })) as CallToolResult
    for (const part of result.content) {
      if (part.type === 'text') write(part.text)
      else if (part.type === 'image') write(`[image ${part.mimeType}]`)
    }
    return result.isError ? 1 : 0
  } catch (e) {
    log(`qdadm-mcp-relay --call ${tool}: ${(e as Error).message}`)
    return 1
  } finally {
    await client.close().catch(() => {})
    await front.close().catch(() => {})
  }
}

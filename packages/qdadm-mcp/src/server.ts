/**
 * Shared MCP server assembly for the qdadm toolset (#1497).
 *
 * Registers the curated tools through the LOW-LEVEL SDK Server instead of
 * `McpServer.registerTool`: the sugar validates zod shapes before the
 * handler runs and surfaces failures as raw ZodError JSON dumps — written
 * for humans debugging zod, not for agents. Here we advertise hand-built
 * JSON Schema (required fields correctly declared) and validate the args
 * ourselves, formatting every failure as one actionable sentence — the
 * same register as the no-session message.
 *
 * Used by the dev-server plugin, the relay's HTTP front, and --stdio: one
 * registration layer, three transports.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import {
  buildToolset,
  listRegisteredEntities,
  type DebugBrokerApi,
  type ToolArg,
  type ToolDef,
  type ToolsetOptions,
} from './tools.ts'

export interface McpServerOptions extends ToolsetOptions {
  /** MCP server identity (shown to clients). */
  name?: string
  version?: string
}

const JSON_TYPES: Record<ToolArg['kind'], unknown> = {
  string: 'string',
  id: ['string', 'number'],
  object: 'object',
}

const KIND_LABEL: Record<ToolArg['kind'], string> = {
  string: 'a string',
  id: 'a string or number',
  object: 'an object',
}

function toInputSchema(tool: ToolDef): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const [name, arg] of Object.entries(tool.args)) {
    properties[name] = { type: JSON_TYPES[arg.kind], description: arg.description }
    if (arg.required) required.push(name)
  }
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

function matchesKind(value: unknown, kind: ToolArg['kind']): boolean {
  if (kind === 'string') return typeof value === 'string'
  if (kind === 'id') return typeof value === 'string' || typeof value === 'number'
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validate args against the tool's specs. Returns one actionable sentence
 * per problem (empty array = valid) plus the names of the failing fields.
 */
function validateArgs(
  tool: ToolDef,
  args: Record<string, unknown>
): { problems: string[]; fields: string[] } {
  const problems: string[] = []
  const fields: string[] = []
  for (const [name, arg] of Object.entries(tool.args)) {
    const value = args[name]
    if (value === undefined || value === null) {
      if (arg.required) {
        problems.push(`Missing required argument '${name}': ${arg.description}.`)
        fields.push(name)
      }
      continue
    }
    if (!matchesKind(value, arg.kind)) {
      problems.push(
        `Invalid argument '${name}': expected ${KIND_LABEL[arg.kind]}, got ${
          Array.isArray(value) ? 'an array' : typeof value
        }.`
      )
      fields.push(name)
    }
  }
  return { problems, fields }
}

function errorResult(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] }
}

/**
 * Build a ready-to-connect MCP Server exposing the qdadm toolset.
 */
export function createQdadmMcpServer(api: DebugBrokerApi, options: McpServerOptions = {}): Server {
  const server = new Server(
    { name: options.name ?? 'qdadm', version: options.version ?? '1.0.0' },
    { capabilities: { tools: {} } }
  )
  const tools = buildToolset(api, options)

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: toInputSchema(t),
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name)
    if (!tool) {
      return errorResult(
        `Unknown tool '${request.params.name}'. Available tools: ${tools
          .map((t) => t.name)
          .join(', ')}.`
      )
    }

    const args = (request.params.arguments ?? {}) as Record<string, unknown>

    const { problems, fields } = validateArgs(tool, args)
    if (problems.length > 0) {
      let text = problems.join(' ')
      // The thing the agent will ask for next (#1497): when an entity arg
      // failed and a session is reachable, append the registered names.
      if (fields.includes('entity')) {
        const entities = await listRegisteredEntities(api, args)
        text +=
          entities && entities.length > 0
            ? ` Registered entities: ${entities.join(', ')}.`
            : ' Call entity_state (no arguments) to list registered entities.'
      }
      return errorResult(text)
    }

    try {
      const result = await tool.handler(args)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    } catch (e) {
      return errorResult((e as Error).message)
    }
  })

  return server
}

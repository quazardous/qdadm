<script setup lang="ts">
/**
 * "Pair MCP" (#2231) — pairs this tab with a local qdadm-mcp-relay.
 *
 * Driven entirely through `window.__qdadmRelay`, the controller installed by
 * `@quazardous/qdadm-mcp/connector`. No connector, no button: qddebug knows
 * nothing about MCP beyond that duck-typed global.
 */
import { computed, onUnmounted, ref } from 'vue'

interface RelayIdentityLike {
  project?: string
  cwd?: string
  port?: number
}

interface RelayStateLike {
  status: string
  code?: string
  message?: string
  permissionPending?: boolean
  ports?: readonly number[]
  relay?: RelayIdentityLike
  relays?: RelayIdentityLike[]
}

interface RelayControllerLike {
  readonly state: RelayStateLike
  subscribe(listener: (state: RelayStateLike) => void): () => void
  pair(port?: number): Promise<void>
  unpair(): void
}

const controller = ((): RelayControllerLike | null => {
  try {
    const c = (globalThis as { __qdadmRelay?: RelayControllerLike }).__qdadmRelay
    return c && typeof c.subscribe === 'function' ? c : null
  } catch {
    return null
  }
})()

const state = ref<RelayStateLike>({ status: 'idle' })
const unsubscribe = controller?.subscribe((next) => {
  state.value = next
})
onUnmounted(() => unsubscribe?.())

const busy = computed(() => state.value.status === 'scanning' || state.value.status === 'reconnecting')
const trouble = computed(() => state.value.status === 'error' || state.value.status === 'none-found')

const relayName = (relay?: RelayIdentityLike) =>
  relay ? `${relay.project ?? 'relay'} (port ${relay.port ?? '?'})` : 'the relay'

/** "424242" → "424 242": easier to read out loud. */
const spaced = (code?: string) => (code && code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code ?? '')

const title = computed(() => {
  const s = state.value
  if (s.status === 'scanning') return 'Looking for an MCP relay on this machine…'
  if (s.status === 'reconnecting') return `Pairing again with ${relayName(s.relay)}…`
  if (s.status === 'none-found' && s.permissionPending) {
    return (
      'The browser is holding the connection to the relay until you allow local network access for this site ' +
      '(see the prompt by the address bar). Then click again.'
    )
  }
  if (s.status === 'none-found') {
    return `No MCP relay answered on ports ${(s.ports ?? []).join(', ')}. Start one (your agent can spawn qdadm-mcp-relay), then click again.`
  }
  if (s.status === 'error') return `${s.message ?? 'Pairing failed.'} Click to pair again.`
  return 'Pair this tab with a local MCP relay, so an agent can debug it'
})

const pair = (port?: number) => {
  void controller?.pair(port)
}
const unpair = () => controller?.unpair()
</script>

<template>
  <span v-if="controller" class="qdd-relay">
    <button
      v-if="state.status === 'awaiting-code'"
      type="button"
      class="qdd-relay-btn qdd-relay-code"
      :title="`Give your agent this code (it calls pair_accept). Relay: ${relayName(state.relay)}. Click to cancel.`"
      @click="unpair"
    >
      <i class="pi pi-link" /> {{ spaced(state.code) }}
    </button>
    <button
      v-else-if="state.status === 'paired'"
      type="button"
      class="qdd-relay-btn qdd-relay-active"
      :title="`Paired with the MCP relay of ${relayName(state.relay)}. Click to unpair.`"
      @click="unpair"
    >
      <i class="pi pi-link" /> MCP
    </button>
    <template v-else-if="state.status === 'choose'">
      <button
        v-for="relay in state.relays"
        :key="relay.port"
        type="button"
        class="qdd-relay-btn"
        :title="`Pair with the relay started in ${relay.cwd}`"
        @click="pair(relay.port)"
      >
        <i class="pi pi-link" /> {{ relay.project }}
      </button>
    </template>
    <button v-else type="button" class="qdd-relay-btn" :class="{ 'qdd-relay-warn': trouble }" :disabled="busy" :title="title" @click="pair()">
      <i :class="['pi', busy ? 'pi-spin pi-spinner' : 'pi-link']" /> MCP<span v-if="trouble" class="qdd-relay-trouble">!</span>
    </button>
  </span>
</template>

<style scoped>
/*
 * Own button styles: DebugBar's .qd-btn is scoped to DebugBar and does not
 * reach a child component's buttons — they rendered as white browser buttons
 * with light text on the dark header.
 */
.qdd-relay {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.qdd-relay-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 1.75rem;
  padding: 0 0.55rem;
  margin: 0;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
}
.qdd-relay-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}
.qdd-relay-btn:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}
.qdd-relay-btn:disabled {
  cursor: progress;
  opacity: 0.7;
}
.qdd-relay-btn .pi {
  font-size: 0.85rem;
}
.qdd-relay-active {
  color: #4ade80;
}
.qdd-relay-warn {
  color: #fbbf24;
}
.qdd-relay-code {
  color: #fff;
  background: #2563eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em;
}
.qdd-relay-code:hover:not(:disabled) {
  background: #1d4ed8;
}
.qdd-relay-trouble {
  font-weight: 700;
}
</style>

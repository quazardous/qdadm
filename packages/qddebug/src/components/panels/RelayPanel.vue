<script setup lang="ts">
/**
 * RelayPanel — the MCP tab (#2231): pair this browser tab with a local
 * qdadm-mcp-relay, so an agent can debug the live app.
 */
import { computed, onUnmounted, ref } from 'vue'
import type { RelayCollector, RelayIdentityLike } from '../../collectors/RelayCollector'

const props = defineProps<{
  collector: RelayCollector
  entries?: unknown[]
}>()

const tick = ref(0)
const stopListening = props.collector.onNotify(() => {
  tick.value++
})
onUnmounted(stopListening)

const state = computed(() => {
  void tick.value
  return props.collector.state
})
const busy = computed(() => state.value.status === 'scanning' || state.value.status === 'reconnecting')

/** "424242" → "424 242": easier to read out loud. */
const spaced = (code?: string) => (code && code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code ?? '')
const relayName = (relay?: RelayIdentityLike) => (relay ? `${relay.project ?? 'relay'} · port ${relay.port ?? '?'}` : '')

const pair = (port?: number) => {
  void props.collector.pair(port)
}
const unpair = () => props.collector.unpair()

const SETUP = 'claude mcp add qdadm -- npx qdadm-mcp-relay --stdio'
</script>

<template>
  <div class="mcp-panel">
    <template v-if="state.status === 'unavailable'">
      <p class="mcp-lead">The MCP connector is not installed in this app.</p>
      <p class="mcp-hint">
        Call <code>installQdadmRelayConnector()</code> from <code>@quazardous/qdadm-mcp/connector</code>, first
        thing in your entry.
      </p>
    </template>

    <template v-else-if="state.status === 'connecting'">
      <p class="mcp-lead"><i class="pi pi-spin pi-spinner" /> Connecting to the relay…</p>
    </template>

    <template v-else-if="state.status === 'connected'">
      <p class="mcp-lead mcp-ok"><i class="pi pi-check-circle" /> Connected — agents reach this tab through the relay.</p>
      <dl class="mcp-facts">
        <dt>Instance</dt>
        <dd><code>{{ (state.instanceId ?? '').slice(0, 8) }}</code></dd>
        <dt>Relay</dt>
        <dd>{{ relayName(state.relay) }}</dd>
        <dt>Started in</dt>
        <dd><code>{{ state.relay?.cwd }}</code></dd>
      </dl>
      <p class="mcp-hint">Connected by the dev server, no code needed. Agents attach with <code>{{ SETUP }}</code></p>
    </template>

    <template v-else-if="state.status === 'offline'">
      <p class="mcp-lead mcp-warn">{{ state.message }}</p>
      <p class="mcp-hint">Trying again in {{ Math.round((state.retryInMs ?? 0) / 1000) }} s.</p>
    </template>

    <template v-else-if="state.status === 'awaiting-code'">
      <p class="mcp-lead">Give this code to your agent:</p>
      <div class="mcp-code">{{ spaced(state.code) }}</div>
      <p class="mcp-hint">It calls <code>pair_accept</code> with it. Relay: {{ relayName(state.relay) }}</p>
      <div class="mcp-actions">
        <button type="button" class="mcp-btn" @click="unpair">Cancel</button>
      </div>
    </template>

    <template v-else-if="state.status === 'paired'">
      <p class="mcp-lead mcp-ok"><i class="pi pi-check-circle" /> Paired — your agent drives this tab.</p>
      <dl class="mcp-facts">
        <dt>Relay</dt>
        <dd>{{ relayName(state.relay) }}</dd>
        <dt>Started in</dt>
        <dd><code>{{ state.relay?.cwd }}</code></dd>
      </dl>
      <div class="mcp-actions">
        <button type="button" class="mcp-btn" @click="unpair">Unpair</button>
      </div>
    </template>

    <template v-else-if="state.status === 'choose'">
      <p class="mcp-lead">Several relays answered. Pair with:</p>
      <div class="mcp-actions">
        <button
          v-for="relay in state.relays"
          :key="relay.port"
          type="button"
          class="mcp-btn mcp-btn-primary"
          :title="relay.cwd"
          @click="pair(relay.port)"
        >
          <i class="pi pi-link" /> {{ relayName(relay) }}
        </button>
      </div>
    </template>

    <template v-else>
      <p v-if="state.status === 'scanning'" class="mcp-lead">
        <i class="pi pi-spin pi-spinner" /> Looking for a relay on this machine…
      </p>
      <p v-else-if="state.status === 'reconnecting'" class="mcp-lead">
        <i class="pi pi-spin pi-spinner" /> Pairing again with {{ relayName(state.relay) }}…
      </p>
      <p v-else-if="state.status === 'none-found' && state.permissionPending" class="mcp-lead mcp-warn">
        The browser is holding the connection to the relay. Allow local network access for this site (the prompt
        by the address bar), then pair again.
      </p>
      <p v-else-if="state.status === 'none-found'" class="mcp-lead mcp-warn">
        No relay answered on ports {{ (state.ports ?? []).join(', ') }}.
      </p>
      <p v-else-if="state.status === 'error'" class="mcp-lead mcp-warn">{{ state.message }}</p>
      <p v-else class="mcp-lead">Pair this tab with an agent, so it can debug the live app.</p>
      <p class="mcp-hint">The agent runs the relay: <code>{{ SETUP }}</code></p>
      <div class="mcp-actions">
        <button type="button" class="mcp-btn mcp-btn-primary" :disabled="busy" @click="pair()">
          <i class="pi pi-link" /> Pair
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mcp-panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  line-height: 1.45;
}
.mcp-lead {
  margin: 0;
  font-weight: 600;
}
.mcp-hint {
  margin: 0;
  opacity: 0.75;
}
.mcp-ok {
  color: #4ade80;
}
.mcp-warn {
  color: #fbbf24;
}
.mcp-panel code {
  padding: 0 0.3rem;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  word-break: break-all;
}
.mcp-code {
  align-self: flex-start;
  padding: 0.35rem 0.9rem;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  white-space: nowrap;
}
.mcp-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.2rem 0.75rem;
  margin: 0;
}
.mcp-facts dt {
  opacity: 0.6;
}
.mcp-facts dd {
  margin: 0;
  min-width: 0;
}
.mcp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.mcp-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.mcp-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}
.mcp-btn:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}
.mcp-btn:disabled {
  cursor: progress;
  opacity: 0.6;
}
.mcp-btn-primary {
  border-color: transparent;
  background: #2563eb;
  color: #fff;
}
.mcp-btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}
</style>

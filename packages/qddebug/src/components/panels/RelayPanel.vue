<script setup lang="ts">
/**
 * RelayPanel — the MCP tab (#2231): pair this browser tab with a local
 * qdadm-mcp-relay, so an agent can debug the live app.
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
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

/**
 * The instance id agents target with `instance` — shown whatever the state,
 * so with several tabs open you can tell the agent which one you mean.
 * Clicking it copies it.
 */
const instanceShort = computed(() => props.collector.instanceId?.slice(0, 8) ?? null)
const copied = ref(false)
const copyInstance = async (event: MouseEvent) => {
  if (!instanceShort.value) return
  // Read before awaiting: once the handler yields, currentTarget is null.
  const target = event.currentTarget as Node
  try {
    await navigator.clipboard.writeText(instanceShort.value)
  } catch {
    // Clipboard refused: select the id instead, ready for Ctrl+C.
    const range = document.createRange()
    range.selectNodeContents(target)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    return
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

/** "424242" → "424 242": easier to read out loud. */
const spaced = (code?: string) => (code && code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code ?? '')
const relayName = (relay?: RelayIdentityLike) => (relay ? `${relay.project ?? 'relay'} · port ${relay.port ?? '?'}` : '')

const pair = (port?: number) => {
  void props.collector.pair(port)
}
const unpair = () => props.collector.unpair()

/** Status / Chat / History — remembered for the browser tab. */
type SubTab = 'status' | 'chat' | 'history'
const SUBTAB_KEY = 'qdadm-debug:mcp-subtab'
const readSubTab = (): SubTab => {
  try {
    const v = sessionStorage.getItem(SUBTAB_KEY)
    return v === 'chat' || v === 'history' ? v : 'status'
  } catch {
    return 'status'
  }
}
const subTab = ref<SubTab>(readSubTab())
const openSubTab = (tab: SubTab) => {
  subTab.value = tab
  try {
    sessionStorage.setItem(SUBTAB_KEY, tab)
  } catch {
    /* storage refused: the choice just does not survive a reload */
  }
}

/** The chat with the agent: it writes with chat_send, reads what you type with chat_read. */
const chat = computed(() => {
  void tick.value
  return props.collector.chat
})
/** Agent messages that arrived while the Chat sub-tab was not open. */
const chatSeenUpTo = ref(0)
const unreadChat = computed(() => chat.value.filter((m) => m.from === 'agent' && m.id > chatSeenUpTo.value).length)
watch(
  [subTab, () => chat.value.length],
  () => {
    if (subTab.value === 'chat') chatSeenUpTo.value = chat.value.at(-1)?.id ?? chatSeenUpTo.value
  },
  { immediate: true }
)
const draft = ref('')
const chatLog = ref<HTMLElement | null>(null)
const sendChat = () => {
  const text = draft.value.trim()
  if (!text) return
  props.collector.sendChat(text)
  draft.value = ''
}
const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
watch(
  [() => chat.value.length, subTab],
  async () => {
    await nextTick()
    if (chatLog.value) chatLog.value.scrollTop = chatLog.value.scrollHeight
  }
)

/** What agents did in this tab through the MCP — newest first. */
const history = computed(() => {
  void tick.value
  return [...props.collector.activity].reverse().slice(0, 50)
})
const clockSeconds = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** What any MCP client runs — no particular agent assumed. */
const SETUP = 'npx qdadm-mcp-relay --stdio'
</script>

<template>
  <div class="mcp-panel">
    <div v-if="instanceShort && state.status !== 'unavailable'" class="mcp-instance">
      <span class="mcp-instance-label">Instance</span>
      <button
        type="button"
        class="mcp-instance-id"
        :title="copied ? 'Copied' : 'Click to copy — the id to give your agent'"
        @click="copyInstance"
      >
        <code>{{ instanceShort }}</code>
        <i :class="['pi', copied ? 'pi-check' : 'pi-copy']" />
      </button>
      <span v-if="copied" class="mcp-copied">copied</span>
    </div>

    <nav v-if="state.status !== 'unavailable'" class="mcp-subtabs">
      <button type="button" class="mcp-subtab" :class="{ 'mcp-subtab-active': subTab === 'status' }" @click="openSubTab('status')">
        Status
      </button>
      <button
        v-if="collector.canChat"
        type="button"
        class="mcp-subtab"
        :class="{ 'mcp-subtab-active': subTab === 'chat' }"
        @click="openSubTab('chat')"
      >
        Chat<span v-if="unreadChat > 0" class="mcp-subtab-badge">{{ unreadChat }}</span>
      </button>
      <button
        v-if="collector.hasActivity"
        type="button"
        class="mcp-subtab"
        :class="{ 'mcp-subtab-active': subTab === 'history' }"
        @click="openSubTab('history')"
      >
        History<span class="mcp-subtab-count">{{ collector.activity.length }}</span>
      </button>
    </nav>

    <div v-if="subTab === 'status' || state.status === 'unavailable'" class="mcp-subpanel">

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
        <dt>Relay</dt>
        <dd>{{ relayName(state.relay) }}</dd>
        <dt>Started in</dt>
        <dd><code>{{ state.relay?.cwd }}</code></dd>
      </dl>
      <p class="mcp-hint">Connected by the dev server, no code needed. Agents reach it through the MCP stdio server <code>{{ SETUP }}</code></p>
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
      <p class="mcp-hint">An agent reaches the relay through the MCP stdio server <code>{{ SETUP }}</code>, which starts one if needed.</p>
      <div class="mcp-actions">
        <button type="button" class="mcp-btn mcp-btn-primary" :disabled="busy" @click="pair()">
          <i class="pi pi-link" /> Pair
        </button>
      </div>
    </template>

    </div>

    <section v-if="subTab === 'chat' && collector.canChat && state.status !== 'unavailable'" class="mcp-chat">
      <div ref="chatLog" class="mcp-chat-log">
        <p v-if="chat.length === 0" class="mcp-hint">
          Chat with the agent: it writes here with <code>chat_send</code>, and reads what you type with
          <code>chat_read</code>.
        </p>
        <div v-for="m in chat" :key="m.id" class="mcp-msg" :class="`mcp-msg-${m.from}`">
          <span class="mcp-msg-who">{{ m.from === 'agent' ? 'Agent' : 'You' }} · {{ clock(m.at) }}</span>
          <span class="mcp-msg-text">{{ m.text }}</span>
        </div>
      </div>
      <form class="mcp-chat-form" @submit.prevent="sendChat">
        <input v-model="draft" class="mcp-chat-input" maxlength="2000" placeholder="Message the agent…" @keydown.stop />
        <button type="submit" class="mcp-btn mcp-btn-primary" :disabled="!draft.trim()" title="Send">
          <i class="pi pi-send" />
        </button>
      </form>
    </section>

    <section v-if="subTab === 'history' && collector.hasActivity && state.status !== 'unavailable'" class="mcp-history">
      <p v-if="history.length === 0" class="mcp-hint">What agents do in this tab through the MCP shows up here.</p>
      <ol v-else class="mcp-history-list">
        <li v-for="e in history" :key="e.id" class="mcp-history-item" :class="{ 'mcp-history-failed': !e.ok }">
          <span class="mcp-history-time">{{ clockSeconds(e.at) }}</span>
          <code class="mcp-history-tool">{{ e.tool }}</code>
          <span class="mcp-history-detail" :title="e.ok ? e.detail : e.error">{{ e.ok ? e.detail : e.error }}</span>
          <span class="mcp-history-ms">{{ e.ms }} ms</span>
        </li>
      </ol>
    </section>
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
.mcp-instance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.mcp-instance-label {
  opacity: 0.6;
}
.mcp-instance-id {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: copy;
}
.mcp-panel .mcp-instance-id code {
  padding: 0.1rem 0.45rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.mcp-instance-id:hover code {
  background: rgba(255, 255, 255, 0.16);
}
.mcp-instance-id:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}
.mcp-instance-id .pi {
  font-size: 0.8rem;
  opacity: 0.7;
}
.mcp-copied {
  color: #4ade80;
  font-size: 0.72rem;
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
.mcp-subtabs {
  display: flex;
  gap: 0.15rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.mcp-subtab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: -1px;
  padding: 0.3rem 0.75rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  opacity: 0.65;
  cursor: pointer;
}
.mcp-subtab:hover {
  opacity: 1;
}
.mcp-subtab:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: -2px;
}
.mcp-subtab-active {
  border-bottom-color: #22c55e;
  opacity: 1;
}
.mcp-subtab-badge {
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 0.68rem;
}
.mcp-subtab-count {
  padding: 0 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.68rem;
  font-weight: 500;
}
.mcp-subpanel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.mcp-chat {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.mcp-chat-log {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 14rem;
  overflow-y: auto;
}
.mcp-msg {
  display: flex;
  flex-direction: column;
  max-width: 85%;
  padding: 0.3rem 0.6rem;
  border-radius: 10px;
  word-break: break-word;
  white-space: pre-wrap;
}
.mcp-msg-agent {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.08);
  border-bottom-left-radius: 3px;
}
.mcp-msg-user {
  align-self: flex-end;
  background: #2563eb;
  color: #fff;
  border-bottom-right-radius: 3px;
}
.mcp-msg-who {
  font-size: 0.65rem;
  opacity: 0.65;
}
.mcp-chat-form {
  display: flex;
  gap: 0.4rem;
}
.mcp-chat-input {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  font: inherit;
}
.mcp-chat-input:focus {
  outline: 2px solid #60a5fa;
  outline-offset: 0;
}
.mcp-history {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.mcp-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.mcp-history-item {
  display: grid;
  grid-template-columns: max-content max-content 1fr max-content;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.1rem 0;
  font-size: 0.75rem;
}
.mcp-history-time,
.mcp-history-ms {
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}
.mcp-history-detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}
.mcp-history-failed .mcp-history-tool,
.mcp-history-failed .mcp-history-detail {
  color: #f87171;
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

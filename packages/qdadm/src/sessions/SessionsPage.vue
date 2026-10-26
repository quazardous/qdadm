<script setup lang="ts">
/**
 * SessionsPage (#4336): who is signed in now, the sign-in history, and Close
 * for whoever may (adapter.close and the close permission). Registered by
 * SessionsModule under its permission.
 */
import { computed, inject, onMounted, ref } from 'vue'
import Card from 'primevue/card'
import Textarea from 'primevue/textarea'
import QdButton from '../components/base/QdButton.vue'
import QdMessage from '../components/base/QdMessage.vue'
import SimpleDialog from '../components/dialogs/SimpleDialog.vue'
import { useI18n } from '../i18n/useI18n'
import { usePageTitle } from '../composables/usePageTitle'
import { getSessionsRuntime, sinceText } from './SessionsModule'
import type { SessionHistoryEntry, SessionInfo } from './sessionsAdapter'
import type { TranslateParams } from '../i18n'

const rt = getSessionsRuntime()
const { tOr } = useI18n()
const security = inject<{ isGranted(attr: string): boolean } | null>('qdadmSecurityChecker', null)

/** core.sessions.<key>, or the module's `labels` */
function label(key: string, fallback: string, params: TranslateParams = {}): string {
  const custom = rt?.options.labels?.[key]
  if (typeof custom === 'function') return custom(params)
  if (typeof custom === 'string') return custom.replace(/\{(\w+)\}/g, (m, n) => (n in params ? String(params[n]) : m))
  return tOr(`core.sessions.${key}`, fallback, params)
}

usePageTitle(label('title', 'Sessions'))

const sessions = ref<SessionInfo[]>([])
const mine = ref<string | number | null>(null)
const loadError = ref<string | null>(null)
const history = ref<SessionHistoryEntry[]>([])
const notice = ref<string | null>(null)
const offset = ref(0)
const pageSize = computed(() => rt?.options.historyPageSize ?? 25)
const hasMore = ref(false)
const historyError = ref<string | null>(null)

const closePermission = computed(() => rt?.options.closePermission ?? rt?.options.permission)
const canClose = computed(
  () => !!rt?.adapter.close && (!closePermission.value || !security || security.isGranted(closePermission.value))
)
const showIp = computed(() => sessions.value.some((s) => s.ip || s.agent))
const historyIp = computed(() => history.value.some((h) => h.ip || h.agent))

async function loadSessions(): Promise<void> {
  if (!rt) return
  try {
    const res = await rt.adapter.list()
    sessions.value = res.sessions
    mine.value = res.mine ?? null
    loadError.value = null
  } catch (err) {
    loadError.value = (err as Error).message
  }
}

async function loadHistory(): Promise<void> {
  if (!rt) return
  try {
    // One more row than shown tells whether a next page exists
    const res = await rt.adapter.history({ limit: pageSize.value + 1, offset: offset.value })
    hasMore.value = res.history.length > pageSize.value
    history.value = res.history.slice(0, pageSize.value)
    notice.value = res.notice ?? null
    historyError.value = null
  } catch (err) {
    historyError.value = (err as Error).message
  }
}

function page(delta: number): void {
  offset.value = Math.max(0, offset.value + delta * pageSize.value)
  void loadHistory()
}

const isMine = (s: SessionInfo) => mine.value !== null && String(s.id) === String(mine.value)
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '')
const eventLabel = (event: string) => label(`event.${event}`, event)

// Close, with a reason
const closing = ref<SessionInfo | null>(null)
const reason = ref('')
const closeBusy = ref(false)
const closeError = ref<string | null>(null)

function askClose(s: SessionInfo): void {
  closing.value = s
  reason.value = ''
  closeError.value = null
}

async function confirmClose(): Promise<void> {
  if (!rt?.adapter.close || !closing.value || !reason.value.trim()) return
  closeBusy.value = true
  try {
    await rt.adapter.close(closing.value.id, reason.value.trim())
    closing.value = null
    await Promise.all([loadSessions(), loadHistory()])
  } catch (err) {
    closeError.value = (err as Error).message
  } finally {
    closeBusy.value = false
  }
}

onMounted(() => {
  void loadSessions()
  void loadHistory()
})
</script>

<template>
  <div class="qd-sessions">
    <QdMessage v-if="!rt" severity="warn" :closable="false">SessionsModule is not loaded.</QdMessage>
    <template v-else>
      <Card class="qd-sessions-card">
        <template #title>
          <div class="qd-sessions-head">
            <span>{{ label('present', 'Signed in now') }}</span>
            <QdButton icon="pi pi-refresh" text rounded size="small" :aria-label="label('refresh', 'Refresh')" @click="loadSessions" />
          </div>
        </template>
        <template #content>
          <QdMessage v-if="loadError" severity="error" :closable="false">{{ loadError }}</QdMessage>
          <p v-else-if="!sessions.length" class="qd-sessions-empty">{{ label('nobody', 'Nobody is signed in.') }}</p>
          <table v-else class="qd-sessions-table">
            <thead>
              <tr>
                <th>{{ label('who', 'Who') }}</th>
                <th>{{ label('via', 'Via') }}</th>
                <th>{{ label('since', 'Since') }}</th>
                <th>{{ label('seen', 'Last seen') }}</th>
                <th>{{ label('tabs', 'Tabs') }}</th>
                <th v-if="showIp">{{ label('origin', 'Origin') }}</th>
                <th v-if="canClose"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions" :key="String(s.id)" :class="{ 'qd-sessions-mine': isMine(s) }" :data-session-id="String(s.id)">
                <td>
                  {{ s.login }}
                  <span v-if="isMine(s)" class="qd-sessions-badge">{{ label('mine', 'you') }}</span>
                </td>
                <td>{{ s.via }}</td>
                <td :title="when(s.since)">{{ sinceText(s.since) }}</td>
                <td :title="when(s.seen)">{{ sinceText(s.seen) }}</td>
                <td>{{ s.tabs ?? '' }}</td>
                <td v-if="showIp" class="qd-sessions-origin">{{ [s.ip, s.agent].filter(Boolean).join(' · ') }}</td>
                <td v-if="canClose" class="qd-sessions-actions">
                  <QdButton
                    v-if="!isMine(s)"
                    size="small"
                    severity="danger"
                    text
                    icon="pi pi-sign-out"
                    :label="label('close', 'Close')"
                    @click="askClose(s)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </Card>

      <Card class="qd-sessions-card">
        <template #title>{{ label('history', 'History') }}</template>
        <template #content>
          <QdMessage v-if="notice" severity="warn" :closable="false" class="qd-sessions-notice">{{ notice }}</QdMessage>
          <QdMessage v-if="historyError" severity="error" :closable="false">{{ historyError }}</QdMessage>
          <p v-else-if="!history.length" class="qd-sessions-empty">{{ label('noHistory', 'No history yet.') }}</p>
          <table v-else class="qd-sessions-table">
            <thead>
              <tr>
                <th>{{ label('when', 'When') }}</th>
                <th>{{ label('event', 'Event') }}</th>
                <th>{{ label('who', 'Who') }}</th>
                <th>{{ label('via', 'Via') }}</th>
                <th>{{ label('by', 'By') }}</th>
                <th>{{ label('reason', 'Reason') }}</th>
                <th>{{ label('source', 'Source') }}</th>
                <th v-if="historyIp">{{ label('origin', 'Origin') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(h, i) in history" :key="`${h.at}-${i}`" :class="`qd-sessions-event--${h.event}`">
                <td>{{ when(h.at) }}</td>
                <td><span class="qd-sessions-event">{{ eventLabel(h.event) }}</span></td>
                <td>{{ h.login }}</td>
                <td>{{ h.via }}</td>
                <td>{{ h.by }}</td>
                <td>{{ h.reason }}</td>
                <td>{{ h.source }}</td>
                <td v-if="historyIp" class="qd-sessions-origin">{{ [h.ip, h.agent].filter(Boolean).join(' · ') }}</td>
              </tr>
            </tbody>
          </table>
          <div class="qd-sessions-pager">
            <QdButton size="small" text icon="pi pi-chevron-left" :label="label('newer', 'Newer')" :disabled="offset === 0" @click="page(-1)" />
            <QdButton size="small" text icon="pi pi-chevron-right" icon-pos="right" :label="label('older', 'Older')" :disabled="!hasMore" @click="page(1)" />
          </div>
        </template>
      </Card>

      <SimpleDialog
        :visible="!!closing"
        :title="label('closeTitle', 'Close the session of {name}', { name: closing?.login ?? '' })"
        :confirm-label="label('close', 'Close')"
        confirm-severity="danger"
        :confirm-disabled="!reason.trim()"
        :loading="closeBusy"
        :cancel-label="label('cancel', 'Cancel')"
        @confirm="confirmClose"
        @cancel="closing = null"
        @update:visible="(v: boolean) => !v && (closing = null)"
      >
        <label for="qd-sessions-reason" class="qd-sessions-reason-label">{{ label('reasonPrompt', 'Why? It goes into the history.') }}</label>
        <Textarea id="qd-sessions-reason" v-model="reason" rows="3" class="qd-sessions-reason" auto-resize />
        <QdMessage v-if="closeError" severity="error" :closable="false">{{ closeError }}</QdMessage>
      </SimpleDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * YamlConfigEditor - edit a live YAML configuration end to end (#4303)
 *
 * Loads a document through an adapter, edits it in VanillaYamlEditor (text
 * or form), and saves it as one gesture: the server's check, a before/after
 * diff, a required reason, then a single save against the loaded revision.
 * A save refused because someone saved meanwhile shows both versions. The
 * history lists past revisions and loads one back to save it again.
 *
 * <YamlConfigEditor :adapter="restYamlAdapter('/api/filters')" @saved="…" />
 *
 * Leaving the page with unsaved changes asks first (`guard`, default on).
 */
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import Textarea from 'primevue/textarea'
import { validate, yamlChangedPaths, type YamlEditorMode, type YamlEditorStatus, type YamlPath, type YamlProblem } from '@quazardous/vanilla-yamleditor'
import QdButton from '../../base/QdButton.vue'
import QdMessage from '../../base/QdMessage.vue'
import SimpleDialog from '../../dialogs/SimpleDialog.vue'
import PayloadDiff from '../../display/PayloadDiff.vue'
import VanillaYamlEditor from './VanillaYamlEditor.vue'
import { YamlConflictError, normalizeProblems, type YamlConfigAdapter, type YamlConfigDocument, type YamlHistoryEntry, type YamlRevision } from './yamlConfigAdapter'
import { useI18n } from '../../../i18n/useI18n'
import { useUnsavedChangesGuard } from '../../../composables/useUnsavedChangesGuard'
import { registerGuardDialog, unregisterGuardDialog } from '../../../composables/useGuardStore'

interface Props {
  adapter: YamlConfigAdapter
  /** Read only, whatever the server says. */
  readOnly?: boolean
  /** Force a view; default: form with a schema, tree without. */
  mode?: YamlEditorMode
  /** The views offered, e.g. ['form', 'text']. */
  modes?: YamlEditorMode[]
  /** Show the view buttons. */
  modeSwitch?: boolean
  /** Warn on valid YAML that is likely a typo (`key ::`); never blocks a save. */
  lint?: boolean
  height?: string
  /** Ask before leaving the page with unsaved changes. */
  guard?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false,
  mode: undefined,
  modes: undefined,
  modeSwitch: true,
  lint: true,
  height: '28rem',
  guard: true,
})

const emit = defineEmits<{
  loaded: [doc: YamlConfigDocument]
  saved: [result: { yaml: string; reason: string; revision?: YamlRevision }]
  'update:dirty': [dirty: boolean]
}>()

const { tOr } = useI18n()
const l = (key: string, fallback: string, params?: Record<string, unknown>) => tOr(`core.yamlEditor.${key}`, fallback, params as never)

const editorRef = ref<InstanceType<typeof VanillaYamlEditor> | null>(null)
const original = shallowRef<YamlConfigDocument | null>(null)
const text = ref('')
const status = shallowRef<YamlEditorStatus | null>(null)
const serverProblems = shallowRef<YamlProblem[]>([])
const loading = ref(true)
const checking = ref(false)
const saving = ref(false)
const message = ref<{ severity: 'success' | 'info' | 'warn' | 'error'; text: string } | null>(null)

const readOnly = computed(() => props.readOnly || !!original.value?.readOnly)
const dirty = computed(() => !!original.value && text.value !== original.value.yaml)
const syntaxErrors = computed(() => status.value?.syntaxErrors.length ?? 0)
const stateText = computed(() =>
  loading.value ? l('loading', 'Loading') : readOnly.value ? l('readOnly', 'Read only') : dirty.value ? l('unsaved', 'Unsaved changes') : l('upToDate', 'Up to date')
)

async function load() {
  loading.value = true
  message.value = null
  try {
    const doc = await props.adapter.load()
    original.value = doc
    text.value = doc.yaml
    serverProblems.value = []
    emit('loaded', doc)
  } catch (err) {
    message.value = { severity: 'error', text: l('loadError', 'Could not load: {message}', { message: (err as Error).message }) }
  } finally {
    loading.value = false
  }
}

onMounted(load)

function onStatus(next: YamlEditorStatus) {
  status.value = next
  emit('update:dirty', dirty.value)
}

/** Problems that block a save: errors, schema or server. */
const blocking = (list: YamlProblem[]) => list.filter((p) => (p.severity ?? 'error') === 'error')

async function runCheck(): Promise<boolean> {
  if (syntaxErrors.value) {
    message.value = { severity: 'error', text: l('syntaxErrors', '{count} syntax error | {count} syntax errors', { count: syntaxErrors.value }) }
    return false
  }
  message.value = null
  if (props.adapter.check) {
    checking.value = true
    try {
      serverProblems.value = normalizeProblems(await props.adapter.check(text.value))
    } catch (err) {
      message.value = { severity: 'error', text: (err as Error).message }
      return false
    } finally {
      checking.value = false
    }
  }
  const schema = original.value?.schema
  const local = schema ? validate(status.value?.value, schema) : []
  const problems = blocking([...local, ...serverProblems.value])
  const first = problems[0]
  if (first) {
    const where = first.path.length ? `${first.path.join('.')}: ` : ''
    message.value = { severity: 'error', text: `${l('problems', '{count} problem | {count} problems', { count: problems.length })} — ${where}${first.message}` }
    editorRef.value?.revealPath(first.path)
    return false
  }
  message.value = { severity: 'success', text: l('checkOk', 'No problem found') }
  return true
}

// --- The keys a change touches (#4412): above the review and conflict diffs ---

const MAX_KEYS = 8

/** The changed keys, at most MAX_KEYS, and how many more; null when nothing but comments or layout changed. */
function changedKeys(before: string | undefined, after: string | undefined) {
  const paths = before === undefined || after === undefined ? null : yamlChangedPaths(before, after)
  if (!paths?.length) return null
  return { shown: paths.slice(0, MAX_KEYS), more: Math.max(0, paths.length - MAX_KEYS) }
}

const keyLabel = (path: YamlPath) => path.join('.') || '/'

/** From the review: back to the editor, at that key */
function goToKey(path: YamlPath) {
  reviewOpen.value = false
  editorRef.value?.revealPath(path)
}

// --- Save: check → diff + reason → save ---

const reviewOpen = ref(false)
const reason = ref('')
const reviewKeys = computed(() => (reviewOpen.value ? changedKeys(original.value?.yaml, text.value) : null))

async function startSave() {
  if (!dirty.value) {
    message.value = { severity: 'info', text: l('noChange', 'Nothing changed') }
    return
  }
  if (!(await runCheck())) return
  message.value = null
  reviewOpen.value = true
}

async function confirmSave() {
  if (!original.value || !reason.value.trim()) return
  saving.value = true
  const yaml = text.value
  const why = reason.value.trim()
  try {
    const result = await props.adapter.save({ yaml, reason: why, revision: original.value.revision })
    original.value = { ...original.value, yaml, revision: result.revision ?? original.value.revision }
    reviewOpen.value = false
    reason.value = ''
    serverProblems.value = []
    message.value = { severity: 'success', text: l('saved', 'Saved') }
    emit('saved', { yaml, reason: why, revision: original.value.revision })
    emit('update:dirty', false)
  } catch (err) {
    if (err instanceof YamlConflictError) {
      conflict.value = err.current
      reviewOpen.value = false
      conflictOpen.value = true
    } else {
      message.value = { severity: 'error', text: l('saveError', 'Could not save: {message}', { message: (err as Error).message }) }
    }
  } finally {
    saving.value = false
  }
}

function revert() {
  if (original.value) text.value = original.value.yaml
  serverProblems.value = []
  message.value = null
}

// --- Conflict ---

const conflictOpen = ref(false)
const conflict = shallowRef<YamlConfigDocument | null>(null)
// What the other person changed: the version I loaded against theirs
const conflictKeys = computed(() => (conflictOpen.value ? changedKeys(original.value?.yaml, conflict.value?.yaml) : null))

function takeTheirs() {
  if (!conflict.value) return
  original.value = { ...original.value, ...conflict.value }
  text.value = conflict.value.yaml
  conflictOpen.value = false
}

function keepMine() {
  if (!conflict.value) return
  // Their version becomes the base: the review shows what mine changes on it
  original.value = { ...original.value, ...conflict.value }
  conflictOpen.value = false
  reviewOpen.value = true
}

// --- History ---

const historyOpen = ref(false)
const historyLoading = ref(false)
const entries = shallowRef<YamlHistoryEntry[]>([])
const selected = shallowRef<YamlHistoryEntry | null>(null)

async function openHistory() {
  if (!props.adapter.history) return
  historyOpen.value = true
  historyLoading.value = true
  try {
    entries.value = await props.adapter.history()
    selected.value = entries.value[0] ?? null
  } catch (err) {
    message.value = { severity: 'error', text: (err as Error).message }
    historyOpen.value = false
  } finally {
    historyLoading.value = false
  }
}

function restore() {
  if (!selected.value) return
  text.value = selected.value.after
  historyOpen.value = false
  message.value = { severity: 'info', text: l('restored', 'Version {revision} loaded: review and save it to restore it', { revision: selected.value.revision }) }
}

const formatDate = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

// --- Leaving with unsaved changes ---

if (props.guard) {
  const { guardDialog } = useUnsavedChangesGuard(dirty)
  registerGuardDialog(guardDialog)
  onUnmounted(() => unregisterGuardDialog(guardDialog))
}

defineExpose({ reload: load, check: runCheck, save: startSave, dirty })
</script>

<template>
  <div class="qd-yaml-config">
    <div class="qd-yaml-config-bar">
      <span class="qd-yaml-config-state" :class="{ 'qd-yaml-config-state--dirty': dirty && !readOnly }">{{ stateText }}</span>
      <QdButton
        v-if="adapter.history"
        icon="pi pi-history"
        :label="l('history', 'History')"
        severity="secondary"
        text
        size="small"
        :disabled="loading"
        @click="openHistory"
      />
      <QdButton
        v-if="adapter.check && !readOnly"
        icon="pi pi-check-circle"
        :label="l('check', 'Check')"
        severity="secondary"
        outlined
        size="small"
        :loading="checking && !reviewOpen"
        :disabled="loading || syntaxErrors > 0"
        @click="runCheck"
      />
      <QdButton
        v-if="dirty && !readOnly"
        icon="pi pi-undo"
        :label="l('revert', 'Discard changes')"
        severity="secondary"
        text
        size="small"
        @click="revert"
      />
      <QdButton
        v-if="!readOnly"
        icon="pi pi-save"
        :label="l('save', 'Save…')"
        size="small"
        :disabled="loading || !dirty || syntaxErrors > 0"
        :loading="checking"
        @click="startSave"
      />
    </div>

    <QdMessage v-if="message" :severity="message.severity" :closable="true" @close="message = null">{{ message.text }}</QdMessage>

    <VanillaYamlEditor
      v-if="original"
      ref="editorRef"
      v-model="text"
      :schema="original.schema"
      :problems="serverProblems"
      :mode="mode"
      :modes="modes"
      :mode-switch="modeSwitch"
      :lint="lint"
      :read-only="readOnly"
      :height="height"
      @status="onStatus"
    />

    <SimpleDialog
      v-model:visible="reviewOpen"
      :title="l('review', 'Review the change')"
      width="60rem"
      :cancel-label="l('cancel', 'Cancel')"
      :confirm-label="l('confirmSave', 'Save')"
      confirm-icon="pi pi-save"
      :confirm-disabled="!reason.trim()"
      :loading="saving"
      @confirm="confirmSave"
    >
      <p v-if="reviewKeys" class="qd-yaml-config-keys">
        <span>{{ l('changedKeys', 'Changed:') }}</span>
        <button v-for="path in reviewKeys.shown" :key="keyLabel(path)" type="button" class="qd-yaml-config-key" @click="goToKey(path)">{{ keyLabel(path) }}</button>
        <span v-if="reviewKeys.more" class="qd-yaml-config-more">{{ l('moreKeys', '+{count} more', { count: reviewKeys.more }) }}</span>
      </p>
      <PayloadDiff :left="original?.yaml ?? ''" :right="text" format="text" :labels="[l('before', 'Before'), l('after', 'After')]" max-height="24rem" />
      <div class="qd-yaml-config-reason">
        <label for="qd-yaml-reason">{{ l('reason', 'Reason') }} *</label>
        <Textarea id="qd-yaml-reason" v-model="reason" rows="3" auto-resize :placeholder="l('reasonPlaceholder', 'Why this change? It goes into the history.')" />
      </div>
    </SimpleDialog>

    <SimpleDialog v-model:visible="conflictOpen" :title="l('conflictTitle', 'Changed meanwhile')" width="60rem" :show-confirm="false" :cancel-label="l('cancel', 'Cancel')">
      <p>{{ l('conflictText', 'Someone saved this document after you opened it. Their version is on the left, yours on the right.') }}</p>
      <p v-if="conflictKeys" class="qd-yaml-config-keys">
        <span>{{ l('theyChanged', 'They changed:') }}</span>
        <code v-for="path in conflictKeys.shown" :key="keyLabel(path)" class="qd-yaml-config-key">{{ keyLabel(path) }}</code>
        <span v-if="conflictKeys.more" class="qd-yaml-config-more">{{ l('moreKeys', '+{count} more', { count: conflictKeys.more }) }}</span>
      </p>
      <PayloadDiff :left="conflict?.yaml ?? ''" :right="text" format="text" max-height="24rem" />
      <template #actions>
        <QdButton :label="l('takeTheirs', 'Load their version')" severity="secondary" outlined @click="takeTheirs" />
        <QdButton :label="l('keepMine', 'Keep mine and save over it')" severity="warn" @click="keepMine" />
      </template>
    </SimpleDialog>

    <SimpleDialog v-model:visible="historyOpen" :title="l('history', 'History')" width="72rem" :show-confirm="false" :cancel-label="l('cancel', 'Cancel')">
      <p v-if="historyLoading">{{ l('loading', 'Loading') }}</p>
      <p v-else-if="!entries.length">{{ l('historyEmpty', 'No history yet') }}</p>
      <div v-else class="qd-yaml-history">
        <div class="qd-yaml-history-list" role="listbox">
          <button
            v-for="entry in entries"
            :key="String(entry.revision)"
            type="button"
            role="option"
            class="qd-yaml-history-entry"
            :class="{ 'qd-yaml-history-entry--active': entry === selected }"
            :aria-selected="entry === selected"
            @click="selected = entry"
          >
            <strong>{{ entry.reason || entry.revision }}</strong>
            <span class="qd-yaml-history-meta">{{ [entry.author, formatDate(entry.date)].filter(Boolean).join(' · ') }}</span>
          </button>
        </div>
        <div v-if="selected">
          <PayloadDiff :left="selected.before ?? ''" :right="selected.after" format="text" :labels="[l('before', 'Before'), l('after', 'After')]" max-height="26rem" />
        </div>
      </div>
      <template #actions>
        <QdButton v-if="selected && !readOnly" icon="pi pi-replay" :label="l('restore', 'Load this version')" @click="restore" />
      </template>
    </SimpleDialog>
  </div>
</template>

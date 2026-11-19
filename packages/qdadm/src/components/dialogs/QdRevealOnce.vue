<script setup lang="ts">
/**
 * QdRevealOnce - the values a create revealed once (#5319)
 *
 * A key's token, a generated password: the API hands it back once and keeps
 * only its hash. This dialog shows each value with a copy button and a
 * warning, and closes only on "I have copied it". It keeps nothing: the
 * values live in its props, and whoever gives them clears them on `confirm`.
 *
 * FormPage renders it after a create whose entity declares `revealOnce`.
 * A custom page binds it to the form's `revealed` / `confirmRevealed`:
 *
 *   <QdRevealOnce :revealed="form.revealed.value" @confirm="form.confirmRevealed" />
 *
 * Labels: `entities.<entity>.reveal.<key>`, else the key.
 */
import { computed, inject, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import QdButton from '../base/QdButton.vue'
import QdMessage from '../base/QdMessage.vue'
import { useI18n } from '../../i18n/useI18n'
import { copyText } from '../../utils/clipboard'
import type { RevealedValues } from '../../composables/useEntityItemFormPage.types'

const props = defineProps<{
  revealed: RevealedValues | null
}>()

const emit = defineEmits<{
  confirm: []
}>()

const { t, tOr } = useI18n()
const orchestrator = inject<{ get: (name: string) => { label?: string } | null } | null>('qdadmOrchestrator', null)

const rows = computed(() => {
  const r = props.revealed
  if (!r) return []
  return Object.entries(r.values).map(([key, value]) => ({
    key,
    label: tOr(`entities.${r.entity}.reveal.${key}`, key),
    text: typeof value === 'string' ? value : JSON.stringify(value),
  }))
})

const title = computed(() => {
  const r = props.revealed
  if (!r) return ''
  let label: string = r.entity
  try {
    label = orchestrator?.get(r.entity)?.label || r.entity
  } catch {
    // An entity the orchestrator does not know: its name will do
  }
  return t('core.revealOnce.title', { entity: label })
})

/** Per key: what the last copy said */
const status = ref<Record<string, { ok: boolean; text: string }>>({})
watch(
  () => props.revealed,
  () => (status.value = {})
)

async function copy(key: string, text: string): Promise<void> {
  try {
    await copyText(text)
    status.value = { ...status.value, [key]: { ok: true, text: t('core.revealOnce.copied') } }
  } catch (err) {
    status.value = {
      ...status.value,
      [key]: { ok: false, text: t('core.revealOnce.copyFailed', { error: (err as Error)?.message ?? String(err) }) },
    }
  }
}

function confirm(): void {
  status.value = {}
  emit('confirm')
}
</script>

<template>
  <Dialog
    :visible="!!revealed"
    :header="title"
    modal
    :closable="false"
    :closeOnEscape="false"
    :dismissableMask="false"
    :style="{ width: '560px', maxWidth: '95vw' }"
    class="qd-reveal-once"
  >
    <QdMessage severity="warn" :closable="false" class="qd-reveal-once-warning">
      {{ t('core.revealOnce.warning') }}
    </QdMessage>
    <div v-for="row in rows" :key="row.key" class="qd-reveal-once-row">
      <div class="qd-reveal-once-label">{{ row.label }}</div>
      <div class="qd-reveal-once-value-line">
        <code class="qd-reveal-once-value" :data-key="row.key">{{ row.text }}</code>
        <QdButton
          :label="t('core.revealOnce.copy')"
          icon="pi pi-copy"
          size="small"
          severity="secondary"
          class="qd-reveal-once-copy"
          @click="copy(row.key, row.text)"
        />
      </div>
      <div
        v-if="status[row.key]"
        class="qd-reveal-once-status"
        :class="status[row.key]?.ok ? 'qd-reveal-once-status--ok' : 'qd-reveal-once-status--failed'"
        role="status"
      >
        {{ status[row.key]?.text }}
      </div>
    </div>
    <template #footer>
      <QdButton :label="t('core.revealOnce.confirm')" icon="pi pi-check" class="qd-reveal-once-confirm" @click="confirm" />
    </template>
  </Dialog>
</template>

<style scoped>
.qd-reveal-once-warning {
  margin: 0 0 1rem;
}
.qd-reveal-once-row + .qd-reveal-once-row {
  margin-top: 1rem;
}
.qd-reveal-once-label {
  font-weight: 600;
  margin-bottom: 0.35rem;
}
.qd-reveal-once-value-line {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.qd-reveal-once-value {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--p-content-border-color, #d1d5db);
  border-radius: 6px;
  background: var(--p-content-hover-background, #f3f4f6);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  word-break: break-all;
  user-select: all;
}
.qd-reveal-once-status {
  margin-top: 0.3rem;
  font-size: 0.8125rem;
}
.qd-reveal-once-status--ok {
  color: var(--p-green-600, #16a34a);
}
.qd-reveal-once-status--failed {
  color: var(--p-red-600, #dc2626);
}
</style>

<script setup lang="ts">
/**
 * TaskHost - where task dialogs live (#4114)
 *
 * Renders the follow dialog of the open run and the typed confirmation of a
 * dangerous task. AppLayout mounts one; an app with its own layout mounts
 * it once, near the root. Without a host, a task that asks for confirmation
 * does not start.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import SimpleDialog from '../dialogs/SimpleDialog.vue'
import TaskDialog from './TaskDialog.vue'
import { useI18n } from '../../i18n/useI18n'
import { useTaskRunner } from '../../tasks/useTaskRunner'
import { getTaskStore } from '../../tasks/taskStore'

useTaskRunner()
const store = getTaskStore()
const { t } = useI18n()

store.state.hosts++
onBeforeUnmount(() => store.state.hosts--)

const pending = computed(() => store.state.pendingConfirm)
const typed = ref('')
watch(pending, () => (typed.value = ''))
const expected = computed(() => pending.value?.confirm.typed ?? null)
const confirmable = computed(() => expected.value === null || typed.value === expected.value)
</script>

<template>
  <TaskDialog :run-id="store.state.openId" @close="store.open(null)" />
  <SimpleDialog :visible="!!pending" :title="pending?.label ?? ''" :confirm-label="pending?.confirm.accept ?? t('core.task.start')"
    confirm-severity="danger" :confirm-disabled="!confirmable" :cancel-label="t('core.task.dontStart')"
    @confirm="store.answerConfirm(true)" @cancel="store.answerConfirm(false)"
    @update:visible="(v: boolean) => !v && pending && store.answerConfirm(false)">
    <p v-if="pending?.confirm.message" class="qd-task-confirm-message">{{ pending.confirm.message }}</p>
    <template v-if="expected !== null">
      <label class="qd-task-confirm-label" for="qd-task-typed">{{ t('core.task.typeToConfirm', { value: expected }) }}</label>
      <InputText id="qd-task-typed" v-model="typed" class="qd-task-confirm-input" autocomplete="off" spellcheck="false"
        @keydown.enter="confirmable && store.answerConfirm(true)" />
    </template>
  </SimpleDialog>
</template>

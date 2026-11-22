<script setup>
/**
 * LicenceFooter - an app's own footer for the rich dialog (#5445): the
 * dialog gives it `read`, `values`, `resolve` and `close`. Here, a version
 * picker of its own and two buttons; "I accept" waits for the end of the text.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'

const props = defineProps({ read: Boolean, ready: Boolean, values: Object, resolve: Function, close: Function })
if (props.values.version === undefined) props.values.version = 'standard'
const versions = [{ label: 'Standard terms', value: 'standard' }, { label: 'Education terms', value: 'education' }]
</script>

<template>
  <div class="demo-licence-footer">
    <Select v-model="values.version" :options="versions" option-label="label" option-value="value" aria-label="Terms version" />
    <span class="demo-licence-hint" aria-live="polite">{{ read ? 'Thanks for reading.' : 'Read to the end to accept.' }}</span>
    <Button label="Decline" severity="secondary" data-rich-action="decline" @click="resolve('decline')" />
    <Button label="I accept" icon="pi pi-check" :disabled="!read" data-rich-action="accept" @click="resolve('accept', { acceptedAt: new Date().toISOString() })" />
  </div>
</template>

<style scoped>
.demo-licence-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  width: 100%;
}
.demo-licence-hint {
  margin-left: auto;
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
}
</style>

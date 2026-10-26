<script setup>
/**
 * SessionsPlayground — makes the sessions module (#4336) show something:
 * simulated people sign in and out, the provider history goes down.
 */
import { ref } from 'vue'
import { usePageTitle } from '@quazardous/qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { simulate, isSimulated, setProviderDown } from '../fakeSessions'

usePageTitle('Sessions demo')

const people = ['june', 'bob']
const present = ref(Object.fromEntries(people.map((p) => [p, isSimulated(p)])))
const providerDown = ref(false)

function toggle(login) {
  present.value[login] = !present.value[login]
  simulate(login, present.value[login])
}

function toggleProvider() {
  providerDown.value = !providerDown.value
  setProviderDown(providerDown.value)
}
</script>

<template>
  <Card>
    <template #title>Who else is here</template>
    <template #content>
      <p class="hint">
        The sessions module beats every 30 s while this tab is visible. Bring someone in: the "Also signed in" banner
        shows at the next beat (or switch tabs and back for one at once). The Sessions page lists them, with the history,
        and Close asks for a reason. Two tabs of yours do not show each other.
      </p>
      <div class="actions">
        <Button v-for="p in people" :key="p" size="small" :outlined="!present[p]" :icon="present[p] ? 'pi pi-sign-out' : 'pi pi-sign-in'"
          :label="present[p] ? `${p} signs out` : `${p} signs in`" @click="toggle(p)" />
        <Button size="small" severity="secondary" outlined :label="providerDown ? 'Provider history back' : 'Provider history down'" @click="toggleProvider" />
        <RouterLink :to="{ name: 'qdadm-sessions' }" class="link"><i class="pi pi-users" /> Sessions page</RouterLink>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.hint {
  margin: 0 0 1rem;
  color: var(--p-text-muted-color);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.link {
  margin-left: 0.5rem;
}
</style>

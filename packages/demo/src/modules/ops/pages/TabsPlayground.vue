<script setup>
/**
 * TabsPlayground — tabs on a page of the app's own (#5398): the current tab
 * in the address (?tab=), a badge per tab, a tab only admins see, panels
 * mounted when first opened.
 */
import { ref } from 'vue'
import { usePageTitle, QdTabs } from '@quazardous/qdadm'

usePageTitle('Tabs')

const notes = ref({ profile: '' })
const groups = ref(['Readers', 'Librarians', 'Night shift'])
const tabs = [
  { key: 'profile', label: 'Profile', icon: 'pi pi-user' },
  { key: 'groups', label: 'Groups', icon: 'pi pi-users', badge: groups.value.length },
  { key: 'alerts', label: 'Alerts', icon: 'pi pi-bell', badge: { count: 2, tone: 'critical' } },
  // Only who manages users sees it
  { key: 'audit', label: 'Audit', icon: 'pi pi-shield', permission: 'entity:users:update' },
]
</script>

<template>
  <div class="tabs-playground">
    <p class="tabs-intro">The tab is in the address: copy it, reload, it stays. A panel is mounted when first opened, then kept: type in a note, switch tabs, it is still there.</p>
    <QdTabs :tabs="tabs">
      <template #profile>
        <label data-panel="profile">Note <input v-model="notes.profile" data-note="profile" /></label>
      </template>
      <template #groups>
        <ul data-panel="groups"><li v-for="g in groups" :key="g">{{ g }}</li></ul>
      </template>
      <template #alerts>
        <p data-panel="alerts">Two loans overdue.</p>
        <label>Note <input data-note="alerts" /></label>
      </template>
      <template #audit><p data-panel="audit">Only who manages users sees this tab.</p></template>
    </QdTabs>
  </div>
</template>

<style scoped>
.tabs-playground { padding: 1rem; }
.tabs-intro { margin: 0 0 1rem; color: var(--p-text-muted-color); }
</style>

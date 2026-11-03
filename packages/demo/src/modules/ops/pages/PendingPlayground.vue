<script setup>
/**
 * PendingPlayground — reads that take their time (#4665).
 */
import { usePageTitle, useAsyncRead, QdPending, QdPendingZone } from '@quazardous/qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

usePageTitle('Pending reads')

const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms))

// Three reads that arrive at different times
const server = useAsyncRead(() => later({ state: 'up', load: 0.42 }, 1200))
const code = useAsyncRead(() => later({ ref: 'v2026.11.3', clean: true }, 2500))
// An empty answer is an answer: "no backup", not a wait
const backups = useAsyncRead(() => later([], 3500))

// The agent's preview fails once, then answers
let previews = 0
const preview = useAsyncRead(() =>
  later(null, 1800).then(() => {
    if (++previews === 1) throw new Error('the agent did not answer (HTTP 502)')
    return { files: 12, removed: 1 }
  })
)

function reloadAll() {
  for (const read of [server, code, backups, preview]) void read.load()
}
</script>

<template>
  <div class="pending-playground">
    <Card>
      <template #title>Badges</template>
      <template #content>
        <p class="hint">
          Each badge waits for its own read with a neutral spinner, never an empty spot or a false state; the deployed
          code takes longer than the server.
        </p>
        <div class="row">
          <span>Server</span>
          <QdPending :read="server" label="Reading the server…" v-slot="{ value }">
            <Tag :value="value.state" severity="success" />
          </QdPending>
          <span>Deployed code</span>
          <QdPending :read="code" label="Reading the deployed code…" v-slot="{ value }">
            <Tag :value="value.ref" :severity="value.clean ? 'success' : 'warn'" />
          </QdPending>
          <span>Preview</span>
          <QdPending :read="preview" v-slot="{ value }">
            <Tag :value="`${value.files} files`" severity="info" />
          </QdPending>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Areas</template>
      <template #content>
        <div class="zones">
          <section>
            <h4>Backups</h4>
            <QdPendingZone :read="backups" :lines="3" v-slot="{ data }">
              <p v-if="!data.length" class="none">No backup yet.</p>
              <ul v-else><li v-for="b in data" :key="b.at">{{ b.at }}</li></ul>
            </QdPendingZone>
          </section>
          <section>
            <h4>The delivery preview</h4>
            <QdPendingZone :read="preview" variant="spinner" label="Reading the preview…" v-slot="{ data }">
              <p class="preview">{{ data.files }} files to send, {{ data.removed }} to remove.</p>
            </QdPendingZone>
          </section>
        </div>
        <div class="row actions">
          <Button size="small" icon="pi pi-send" label="Deliver" :disabled="preview.pending.value" />
          <Button size="small" severity="secondary" outlined icon="pi pi-refresh" label="Reload everything" @click="reloadAll" />
        </div>
        <p class="hint">Deliver waits for the preview (<code>:disabled="preview.pending"</code>); the first preview read fails, Retry reads it again.</p>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.pending-playground {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.hint {
  margin-top: 0;
  color: var(--p-text-muted-color);
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
}
.actions {
  margin-top: 1rem;
}
.zones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}
.zones h4 {
  margin: 0 0 0.5rem;
}
.none,
.preview {
  margin: 0;
}
</style>

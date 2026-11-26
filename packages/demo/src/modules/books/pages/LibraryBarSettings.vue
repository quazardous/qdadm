<script setup>
/**
 * The Library bar, laid out by an admin (#5526): the app's own page, made of
 * qdadm's layout blocks (the dashboards' core): the catalogue of the domain's
 * indicators, their order, their parameters, and a live preview of the bar.
 * The layout is saved here in localStorage; main.js gives it back to the bar
 * through features.domainBar.layout.
 */
import { computed, ref } from 'vue'
import {
  PageLayout,
  QdButton,
  QdDomainBar,
  QdLayoutCatalogue,
  QdLayoutOrder,
  getDomain,
  domainLayoutItems,
  domainBarMax,
  reconcileDomainLayout,
  addInstance,
  setShown,
  reloadDomainBar,
  shownItems,
} from '@quazardous/qdadm'
import { loadLibraryBar, saveLibraryBar } from '../../../edge/libraryBar'

const domain = getDomain('library')
const items = domainLayoutItems(domain)
const max = domainBarMax(domain)
// Without a saved layout: the declared indicators, as the bar shows them
const layout = ref(reconcileDomainLayout(loadLibraryBar() ?? { v: 2, order: items.filter((i) => !i.card.repeatable).map((i) => i.id), hidden: [] }, domain))
const templates = computed(() => items.filter((c) => c.card.repeatable))
const hidden = computed(() => items.filter((c) => !c.card.repeatable && layout.value.hidden.includes(c.id)))
const saved = ref(false)
// The preview is a new bar at each change
const version = ref(0)
function change(next) {
  layout.value = next
  saved.value = false
  version.value++
}
function add(card, value) {
  const { arrangement } = addInstance(layout.value, items, card.id, value.params, { title: value.title === card.card.title ? undefined : value.title })
  change(arrangement)
}
function restore(card) {
  change(setShown(layout.value, items, card.id, true))
}
function save() {
  saveLibraryBar(layout.value)
  reloadDomainBar('library')
  saved.value = true
}
function reset() {
  saveLibraryBar(null)
  reloadDomainBar('library')
  layout.value = reconcileDomainLayout({ v: 2, order: items.filter((i) => !i.card.repeatable).map((i) => i.id), hidden: [] }, domain)
  version.value++
  saved.value = true
}
const count = computed(() => shownItems(layout.value, items, max).length)
</script>

<template>
  <PageLayout title="Library bar">
    <p class="lead">
      Which indicators the Library bar shows, in which order, with which parameters: the same for everyone, chosen
      here. Built from qdadm's layout blocks, on the dashboards' core; the app saves the layout where it wants (here,
      this browser).
    </p>
    <section class="preview" aria-label="Preview">
      <h2>Preview ({{ count }} / {{ max }})</h2>
      <div data-library-bar-preview>
        <QdDomainBar :key="version" :domain="domain" :layout="layout" />
      </div>
    </section>
    <div class="columns">
      <section>
        <h2>Shown, in order</h2>
        <QdLayoutOrder :model-value="layout" :items="items" :max="max" @update:model-value="change" />
      </section>
      <section>
        <h2>Catalogue</h2>
        <QdLayoutCatalogue :templates="templates" :hidden="hidden" id-prefix="library-bar-param" @add="add" @restore="restore" />
      </section>
    </div>
    <div class="actions">
      <QdButton label="Save" icon="pi pi-check" data-library-bar-save @click="save" />
      <QdButton label="Back to the declared bar" severity="secondary" text @click="reset" />
      <span v-if="saved" class="saved">Saved: the bar uses it</span>
    </div>
  </PageLayout>
</template>

<style scoped>
.lead {
  max-width: 60rem;
}
.preview {
  margin: 1rem 0;
}
.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 1.5rem;
}
h2 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
}
.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}
.saved {
  color: var(--qd-tone-good, #15803d);
}
</style>

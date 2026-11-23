<script setup>
/**
 * BookList - Book listing page
 *
 * Uses useListPage with simplified v-bind/v-on pattern
 * Genre filter uses SMART FILTER mode: optionsEntity
 *
 * ZONE EXTENSIBILITY DEMO
 * =======================
 * This page demonstrates cross-module zone extension:
 * - 'books-list-header' zone renders the page header area
 * - Loans module extends this zone to show loan statistics
 *
 * See: modules/loans/components/LoansZoneSetup.vue for extension code
 */

import { useListPage, ListPage, Zone, SeverityTag } from '@quazardous/qdadm'
import Column from 'primevue/column'
import { useFavoriteAction } from '@/composables/useFavoriteAction'
import YearRangeFilter from '../components/YearRangeFilter.vue'

// ============ LIST BUILDER ============
// Row bands (#5437): the classics get a band, above their cells here (#5451;
// the default is below)
const list = useListPage({ entity: 'books', rowBand: (book) => Number(book.year) < 1970, rowBandPosition: 'above' })
const age = (book) => new Date().getFullYear() - Number(book.year)

// ============ FAVORITE ACTION ============
useFavoriteAction(list, { labelField: 'title' })

// ============ SEARCH ============
list.setSearch({
  placeholder: 'Search books...',
  fields: ['title', 'author']
})

// ============ FILTERS ============
// Smart filter: options loaded automatically from 'genres' entity
list.addFilter('genre', {
  placeholder: 'All Genres',
  optionsEntity: 'genres',      // Fetch from genres EntityManager
  optionLabel: 'name',          // Use 'name' field as label
  optionValue: 'id'             // Use 'id' field as value
})

// Cascading filter (#5427): the authors of the genre picked, read again when
// the genre changes; an author outside it is cleared
list.addFilter('author', {
  placeholder: 'All Authors',
  optionsEntity: 'books',
  optionLabel: 'author',
  optionValue: 'author',
  dependsOn: ['genre'],
})

// Several values, grouped and badged (#5467): the decades, under their
// century, each with a short tag; none chosen is off
const decades = [1900, 1920, 1950, 1960, 1980, 1990, 2010]
list.addFilter('decade', {
  multiple: true,
  placeholder: 'Decades',
  options: decades.map((d) => ({
    label: `The ${d}s`,
    value: d,
    group: d < 2000 ? '20th century' : '21st century',
    badge: { label: `'${String(d).slice(2, 4)}`, tone: d < 1970 ? 'watch' : 'info' },
  })),
  local_filter: (book, chosen) => chosen.includes(Math.floor(Number(book.year) / 10) * 10),
})

// A filter of the app's own (#5467): a component under the filter contract
list.addFilter('years', {
  component: YearRangeFilter,
  placeholder: 'Years',
  local_filter: (book, [from, to]) => (from == null || Number(book.year) >= from) && (to == null || Number(book.year) <= to),
})


// ============ HEADER ACTIONS ============
list.addCreateAction('Add Book')
list.addBulkDeleteAction()

// ============ ROW ACTIONS ============
list.addEditAction()
list.addDeleteAction({ labelField: 'title' })

</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <!-- Zone-based extensible header area -->
    <template #beforeTable>
      <Zone name="books-list-header" class="mb-3" />
    </template>

    <template #columns>
      <Column v-bind="list.column('title')" sortable />
      <Column v-bind="list.column('author')" sortable />
      <Column v-bind="list.column('year')" sortable style="width: 100px" />
      <Column v-bind="list.column('genre', { header: 'Genre' })" style="width: 120px">
        <template #body="{ data }">
          <SeverityTag field="genre" :value="data.genre" />
        </template>
      </Column>
    </template>

    <!-- A band above the classics' cells, the row and it one object (#5437, #5451) -->
    <template #row-band="{ data }">
      <span class="book-band" style="color: var(--p-text-muted-color); font-size: 0.875rem"><i class="pi pi-star" aria-hidden="true"></i> Classic, {{ age(data) }} years old: {{ data.author }}, {{ data.year }}</span>
    </template>
  </ListPage>
</template>

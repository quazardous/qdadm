<script setup lang="ts">
/**
 * ParentCard - normalized parent detail embedded at the top of a child ListPage
 *
 * The "B2" hybrid composition (see docs/page-compositions.md): a child list is
 * the host page, and the parent record is shown as a read-only cartouche above
 * the table. `useListPage` already resolves and exposes the parent on a child
 * route (`parentData` / `parentLoading`) — this component just renders it, with
 * the SAME field resolver as `ShowPage` so the look matches real detail pages.
 * No extra fetch.
 *
 * Fields are auto-derived from the parent entity's manager. Pass `fields` to
 * restrict/order them, or use the default slot to render the parent yourself.
 *
 * Usage (inside a child ListPage):
 *   <template #beforeTable>
 *     <ParentCard
 *       :entity="'books'"
 *       :data="list.parentData.value"
 *       :loading="list.parentLoading.value"
 *       :fields="['title', 'author']"
 *     />
 *   </template>
 */
import { computed, type PropType } from 'vue'
import { useOrchestrator } from '../../orchestrator/useOrchestrator'
import { useFieldManager } from '../../composables/useFieldManager'
import {
  createShowFieldResolver,
  type ShowResolvedFieldConfig,
} from '../../composables/createShowFieldResolver'
import ShowField from './ShowField.vue'

const props = defineProps({
  /** Parent entity name (route-stable). */
  entity: { type: String, required: true },
  /** Parent record (e.g. `list.parentData.value`). */
  data: { type: Object as PropType<Record<string, unknown> | null>, default: null },
  /** Parent loading state (e.g. `list.parentLoading.value`). */
  loading: { type: Boolean, default: false },
  /** Restrict/order the displayed fields. Omit to show all manager fields. */
  fields: { type: Array as PropType<string[] | null>, default: null },
  /** Exclude these fields (applied when `fields` is not set). */
  exclude: { type: Array as PropType<string[]>, default: () => [] },
  /** Render fields horizontally (label beside value). Default true. */
  horizontal: { type: Boolean, default: true },
  /** Optional heading above the fields. */
  title: { type: String, default: '' },
})

const { orchestrator, getManager } = useOrchestrator()
const manager = getManager(props.entity)

// Same resolver as ShowPage → identical rendering (types, references, severity).
const fieldManager = useFieldManager<ShowResolvedFieldConfig>({
  resolveFieldConfig: createShowFieldResolver(manager, orchestrator),
  getSchemaFieldConfig: (name) => manager.getFieldConfig?.(name) || null,
  entity: props.entity,
})

fieldManager.generateFields(manager.getFormFields?.() || [], {
  only: props.fields ?? null,
  exclude: props.fields ? [] : props.exclude,
})
// Honor the caller's field order when an explicit list is given.
if (props.fields) fieldManager.setFieldOrder(props.fields)

const resolvedFields = fieldManager.fields
const hasData = computed(() => props.data !== null && props.data !== undefined)
</script>

<template>
  <div class="parent-card">
    <div v-if="loading" class="parent-card__loading">
      <i class="pi pi-spin pi-spinner" />
    </div>

    <template v-else-if="hasData">
      <div v-if="title" class="parent-card__title">{{ title }}</div>
      <!-- Escape hatch: render the parent yourself with the resolved fields. -->
      <slot :fields="resolvedFields" :data="data">
        <div class="parent-card__fields">
          <ShowField
            v-for="f in resolvedFields"
            :key="f.name"
            :field="f"
            :value="(data?.[f.name] ?? null) as any"
            :horizontal="horizontal"
          />
        </div>
      </slot>
    </template>
  </div>
</template>

<style scoped>
.parent-card {
  margin-bottom: 1rem;
}
.parent-card__loading {
  padding: 0.5rem 0;
}
.parent-card__title {
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.parent-card__fields {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>

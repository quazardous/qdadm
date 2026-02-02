<script setup lang="ts">
/**
 * ShowGroups - Renders field groups with configurable layouts
 *
 * Supports multiple layout modes:
 * - flat: Simple sections with headers
 * - sections: Fieldset-style sections
 * - cards: Each group in a card
 * - tabs: TabView for top-level groups
 * - accordion: Collapsible panels
 *
 * ```vue
 * <ShowGroups
 *   :groups="show.groups.value"
 *   :data="show.data.value"
 *   layout="tabs"
 * />
 * ```
 */
import { computed, type PropType } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Fieldset from 'primevue/fieldset'
import Card from 'primevue/card'
import ShowField from './ShowField.vue'

/**
 * Resolved field config
 */
interface ResolvedFieldConfig {
  name: string
  type: string
  label: string
  [key: string]: unknown
}

/**
 * Field group
 */
interface FieldGroup {
  name: string
  label: string
  fields: ResolvedFieldConfig[]
  children: FieldGroup[]
  parent?: string
}

type LayoutMode = 'flat' | 'sections' | 'cards' | 'tabs' | 'accordion'

const props = defineProps({
  groups: {
    type: Array as PropType<FieldGroup[]>,
    required: true,
  },
  data: {
    type: Object as PropType<Record<string, unknown> | null>,
    default: null,
  },
  layout: {
    type: String as PropType<LayoutMode>,
    default: 'flat',
  },
  // Field display options
  horizontal: {
    type: Boolean,
    default: true,
  },
  labelWidth: {
    type: String,
    default: '140px',
  },
  // Nested layout (for children groups)
  childLayout: {
    type: String as PropType<LayoutMode>,
    default: 'sections',
  },
})

// Filter out default group for labeling purposes
const displayGroups = computed(() => {
  return props.groups.filter((g) => g.name !== '_default' || g.fields.length > 0)
})

// Value type compatible with ShowField
type FieldValue = string | number | boolean | Date | Record<string, unknown> | unknown[] | undefined

// Get value from data
function getValue(fieldName: string): FieldValue {
  return props.data?.[fieldName] as FieldValue
}
</script>

<template>
  <div class="show-groups" :class="`show-groups--${layout}`">
    <!-- Flat layout: simple sections with optional headers -->
    <template v-if="layout === 'flat'">
      <div v-for="group in displayGroups" :key="group.name" class="show-group">
        <h3 v-if="group.label && group.name !== '_default'" class="show-group-header">
          {{ group.label }}
        </h3>
        <div class="show-group-fields">
          <ShowField
            v-for="field in group.fields"
            :key="field.name"
            :field="field"
            :value="getValue(field.name)"
            :horizontal="horizontal"
            :label-width="labelWidth"
          />
        </div>
        <!-- Recursive children -->
        <ShowGroups
          v-if="group.children.length > 0"
          :groups="group.children"
          :data="data"
          :layout="childLayout"
          :horizontal="horizontal"
          :label-width="labelWidth"
        />
      </div>
    </template>

    <!-- Sections layout: Fieldset style -->
    <template v-else-if="layout === 'sections'">
      <Fieldset
        v-for="group in displayGroups"
        :key="group.name"
        :legend="group.label || undefined"
        :toggleable="false"
      >
        <div class="show-group-fields">
          <ShowField
            v-for="field in group.fields"
            :key="field.name"
            :field="field"
            :value="getValue(field.name)"
            :horizontal="horizontal"
            :label-width="labelWidth"
          />
        </div>
        <!-- Recursive children -->
        <ShowGroups
          v-if="group.children.length > 0"
          :groups="group.children"
          :data="data"
          :layout="childLayout"
          :horizontal="horizontal"
          :label-width="labelWidth"
        />
      </Fieldset>
    </template>

    <!-- Cards layout -->
    <template v-else-if="layout === 'cards'">
      <Card v-for="group in displayGroups" :key="group.name">
        <template #title>{{ group.label }}</template>
        <template #content>
          <div class="show-group-fields">
            <ShowField
              v-for="field in group.fields"
              :key="field.name"
              :field="field"
              :value="getValue(field.name)"
              :horizontal="horizontal"
              :label-width="labelWidth"
            />
          </div>
          <!-- Recursive children -->
          <ShowGroups
            v-if="group.children.length > 0"
            :groups="group.children"
            :data="data"
            :layout="childLayout"
            :horizontal="horizontal"
            :label-width="labelWidth"
          />
        </template>
      </Card>
    </template>

    <!-- Tabs layout -->
    <template v-else-if="layout === 'tabs'">
      <Tabs :value="displayGroups[0]?.name || '0'">
        <TabList>
          <Tab v-for="group in displayGroups" :key="group.name" :value="group.name">
            {{ group.label }}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel v-for="group in displayGroups" :key="group.name" :value="group.name">
            <div class="show-group-fields">
              <ShowField
                v-for="field in group.fields"
                :key="field.name"
                :field="field"
                :value="getValue(field.name)"
                :horizontal="horizontal"
                :label-width="labelWidth"
              />
            </div>
            <!-- Recursive children -->
            <ShowGroups
              v-if="group.children.length > 0"
              :groups="group.children"
              :data="data"
              :layout="childLayout"
              :horizontal="horizontal"
              :label-width="labelWidth"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>

    <!-- Accordion layout -->
    <template v-else-if="layout === 'accordion'">
      <Accordion :value="[displayGroups[0]?.name || '0']" multiple>
        <AccordionPanel v-for="group in displayGroups" :key="group.name" :value="group.name">
          <AccordionHeader>{{ group.label }}</AccordionHeader>
          <AccordionContent>
            <div class="show-group-fields">
              <ShowField
                v-for="field in group.fields"
                :key="field.name"
                :field="field"
                :value="getValue(field.name)"
                :horizontal="horizontal"
                :label-width="labelWidth"
              />
            </div>
            <!-- Recursive children -->
            <ShowGroups
              v-if="group.children.length > 0"
              :groups="group.children"
              :data="data"
              :layout="childLayout"
              :horizontal="horizontal"
              :label-width="labelWidth"
            />
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </template>
  </div>
</template>

<style scoped>
.show-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.show-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.show-group-header {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-surface-200, #e2e8f0);
  color: var(--p-text-color);
}

.show-group-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Cards layout spacing */
.show-groups--cards {
  gap: 1rem;
}

/* Tabs and accordion panels padding */
.show-groups--tabs :deep(.p-tabpanel),
.show-groups--accordion :deep(.p-accordioncontent-content) {
  padding-top: 1rem;
}
</style>

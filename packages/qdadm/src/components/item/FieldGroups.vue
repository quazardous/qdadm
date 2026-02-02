<script setup lang="ts">
/**
 * FieldGroups - Generic field group renderer with configurable layouts
 *
 * Shared component for both edit (form) and show pages.
 * Uses slots for field rendering to support different field components.
 *
 * Supports multiple layout modes:
 * - flat: Simple sections with headers
 * - sections: Fieldset-style sections
 * - cards: Each group in a card
 * - tabs: TabView for top-level groups
 * - accordion: Collapsible panels
 *
 * ```vue
 * <FieldGroups :groups="groups" :data="data" layout="tabs">
 *   <template #field="{ field, value }">
 *     <FormField :field="field" v-model="data[field.name]" />
 *   </template>
 * </FieldGroups>
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
import Tag from 'primevue/tag'

type BadgeSeverity = 'secondary' | 'info' | 'success' | 'warn' | 'danger' | 'contrast'

/**
 * Base field config interface
 */
interface BaseFieldConfig {
  name: string
  type: string
  label: string
  [key: string]: unknown
}

/**
 * Field group structure
 */
interface FieldGroup<T extends BaseFieldConfig = BaseFieldConfig> {
  name: string
  label: string
  fields: T[]
  children: FieldGroup<T>[]
  parent?: string
  // Tab/accordion options
  icon?: string
  badge?: string | number
  badgeSeverity?: BadgeSeverity
  count?: number
  visible?: boolean
  disabled?: boolean
}

export type LayoutMode = 'flat' | 'sections' | 'cards' | 'tabs' | 'accordion'

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
  // Nested layout (for children groups)
  childLayout: {
    type: String as PropType<LayoutMode>,
    default: 'sections',
  },
})

// Expose slots for field rendering
defineSlots<{
  field: (props: { field: BaseFieldConfig; value: unknown; groupName: string }) => unknown
  // Optional: custom group header
  'group-header'?: (props: { group: FieldGroup; layout: LayoutMode }) => unknown
  // Optional: custom group content wrapper
  'group-content'?: (props: { group: FieldGroup; layout: LayoutMode }) => unknown
}>()

// Filter out default group for labeling purposes and hidden groups
const displayGroups = computed(() => {
  return props.groups.filter((g) => {
    // Filter by visibility (default to true)
    if (g.visible === false) return false
    // Filter out empty default groups
    return g.name !== '_default' || g.fields.length > 0
  })
})

// Get value from data
function getValue(fieldName: string): unknown {
  return props.data?.[fieldName]
}

// Normalize icon class
function getIconClass(icon: string | undefined): string | null {
  if (!icon) return null
  // Already has 'pi' prefix
  if (icon.startsWith('pi')) {
    return icon.includes(' ') ? icon : `pi ${icon}`
  }
  // Just icon name
  return `pi pi-${icon}`
}

// Get badge value to display
function getBadgeValue(group: FieldGroup): string | number | null {
  if (group.badge !== undefined && group.badge !== null) return group.badge
  if (group.count !== undefined && group.count !== null && group.count > 0) return group.count
  return null
}
</script>

<template>
  <div class="field-groups" :class="`field-groups--${layout}`">
    <!-- Flat layout: simple sections with optional headers -->
    <template v-if="layout === 'flat'">
      <div v-for="group in displayGroups" :key="group.name" class="field-group">
        <slot name="group-header" :group="group" :layout="layout">
          <h3 v-if="group.label && group.name !== '_default'" class="field-group-header">
            {{ group.label }}
          </h3>
        </slot>
        <div class="field-group-fields">
          <template v-for="field in group.fields" :key="field.name">
            <slot
              name="field"
              :field="field"
              :value="getValue(field.name)"
              :group-name="group.name"
            />
          </template>
        </div>
        <!-- Recursive children -->
        <FieldGroups
          v-if="group.children.length > 0"
          :groups="group.children"
          :data="data"
          :layout="childLayout"
        >
          <template #field="slotProps">
            <slot name="field" v-bind="slotProps" />
          </template>
        </FieldGroups>
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
        <div class="field-group-fields">
          <template v-for="field in group.fields" :key="field.name">
            <slot
              name="field"
              :field="field"
              :value="getValue(field.name)"
              :group-name="group.name"
            />
          </template>
        </div>
        <!-- Recursive children -->
        <FieldGroups
          v-if="group.children.length > 0"
          :groups="group.children"
          :data="data"
          :layout="childLayout"
        >
          <template #field="slotProps">
            <slot name="field" v-bind="slotProps" />
          </template>
        </FieldGroups>
      </Fieldset>
    </template>

    <!-- Cards layout -->
    <template v-else-if="layout === 'cards'">
      <Card v-for="group in displayGroups" :key="group.name">
        <template #title>{{ group.label }}</template>
        <template #content>
          <div class="field-group-fields">
            <template v-for="field in group.fields" :key="field.name">
              <slot
                name="field"
                :field="field"
                :value="getValue(field.name)"
                :group-name="group.name"
              />
            </template>
          </div>
          <!-- Recursive children -->
          <FieldGroups
            v-if="group.children.length > 0"
            :groups="group.children"
            :data="data"
            :layout="childLayout"
          >
            <template #field="slotProps">
              <slot name="field" v-bind="slotProps" />
            </template>
          </FieldGroups>
        </template>
      </Card>
    </template>

    <!-- Tabs layout -->
    <template v-else-if="layout === 'tabs'">
      <Tabs :value="displayGroups[0]?.name || '0'">
        <TabList>
          <Tab
            v-for="group in displayGroups"
            :key="group.name"
            :value="group.name"
            :disabled="group.disabled"
          >
            <i v-if="group.icon" :class="getIconClass(group.icon)" class="tab-icon" />
            <span class="tab-label">{{ group.label }}</span>
            <Tag
              v-if="getBadgeValue(group) !== null"
              :value="String(getBadgeValue(group))"
              :severity="group.badgeSeverity || 'secondary'"
              class="tab-badge"
            />
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel v-for="group in displayGroups" :key="group.name" :value="group.name">
            <div class="field-group-fields">
              <template v-for="field in group.fields" :key="field.name">
                <slot
                  name="field"
                  :field="field"
                  :value="getValue(field.name)"
                  :group-name="group.name"
                />
              </template>
            </div>
            <!-- Recursive children -->
            <FieldGroups
              v-if="group.children.length > 0"
              :groups="group.children"
              :data="data"
              :layout="childLayout"
            >
              <template #field="slotProps">
                <slot name="field" v-bind="slotProps" />
              </template>
            </FieldGroups>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>

    <!-- Accordion layout -->
    <template v-else-if="layout === 'accordion'">
      <Accordion :value="[displayGroups[0]?.name || '0']" multiple>
        <AccordionPanel
          v-for="group in displayGroups"
          :key="group.name"
          :value="group.name"
          :disabled="group.disabled"
        >
          <AccordionHeader>
            <i v-if="group.icon" :class="getIconClass(group.icon)" class="accordion-icon" />
            <span class="accordion-label">{{ group.label }}</span>
            <Tag
              v-if="getBadgeValue(group) !== null"
              :value="String(getBadgeValue(group))"
              :severity="group.badgeSeverity || 'secondary'"
              class="accordion-badge"
            />
          </AccordionHeader>
          <AccordionContent>
            <div class="field-group-fields">
              <template v-for="field in group.fields" :key="field.name">
                <slot
                  name="field"
                  :field="field"
                  :value="getValue(field.name)"
                  :group-name="group.name"
                />
              </template>
            </div>
            <!-- Recursive children -->
            <FieldGroups
              v-if="group.children.length > 0"
              :groups="group.children"
              :data="data"
              :layout="childLayout"
            >
              <template #field="slotProps">
                <slot name="field" v-bind="slotProps" />
              </template>
            </FieldGroups>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </template>
  </div>
</template>

<style scoped>
.field-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-group-header {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-surface-200, #e2e8f0);
  color: var(--p-text-color);
}

.field-group-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Cards layout spacing */
.field-groups--cards {
  gap: 1rem;
}

/* Tabs and accordion panels padding */
.field-groups--tabs :deep(.p-tabpanel),
.field-groups--accordion :deep(.p-accordioncontent-content) {
  padding-top: 1rem;
}

/* Tab icon and badge styling */
.tab-icon {
  margin-right: 0.5rem;
}

.tab-badge {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  min-width: 1.25rem;
  text-align: center;
}

/* Accordion icon and badge styling */
.accordion-icon {
  margin-right: 0.5rem;
}

.accordion-badge {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  min-width: 1.25rem;
  text-align: center;
}
</style>

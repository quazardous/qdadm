<script setup lang="ts">
/**
 * ShowDisplay - Auto-renders the appropriate display widget based on field config
 *
 * Takes a field config object and renders the matching display component.
 * Supports hint override but field.type takes precedence if specified.
 *
 * Usage:
 * <ShowDisplay :field="f" :value="data[f.name]" />
 *
 * Display types:
 * - text: simple text
 * - number: formatted number
 * - boolean: Yes/No or icon
 * - date: formatted date
 * - datetime: formatted datetime
 * - select: label from options
 * - email: mailto link
 * - password: masked
 * - textarea: multi-line text
 * - reference: link to entity (requires referenceRoute)
 * - image: image preview
 * - url: clickable link
 * - json: formatted JSON
 * - currency: formatted currency
 * - badge: styled tag
 */
import { computed, type PropType } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import Tag from 'primevue/tag'

type DisplayType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'reference'
  | 'image'
  | 'url'
  | 'json'
  | 'currency'
  | 'badge'

type DisplayValue = string | number | boolean | Date | null | undefined | unknown

interface SelectOption {
  label?: string
  value?: string | number
  [key: string]: unknown
}

interface FieldConfig {
  name: string
  type?: DisplayType
  // Display options
  dateFormat?: string
  currencyCode?: string
  locale?: string
  booleanLabels?: { true: string; false: string }
  // Reference options
  reference?: string
  referenceRoute?: string | ((value: unknown) => { name: string; params: Record<string, unknown> })
  referenceLabel?: string | ((value: unknown, option?: unknown) => string)
  // Select options (for label lookup)
  options?: SelectOption[]
  optionLabel?: string
  optionValue?: string
  // Badge options
  severity?: string | { severity: string; icon?: string; label?: string } | ((value: unknown) => string | { severity: string; icon?: string; label?: string })
  // Image options
  imageWidth?: string
  imageHeight?: string
  // Custom render
  render?: (value: unknown) => string
}

const props = defineProps({
  field: { type: Object as PropType<FieldConfig>, required: true },
  value: { type: [String, Number, Boolean, Date, Object, Array] as PropType<DisplayValue>, default: null },
  hint: { type: String as PropType<DisplayType | null>, default: null }
})

// Resolve display type: field.type > hint > 'text'
const displayType = computed<DisplayType>(() => (props.field?.type as DisplayType) || props.hint || 'text')

// Check if value is empty (render() overrides: the function handles its own empty state)
const isEmpty = computed(() => {
  if (props.field.render) return false
  return props.value === null || props.value === undefined || props.value === ''
})

// Format text value
const textValue = computed(() => {
  if (isEmpty.value) return '-'
  if (props.field.render) return props.field.render(props.value)
  return String(props.value)
})

// Format number value
const numberValue = computed(() => {
  if (isEmpty.value) return '-'
  const num = Number(props.value)
  if (isNaN(num)) return String(props.value)
  const locale = props.field.locale || 'en-US'
  return new Intl.NumberFormat(locale).format(num)
})

// Format currency value
const currencyValue = computed(() => {
  if (isEmpty.value) return '-'
  const num = Number(props.value)
  if (isNaN(num)) return String(props.value)
  const locale = props.field.locale || 'en-US'
  const currency = props.field.currencyCode || 'USD'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(num)
})

// Format boolean value
const booleanValue = computed(() => {
  if (isEmpty.value) return '-'
  const labels = props.field.booleanLabels || { true: 'Yes', false: 'No' }
  return props.value ? labels.true : labels.false
})

const booleanIcon = computed(() => {
  if (isEmpty.value) return 'pi-minus'
  return props.value ? 'pi-check' : 'pi-times'
})

const booleanIconClass = computed(() => {
  if (isEmpty.value) return 'text-muted'
  return props.value ? 'text-success' : 'text-danger'
})

// Format date value
const dateValue = computed(() => {
  if (isEmpty.value) return '-'
  const v = props.value as unknown
  const date = (typeof v === 'object' && v instanceof Date) ? v : new Date(String(v))
  if (isNaN(date.getTime())) return String(props.value)
  const locale = props.field.locale || 'en-US'
  const format = props.field.dateFormat || 'short'
  return new Intl.DateTimeFormat(locale, { dateStyle: format as 'short' | 'medium' | 'long' | 'full' }).format(date)
})

// Format datetime value
const datetimeValue = computed(() => {
  if (isEmpty.value) return '-'
  const v = props.value as unknown
  const date = (typeof v === 'object' && v instanceof Date) ? v : new Date(String(v))
  if (isNaN(date.getTime())) return String(props.value)
  const locale = props.field.locale || 'en-US'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
})

// Format select value (lookup label from options)
const selectValue = computed(() => {
  if (isEmpty.value) return '-'
  const options = props.field.options || []
  const optionValue = props.field.optionValue || 'value'
  const optionLabel = props.field.optionLabel || 'label'

  const option = options.find((opt) => opt[optionValue] === props.value)
  if (option) {
    return option[optionLabel] as string
  }
  return String(props.value)
})

// Reference route
const referenceRoute = computed<RouteLocationRaw | null>(() => {
  if (!props.field.referenceRoute || isEmpty.value) return null
  if (typeof props.field.referenceRoute === 'function') {
    return props.field.referenceRoute(props.value) as RouteLocationRaw
  }
  return { name: props.field.referenceRoute, params: { id: String(props.value) } }
})

// Reference label
const referenceLabel = computed(() => {
  if (isEmpty.value) return '-'
  if (typeof props.field.referenceLabel === 'function') {
    return props.field.referenceLabel(props.value)
  }
  if (props.field.referenceLabel) {
    return props.field.referenceLabel
  }
  return String(props.value)
})

// Badge value (supports render())
const badgeValue = computed(() => {
  if (props.field.render) return props.field.render(props.value)
  if (props.value === null || props.value === undefined) return ''
  return String(props.value)
})

// Badge descriptor (normalized to { severity, icon? })
const badgeDescriptor = computed(() => {
  const raw = typeof props.field.severity === 'function'
    ? props.field.severity(props.value)
    : props.field.severity
  if (!raw) return { severity: 'info' }
  return typeof raw === 'string' ? { severity: raw } : raw
})

const badgeSeverity = computed(() => badgeDescriptor.value.severity)
const badgeIcon = computed(() => badgeDescriptor.value.icon)

// JSON formatted
const jsonValue = computed(() => {
  if (isEmpty.value) return '-'
  try {
    return JSON.stringify(props.value, null, 2)
  } catch {
    return String(props.value)
  }
})

// Image dimensions
const imageStyle = computed(() => ({
  maxWidth: props.field.imageWidth || '200px',
  maxHeight: props.field.imageHeight || '150px'
}))
</script>

<template>
  <!-- Empty value -->
  <span v-if="isEmpty" class="show-display show-display--empty">-</span>

  <!-- Text -->
  <span v-else-if="displayType === 'text'" class="show-display show-display--text">
    {{ textValue }}
  </span>

  <!-- Email -->
  <a
    v-else-if="displayType === 'email'"
    :href="`mailto:${value}`"
    class="show-display show-display--email"
  >
    {{ value }}
  </a>

  <!-- Password (masked) -->
  <span v-else-if="displayType === 'password'" class="show-display show-display--password">
    ••••••••
  </span>

  <!-- Number -->
  <span v-else-if="displayType === 'number'" class="show-display show-display--number">
    {{ numberValue }}
  </span>

  <!-- Currency -->
  <span v-else-if="displayType === 'currency'" class="show-display show-display--currency">
    {{ currencyValue }}
  </span>

  <!-- Boolean (icon) -->
  <span v-else-if="displayType === 'boolean'" class="show-display show-display--boolean" :class="booleanIconClass">
    <i :class="['pi', booleanIcon]"></i>
    <span class="boolean-label">{{ booleanValue }}</span>
  </span>

  <!-- Date -->
  <span v-else-if="displayType === 'date'" class="show-display show-display--date">
    {{ dateValue }}
  </span>

  <!-- Datetime -->
  <span v-else-if="displayType === 'datetime'" class="show-display show-display--datetime">
    {{ datetimeValue }}
  </span>

  <!-- Select (label lookup) -->
  <span v-else-if="displayType === 'select'" class="show-display show-display--select">
    {{ selectValue }}
  </span>

  <!-- Textarea (multi-line) -->
  <div v-else-if="displayType === 'textarea'" class="show-display show-display--textarea">
    {{ textValue }}
  </div>

  <!-- Reference (link) -->
  <RouterLink
    v-else-if="displayType === 'reference' && referenceRoute"
    :to="referenceRoute"
    class="show-display show-display--reference"
  >
    {{ referenceLabel }}
  </RouterLink>
  <span v-else-if="displayType === 'reference'" class="show-display show-display--reference">
    {{ referenceLabel }}
  </span>

  <!-- URL -->
  <a
    v-else-if="displayType === 'url'"
    :href="String(value)"
    target="_blank"
    rel="noopener noreferrer"
    class="show-display show-display--url"
  >
    {{ value }}
    <i class="pi pi-external-link" style="font-size: 0.75em; margin-left: 0.25em"></i>
  </a>

  <!-- Image -->
  <div v-else-if="displayType === 'image'" class="show-display show-display--image">
    <img :src="String(value)" :alt="field.name" :style="imageStyle" />
  </div>

  <!-- JSON -->
  <pre v-else-if="displayType === 'json'" class="show-display show-display--json">{{ jsonValue }}</pre>

  <!-- Badge (with optional icon) -->
  <span
    v-else-if="displayType === 'badge' && badgeIcon"
    class="show-display show-display--badge p-tag p-component"
    :class="`p-tag-${badgeSeverity}`"
  >
    <i :class="badgeIcon" />
    <span class="p-tag-label">{{ badgeValue }}</span>
  </span>
  <Tag
    v-else-if="displayType === 'badge'"
    :value="badgeValue"
    :severity="badgeSeverity"
    class="show-display show-display--badge"
  />

  <!-- Fallback to text -->
  <span v-else class="show-display show-display--text">
    {{ textValue }}
  </span>
</template>

<style scoped>
.show-display {
  display: inline;
}

.show-display--badge {
  display: inline-flex;
  align-items: center;
}

.show-display--empty {
  color: var(--p-text-muted-color, #6c757d);
}

.show-display--email,
.show-display--url,
.show-display--reference {
  color: var(--p-primary-color, #3b82f6);
  text-decoration: none;
}

.show-display--email:hover,
.show-display--url:hover,
.show-display--reference:hover {
  text-decoration: underline;
}

.show-display--password {
  font-family: monospace;
  letter-spacing: 0.1em;
}

.show-display--number,
.show-display--currency {
  font-variant-numeric: tabular-nums;
}

.show-display--boolean {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.show-display--boolean.text-success {
  color: var(--p-green-500, #22c55e);
}

.show-display--boolean.text-danger {
  color: var(--p-red-500, #ef4444);
}

.show-display--boolean.text-muted {
  color: var(--p-text-muted-color, #6c757d);
}

.show-display--textarea {
  white-space: pre-wrap;
  line-height: 1.6;
}

.show-display--image img {
  border-radius: 4px;
  object-fit: cover;
}

.show-display--json {
  background: var(--p-surface-100, #f1f5f9);
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  overflow-x: auto;
  margin: 0;
}
</style>

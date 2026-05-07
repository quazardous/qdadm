<script setup>
/**
 * SettingsEditPage - Entity form for settings
 *
 * Uses standard qdadm form pattern (useEntityItemFormPage + FormPage).
 * JSON type fields:
 * - 'json'            → VanillaJsonEditor (raw, tree mode)
 * - 'json-structured' → JsonStructuredField (form/JSON toggle with invalid-JSON guard)
 */
import { ref, computed } from 'vue'
import { useEntityItemFormPage, FormPage, FormField } from '@quazardous/qdadm'
import { VanillaJsonEditor, JsonStructuredField } from '@quazardous/qdadm/editors'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import Button from 'primevue/button'

const form = useEntityItemFormPage({ entity: 'settings' })

form.generateFields()
form.addSaveAction({ andClose: true })

if (form.isEdit.value) {
  form.addDeleteAction()
}

const typeOptions = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'JSON', value: 'json' },
  { label: 'JSON (structured)', value: 'json-structured' }
]

/**
 * Parse JSON value for the editor.
 * Settings store JSON as a string in the value field.
 */
function getJsonValue(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function onJsonUpdate(val) {
  // Store back as JSON string
  form.data.value.value = JSON.stringify(val)
}

/* JsonStructuredField demo wiring */
const jsonInvalid = ref(false)

/** Parsed object for the structured slot (flat key/value demo editor) */
const parsedStructured = computed(() => getJsonValue(form.data.value.value))

/** Update a single key in the structured view, persist as JSON string */
function updateStructuredKey(key, newVal) {
  const current = parsedStructured.value
  // Coerce based on the original value type to keep round-trip stable
  const original = current[key]
  let coerced = newVal
  if (typeof original === 'number') coerced = newVal === '' ? 0 : Number(newVal)
  else if (typeof original === 'boolean') coerced = newVal === 'true' || newVal === true
  onJsonUpdate({ ...current, [key]: coerced })
}

/** Remove a key from the structured object */
function removeStructuredKey(key) {
  // eslint-disable-next-line no-unused-vars
  const { [key]: _removed, ...rest } = parsedStructured.value
  onJsonUpdate(rest)
}

/* Add-field row state */
const addTypeOptions = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Object', value: 'object' },
  { label: 'Array', value: 'array' }
]
const newFieldKey = ref('')
const newFieldType = ref('string')
const newStringVal = ref('')
const newNumberVal = ref(0)
const newBoolVal = ref(false)
const addError = ref('')

function resetAddRow() {
  newFieldKey.value = ''
  newFieldType.value = 'string'
  newStringVal.value = ''
  newNumberVal.value = 0
  newBoolVal.value = false
  addError.value = ''
}

function addStructuredField() {
  const key = newFieldKey.value.trim()
  if (!key) { addError.value = 'Key required'; return }
  if (key in parsedStructured.value) { addError.value = `Key "${key}" already exists`; return }

  let value
  switch (newFieldType.value) {
    case 'number':  value = newNumberVal.value ?? 0; break
    case 'boolean': value = newBoolVal.value; break
    case 'object':  value = {}; break
    case 'array':   value = []; break
    default:        value = newStringVal.value
  }
  onJsonUpdate({ ...parsedStructured.value, [key]: value })
  resetAddRow()
}

/** Preview for non-editable complex values (objects/arrays) */
function shortPreview(val) {
  if (Array.isArray(val)) return `[${val.length} items]`
  if (val && typeof val === 'object') return `{${Object.keys(val).length} keys}`
  return String(val)
}
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="form-grid">
        <FormField v-for="f in form.fields.value" :key="f.name" :name="f.name" :label="f.label">

          <!-- JSON type: VanillaJsonEditor tree (raw) -->
          <template v-if="f.name === 'value' && form.data.value.type === 'json'">
            <VanillaJsonEditor
              :modelValue="getJsonValue(form.data.value.value)"
              mode="tree"
              height="400px"
              @update:modelValue="onJsonUpdate"
            />
          </template>

          <!-- JSON (structured) type: toggle form/JSON with invalid-JSON guard -->
          <template v-else-if="f.name === 'value' && form.data.value.type === 'json-structured'">
            <JsonStructuredField
              :modelValue="parsedStructured"
              jsonMode="text"
              jsonHeight="300px"
              @update:modelValue="onJsonUpdate"
              @json-error="jsonInvalid = $event"
            >
              <div class="kv-editor">
                <div v-for="(val, key) in parsedStructured" :key="key" class="kv-row">
                  <label class="kv-key">{{ key }}</label>
                  <!-- Number -->
                  <InputNumber
                    v-if="typeof val === 'number'"
                    :modelValue="val"
                    class="w-full"
                    @update:modelValue="updateStructuredKey(key, $event)"
                  />
                  <!-- Boolean -->
                  <ToggleSwitch
                    v-else-if="typeof val === 'boolean'"
                    :modelValue="val"
                    @update:modelValue="updateStructuredKey(key, $event)"
                  />
                  <!-- Object / Array: read-only preview (edit in JSON view) -->
                  <span v-else-if="val && typeof val === 'object'" class="kv-complex">
                    {{ shortPreview(val) }} <small>— switch to JSON to edit</small>
                  </span>
                  <!-- String (default) -->
                  <InputText
                    v-else
                    :modelValue="String(val ?? '')"
                    class="w-full"
                    @update:modelValue="updateStructuredKey(key, $event)"
                  />
                  <Button
                    icon="pi pi-times"
                    severity="danger"
                    text
                    rounded
                    size="small"
                    aria-label="Remove field"
                    @click="removeStructuredKey(key)"
                  />
                </div>
                <div v-if="Object.keys(parsedStructured).length === 0" class="kv-empty">
                  Object is empty — add a field below or switch to JSON.
                </div>

                <!-- Add new field -->
                <div class="kv-add-row">
                  <InputText
                    v-model="newFieldKey"
                    placeholder="key name"
                    class="kv-add-key"
                    @keyup.enter="addStructuredField"
                  />
                  <Select
                    v-model="newFieldType"
                    :options="addTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="kv-add-type"
                  />
                  <InputText
                    v-if="newFieldType === 'string'"
                    v-model="newStringVal"
                    placeholder="value"
                    class="kv-add-value"
                    @keyup.enter="addStructuredField"
                  />
                  <InputNumber
                    v-else-if="newFieldType === 'number'"
                    v-model="newNumberVal"
                    class="kv-add-value"
                  />
                  <ToggleSwitch
                    v-else-if="newFieldType === 'boolean'"
                    v-model="newBoolVal"
                    class="kv-add-value"
                  />
                  <span v-else class="kv-add-value kv-add-placeholder">
                    (empty {{ newFieldType }})
                  </span>
                  <Button
                    icon="pi pi-plus"
                    label="Add"
                    size="small"
                    @click="addStructuredField"
                  />
                </div>
                <small v-if="addError" class="kv-add-error">{{ addError }}</small>
              </div>
            </JsonStructuredField>
            <small v-if="jsonInvalid" class="json-invalid-note">
              <i class="pi pi-exclamation-triangle"></i>
              JSON invalid — fix errors before switching to structured view.
            </small>
          </template>

          <!-- Select for type field -->
          <Select
            v-else-if="f.type === 'select'"
            v-model="form.data.value[f.name]"
            :options="f.options || typeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />

          <!-- Default text input -->
          <InputText
            v-else
            v-model="form.data.value[f.name]"
            class="w-full"
            :disabled="f.readOnly"
          />
        </FormField>
      </div>
    </template>
  </FormPage>
</template>

<style scoped>
.kv-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px dashed var(--p-surface-300);
  border-radius: 0.5rem;
}

.kv-row {
  display: grid;
  grid-template-columns: 140px 1fr auto;
  align-items: center;
  gap: 0.75rem;
}

.kv-key {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

.kv-complex {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--p-text-color-secondary);
}

.kv-empty {
  font-style: italic;
  color: var(--p-text-color-secondary);
  padding: 0.5rem;
}

.kv-add-row {
  display: grid;
  grid-template-columns: 140px 120px 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--p-surface-300);
  margin-top: 0.25rem;
}

.kv-add-placeholder {
  font-style: italic;
  color: var(--p-text-color-secondary);
  padding: 0 0.5rem;
}

.kv-add-error {
  color: var(--p-red-500, #ef4444);
  font-size: 0.8rem;
  padding-left: 0.25rem;
}

.json-invalid-note {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  color: var(--p-red-500, #ef4444);
  font-size: 0.85rem;
}
</style>

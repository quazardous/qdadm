<script setup>
/**
 * RoleForm - Role create/edit form (standard FormPage pattern)
 */

import { ref, computed, inject } from 'vue'
import { useEntityItemFormPage, FormPage, useOrchestrator, PermissionEditor } from '../../index.js'
import InputText from 'primevue/inputtext'
import AutoComplete from 'primevue/autocomplete'
import Chip from 'primevue/chip'

// ============ FORM BUILDER ============
const form = useEntityItemFormPage({ entity: 'roles' })

// ============ HELPERS ============
const { getManager } = useOrchestrator()
const manager = getManager('roles')

// Get permissionRegistry directly from Kernel (via provide/inject)
const permissionRegistry = inject('qdadmPermissionRegistry', null)

// Role options for inheritance (exclude self)
const allRoles = computed(() => {
  const currentName = form.data.value?.name
  const roles = manager?.roleGranter?.getRoles() || []
  return roles
    .filter(name => name !== currentName)
    .map(name => {
      const role = manager?.roleGranter?.getRole?.(name)
      return {
        name,
        label: role?.label || name,
        display: `${name} (${role?.label || name})`
      }
    })
})

// Autocomplete for roles
const roleInput = ref('')
const roleSuggestions = ref([])

function searchRoles(event) {
  const query = (event.query || '').toLowerCase()
  const selected = form.data.value.inherits || []

  roleSuggestions.value = allRoles.value
    .filter(r => !selected.includes(r.name))
    .filter(r =>
      query === '' ||
      r.name.toLowerCase().includes(query) ||
      r.label.toLowerCase().includes(query)
    )
}

function onRoleSelect(event) {
  const role = event.value
  if (role && !form.data.value.inherits?.includes(role.name)) {
    form.data.value.inherits = [...(form.data.value.inherits || []), role.name]
  }
  roleInput.value = ''
}

function removeRole(roleName) {
  form.data.value.inherits = (form.data.value.inherits || []).filter(r => r !== roleName)
}

function getRoleLabel(roleName) {
  const role = allRoles.value.find(r => r.name === roleName)
  return role?.label || roleName
}
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="role-form-fields">
        <!-- Role Name -->
        <div class="form-field">
          <label class="font-medium">Role Name</label>
          <InputText
            v-model="form.data.value.name"
            :disabled="form.isEdit.value"
            placeholder="ROLE_ADMIN"
            class="w-full"
          />
          <small class="field-hint">Convention: ROLE_UPPERCASE_NAME</small>
        </div>

        <!-- Label -->
        <div class="form-field">
          <label class="font-medium">Display Label</label>
          <InputText
            v-model="form.data.value.label"
            placeholder="Administrator"
            class="w-full"
          />
        </div>

        <!-- Inherits -->
        <div class="form-field">
          <label class="font-medium">Inherits From</label>
          <div class="inherits-editor">
            <div v-if="(form.data.value.inherits || []).length > 0" class="inherits-chips">
              <Chip
                v-for="roleName in form.data.value.inherits"
                :key="roleName"
                removable
                @remove="removeRole(roleName)"
                class="inherits-chip"
              >
                <span class="chip-name">{{ roleName }}</span>
                <span class="chip-label">({{ getRoleLabel(roleName) }})</span>
              </Chip>
            </div>
            <AutoComplete
              v-model="roleInput"
              :suggestions="roleSuggestions"
              optionLabel="display"
              placeholder="Type role name..."
              :minLength="0"
              completeOnFocus
              @complete="searchRoles"
              @item-select="onRoleSelect"
              dropdown
              class="w-full"
            >
              <template #option="{ option }">
                <div class="role-option">
                  <span class="role-name">{{ option.name }}</span>
                  <span class="role-label">{{ option.label }}</span>
                </div>
              </template>
            </AutoComplete>
          </div>
          <small class="field-hint">
            This role inherits all permissions from selected roles
          </small>
        </div>

        <!-- Permissions -->
        <div class="form-field">
          <label class="font-medium">
            Permissions ({{ (form.data.value.permissions || []).length }})
          </label>
          <PermissionEditor
            v-model="form.data.value.permissions"
            :permissionRegistry="permissionRegistry"
            placeholder="Type namespace:action..."
          />
        </div>
      </div>
    </template>
  </FormPage>
</template>

<style scoped>
/* Form layout - .form-field and .field-hint are global (main.css) */
.role-form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Inherits editor - uses .editor-box pattern */
.inherits-editor {
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--p-surface-50);
}

/* Inherits chips - uses .editor-chips pattern */
.inherits-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--p-surface-200);
}

.inherits-chip {
  font-family: monospace;
  font-size: 0.875rem;
}

.chip-name {
  font-weight: 500;
}

.chip-label {
  color: var(--p-surface-500);
  margin-left: 0.25rem;
}

.role-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.role-name {
  font-family: monospace;
  font-weight: 500;
}

.role-label {
  color: var(--p-surface-500);
  font-size: 0.875rem;
}
</style>

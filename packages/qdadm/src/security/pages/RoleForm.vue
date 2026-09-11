<script setup lang="ts">
/**
 * RoleForm - Role create/edit form (standard FormPage pattern)
 *
 * The composition is edited with RoleGrantsEditor (#2313), fed by the roles provider: here qdadm judges roles in
 * the front, so it computes what the inherited roles bring itself.
 */

import { computed } from 'vue'
import { useEntityItemFormPage, FormPage, useOrchestrator, RoleGrantsEditor } from '../../index.js'
import InputText from 'primevue/inputtext'
import {
  inheritedGrants,
  type InheritableRole,
  type RoleComposition,
  type RoleHierarchySource,
} from '../roleGrants'

/**
 * What the form reads from the roles provider
 */
interface RolesProviderInterface extends RoleHierarchySource {
  getRoles: () => string[]
  getRole?: (name: string) => { label?: string } | null
  getRoleMeta?: (name: string) => { label?: string; description?: string } | null
}

/**
 * Roles manager interface
 */
interface RolesManager {
  rolesProvider?: RolesProviderInterface | null
}

/**
 * Role form data structure
 */
interface RoleFormData {
  name: string
  label: string
  inherits: string[]
  permissions: string[]
  [key: string]: unknown
}

// ============ FORM BUILDER ============
const form = useEntityItemFormPage({ entity: 'roles' })

// ============ HELPERS ============
const { getManager } = useOrchestrator()
const manager = getManager('roles') as RolesManager | null
const provider = computed(() => manager?.rolesProvider ?? null)

const roles = computed<InheritableRole[]>(() =>
  (provider.value?.getRoles() ?? []).map((name: string) => {
    const meta = provider.value?.getRoleMeta?.(name)
    return { name, label: provider.value?.getRole?.(name)?.label || meta?.label || name, description: meta?.description }
  })
)

const composition = computed<RoleComposition>({
  get: () => {
    const data = form.data.value as RoleFormData
    return { inherits: data.inherits || [], permissions: data.permissions || [] }
  },
  set: (value: RoleComposition) => {
    form.data.value.inherits = value.inherits
    form.data.value.permissions = value.permissions
  },
})

const inherited = computed(() => inheritedGrants(provider.value, composition.value.inherits))
</script>

<template>
  <FormPage v-bind="form.props.value" v-on="form.events">
    <template #fields>
      <div class="role-form-fields">
        <!-- Role Name -->
        <div class="form-field">
          <label class="font-medium">Role Name</label>
          <InputText
            v-model="(form.data.value as RoleFormData).name"
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
            v-model="(form.data.value as RoleFormData).label"
            placeholder="Administrator"
            class="w-full"
          />
        </div>

        <!-- Inherits + permissions -->
        <div class="form-field">
          <label class="font-medium">Permissions</label>
          <RoleGrantsEditor
            v-model="composition"
            :roles="roles"
            :inherited="inherited"
            :self="(form.data.value as RoleFormData).name"
          />
        </div>
      </div>
    </template>
  </FormPage>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
/* Form layout - .form-field and .field-hint are global (main.css) */
.role-form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>

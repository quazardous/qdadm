<script setup lang="ts">
/**
 * RoleGrantsEditor — a role's composition, readable (#2313): the roles it inherits, the entity × action matrix and
 * the named grants of the permission registry, and where every checked grant comes from (its own key, one of its
 * wildcards, or an inherited role).
 *
 * It judges nothing. The roles to inherit from and what they bring (`inherited`) come from the app: computed by
 * qdadm's roles provider (see `inheritedGrants`), or sent by the app's server. It emits the role's own composition.
 */
import { computed, inject } from 'vue'
import {
  composeGrants,
  setGrant,
  type GrantCell,
  type GrantDefinition,
  type GrantOrigin,
  type GrantRow,
  type InheritableRole,
  type InheritedGrant,
  type RoleComposition,
} from '../../security/roleGrants'
import { useI18n } from '../../i18n/useI18n'
import PermissionEditor from './PermissionEditor.vue'

const props = withDefaults(
  defineProps<{
    modelValue: RoleComposition
    /** The grants to compose from. Default: the kernel's permission registry. */
    grants?: GrantDefinition[] | null
    /** The roles this one can inherit from. */
    roles?: InheritableRole[]
    /** What the inherited roles bring, with the role that declares each grant. */
    inherited?: InheritedGrant[]
    /** This role's name: left out of the roles to inherit from. */
    self?: string | null
    readonly?: boolean
  }>(),
  { grants: null, roles: () => [], inherited: () => [], self: null, readonly: false }
)

const emit = defineEmits<{ 'update:modelValue': [value: RoleComposition] }>()

const { t } = useI18n()
const registry = inject<{ getAll(): GrantDefinition[] } | null>('qdadmPermissionRegistry', null)

const grantList = computed<GrantDefinition[]>(() => props.grants ?? registry?.getAll() ?? [])
const inherits = computed<string[]>(() => props.modelValue?.inherits ?? [])
const permissions = computed<string[]>(() => props.modelValue?.permissions ?? [])
const model = computed(() =>
  composeGrants({ grants: grantList.value, permissions: permissions.value, inherited: props.inherited })
)

const update = (next: Partial<RoleComposition>) =>
  emit('update:modelValue', { inherits: [...inherits.value], permissions: [...permissions.value], ...next })
const isOn = (event: Event) => (event.target as HTMLInputElement).checked

function setPermission(key: string, on: boolean): void {
  if (!props.readonly) update({ permissions: setGrant(permissions.value, key, on) })
}

function setInherit(role: string, on: boolean): void {
  if (props.readonly) return
  const current = inherits.value
  update({ inherits: on ? (current.includes(role) ? current : [...current, role]) : current.filter((r) => r !== role) })
}

function addKeys(keys: string[]): void {
  const added = keys.filter((k) => !permissions.value.includes(k))
  if (!props.readonly && added.length > 0) update({ permissions: [...permissions.value, ...added] })
}

/** The roles to offer, plus any the role already inherits that the list does not know. */
const roleList = computed<InheritableRole[]>(() => {
  const listed = props.roles.filter((r) => r.name !== props.self)
  const unknown = inherits.value.filter((name) => !listed.some((r) => r.name === name)).map((name) => ({ name }))
  return [...listed, ...unknown]
})
const brings = (role: string) => props.inherited.filter((g) => g.via === role).length

const checked = (origin: GrantOrigin) => origin.kind !== 'none'
const editable = (origin: GrantOrigin) => !props.readonly && (origin.kind === 'own' || origin.kind === 'none')
const viaOf = (origin: GrantOrigin) =>
  origin.kind === 'wildcard' || origin.kind === 'inherited' ? t('core.roles.via', { origin: origin.via }) : ''
const titleOf = (cell: GrantCell) => [cell.label, cell.description, viaOf(cell.origin)].filter(Boolean).join(' — ')
const cellsOf = (row: GrantRow) => model.value.actions.map((action) => ({ action, cell: row.cells[action] ?? null }))
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The same grants, in the shape PermissionEditor reads to suggest keys. */
const editorRegistry = computed(() => {
  const list = grantList.value.map((g) => ({ key: g.key, namespace: g.namespace, action: g.action, label: g.label || g.key }))
  return { getAll: () => list, get: (key: string) => list.find((g) => g.key === key) }
})
</script>

<template>
  <div class="role-grants" :class="{ 'role-grants-readonly': readonly }">
    <section class="role-grants-section">
      <h4 class="role-grants-title">{{ t('core.roles.inherits') }}</h4>
      <p v-if="roleList.length === 0" class="role-grants-hint">{{ t('core.roles.noRoles') }}</p>
      <ul v-else class="role-grants-roles">
        <li v-for="role in roleList" :key="role.name">
          <label class="role-grants-role" :title="role.description">
            <input
              type="checkbox"
              :data-inherit="role.name"
              :checked="inherits.includes(role.name)"
              :disabled="readonly"
              @change="setInherit(role.name, isOn($event))"
            />
            <span class="role-grants-role-label">{{ role.label || role.name }}</span>
            <code class="role-grants-key">{{ role.name }}</code>
            <span v-if="inherits.includes(role.name)" class="role-grants-via">
              {{ t('core.roles.brings', { count: brings(role.name) }) }}
            </span>
          </label>
        </li>
      </ul>
      <p class="role-grants-hint">{{ t('core.roles.inheritsHint') }}</p>
    </section>

    <section v-if="model.rows.length > 0" class="role-grants-section">
      <h4 class="role-grants-title">{{ t('core.roles.entities') }}</h4>
      <div class="role-grants-scroll">
        <table class="role-grants-matrix">
          <thead>
            <tr>
              <th scope="col">{{ t('core.roles.entity') }}</th>
              <th scope="col">{{ t('core.roles.all') }}</th>
              <th v-for="action in model.actions" :key="action" scope="col">{{ capitalize(action) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in model.rows" :key="row.namespace" :data-grant-row="row.namespace">
              <th scope="row">
                {{ row.entity }}<span v-if="row.ownRecords" class="role-grants-own"> ({{ t('core.roles.ownRecords') }})</span>
              </th>
              <td>
                <label class="role-grants-cell" :title="viaOf(row.wildcardOrigin) || row.wildcard">
                  <input
                    type="checkbox"
                    :data-grant="row.wildcard"
                    :aria-label="`${row.entity}: ${t('core.roles.all')}`"
                    :checked="checked(row.wildcardOrigin)"
                    :disabled="!editable(row.wildcardOrigin)"
                    @change="setPermission(row.wildcard, isOn($event))"
                  />
                  <span v-if="viaOf(row.wildcardOrigin)" class="role-grants-via">{{ viaOf(row.wildcardOrigin) }}</span>
                </label>
              </td>
              <td v-for="{ action, cell } in cellsOf(row)" :key="action">
                <label v-if="cell" class="role-grants-cell" :title="titleOf(cell)">
                  <input
                    type="checkbox"
                    :data-grant="cell.key"
                    :aria-label="cell.label"
                    :checked="checked(cell.origin)"
                    :disabled="!editable(cell.origin)"
                    @change="setPermission(cell.key, isOn($event))"
                  />
                  <span v-if="viaOf(cell.origin)" class="role-grants-via">{{ viaOf(cell.origin) }}</span>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-for="group in model.groups"
      :key="group.namespace"
      class="role-grants-section"
      :data-grant-group="group.namespace"
    >
      <div class="role-grants-group-head">
        <h4 class="role-grants-title"><code>{{ group.namespace }}</code></h4>
        <label class="role-grants-cell role-grants-group-all" :title="group.wildcard">
          <input
            type="checkbox"
            :data-grant="group.wildcard"
            :aria-label="`${group.namespace}: ${t('core.roles.all')}`"
            :checked="checked(group.wildcardOrigin)"
            :disabled="!editable(group.wildcardOrigin)"
            @change="setPermission(group.wildcard, isOn($event))"
          />
          <span>{{ t('core.roles.all') }}</span>
          <span v-if="viaOf(group.wildcardOrigin)" class="role-grants-via">{{ viaOf(group.wildcardOrigin) }}</span>
        </label>
      </div>
      <ul class="role-grants-list">
        <li v-for="grant in group.grants" :key="grant.key">
          <label class="role-grants-grant" :title="grant.key">
            <input
              type="checkbox"
              :data-grant="grant.key"
              :checked="checked(grant.origin)"
              :disabled="!editable(grant.origin)"
              @change="setPermission(grant.key, isOn($event))"
            />
            <span class="role-grants-grant-label">{{ grant.label }}</span>
            <span v-if="grant.description" class="role-grants-hint">{{ grant.description }}</span>
            <span v-if="viaOf(grant.origin)" class="role-grants-via">{{ viaOf(grant.origin) }}</span>
          </label>
        </li>
      </ul>
    </section>

    <section class="role-grants-section">
      <h4 class="role-grants-title">{{ t('core.roles.others') }}</h4>
      <p class="role-grants-hint">{{ t('core.roles.othersHint') }}</p>
      <ul v-if="model.others.length > 0" class="role-grants-list">
        <li v-for="other in model.others" :key="other.key" class="role-grants-other" :data-grant-other="other.key">
          <code class="role-grants-key">{{ other.key }}</code>
          <span class="role-grants-via">
            {{ other.covers > 0 ? t('core.roles.covers', { count: other.covers }) : t('core.roles.notRegistered') }}
          </span>
          <button
            v-if="!readonly"
            type="button"
            class="role-grants-remove"
            :aria-label="`${t('core.roles.remove')} ${other.key}`"
            @click="setPermission(other.key, false)"
          >
            <i class="pi pi-times" />
          </button>
        </li>
      </ul>
      <PermissionEditor v-if="!readonly" :model-value="[]" :permission-registry="editorRegistry" @update:model-value="addKeys" />
    </section>
  </div>
</template>

<style scoped>
.role-grants {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.role-grants-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
  background: var(--p-surface-50);
}
.role-grants-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}
.role-grants-hint {
  margin: 0;
  color: var(--p-surface-500);
  font-size: 0.8rem;
}
.role-grants-key {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--p-surface-600);
}
.role-grants-via {
  color: var(--p-primary-600, var(--p-surface-600));
  font-size: 0.72rem;
  font-style: italic;
  white-space: nowrap;
}
.role-grants-roles,
.role-grants-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.role-grants-role,
.role-grants-grant {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
}
.role-grants-role-label,
.role-grants-grant-label {
  font-weight: 500;
}
.role-grants-scroll {
  overflow-x: auto;
}
.role-grants-matrix {
  border-collapse: collapse;
  width: 100%;
}
.role-grants-matrix th,
.role-grants-matrix td {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--p-surface-200);
  text-align: center;
  vertical-align: top;
}
.role-grants-matrix th[scope='row'],
.role-grants-matrix thead th:first-child {
  text-align: left;
  white-space: nowrap;
}
.role-grants-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}
.role-grants-own {
  color: var(--p-surface-500);
  font-weight: 400;
}
.role-grants-group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.role-grants-group-all {
  flex-direction: row;
  gap: 0.35rem;
}
.role-grants-other {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.role-grants-remove {
  padding: 0.1rem 0.3rem;
  border: 0;
  background: transparent;
  color: var(--p-surface-500);
  cursor: pointer;
}
.role-grants-remove:hover {
  color: var(--p-red-500);
}
/*
 * A box is a box, whatever form styles surround the widget: inside a FormField, qdadm's global
 * `.form-field input { width: 100% !important }` stretches a checkbox across the row.
 */
.role-grants input[type='checkbox'] {
  display: inline-block;
  flex: none;
  width: auto !important;
  height: auto !important;
  margin: 0;
}
input[type='checkbox']:disabled {
  cursor: not-allowed;
}
</style>

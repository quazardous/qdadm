/**
 * useListAlterHooks — the list:alter / filter:alter hook wiring of
 * useListPage (#1195, KPI-8).
 *
 * Mechanical extraction: snapshots the list config, runs the global and
 * entity-scoped alter hooks, and applies the altered config back onto the
 * live state (columns, filters, actions via the shared registry, header
 * actions). useListPage composes it back in; behavior is unchanged.
 */
import type { Ref } from 'vue'
import type {
  ActionConfig,
  ColumnConfig,
  FilterConfig,
  HeaderActionConfig,
  ResolvedAction,
} from './useListPage.types'
import type { UseActionRegistryReturn } from './useActionRegistry'

/** Minimal HookRegistry view (what the alter flow actually uses). */
export interface AlterHooksLike {
  alter: (name: string, value: unknown) => Promise<unknown>
  hasHook: (name: string) => boolean
}

/** Dependencies injected by useListPage. */
export interface UseListAlterHooksDeps {
  hooks: AlterHooksLike | null | undefined
  entity: string
  manager: unknown
  columnsMap: Ref<Map<string, ColumnConfig>>
  filtersMap: Ref<Map<string, FilterConfig>>
  filterValues: Ref<Record<string, unknown>>
  headerActionsMap: Ref<Map<string, HeaderActionConfig>>
  actionRegistry: UseActionRegistryReturn<ActionConfig, unknown, ResolvedAction>
}

export interface UseListAlterHooksReturn {
  invokeListAlterHook: () => Promise<void>
  invokeFilterAlterHook: () => Promise<void>
}

export function useListAlterHooks(deps: UseListAlterHooksDeps): UseListAlterHooksReturn {
  const {
    hooks,
    entity,
    manager,
    columnsMap,
    filtersMap,
    filterValues,
    headerActionsMap,
    actionRegistry,
  } = deps
  const actionsMap = actionRegistry.actionsMap

  async function invokeListAlterHook(): Promise<void> {
    if (!hooks) return

    const configSnapshot = {
      entity,
      columns: Array.from(columnsMap.value.values()),
      filters: Array.from(filtersMap.value.values()),
      actions: Array.from(actionsMap.value.values()),
      headerActions: Array.from(headerActionsMap.value.values()),
    }

    // Include entity context in the snapshot for hooks
    const configWithContext = { ...configSnapshot, entity, manager }

    let alteredConfig = await hooks.alter('list:alter', configWithContext)

    const entityHookName = `${entity}:list:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredConfig = await hooks.alter(entityHookName, alteredConfig)
    }

    applyAlteredConfig(
      alteredConfig as {
        columns?: ColumnConfig[]
        filters?: FilterConfig[]
        actions?: ActionConfig[]
        headerActions?: HeaderActionConfig[]
      }
    )
  }

  async function invokeFilterAlterHook(): Promise<void> {
    if (!hooks) return

    const filterSnapshot = {
      entity,
      filters: Array.from(filtersMap.value.values()),
    }

    let alteredFilters = (await hooks.alter('filter:alter', filterSnapshot)) as typeof filterSnapshot

    const entityHookName = `${entity}:filter:alter`
    if (hooks.hasHook(entityHookName)) {
      alteredFilters = (await hooks.alter(entityHookName, alteredFilters)) as typeof filterSnapshot
    }

    if (alteredFilters.filters) {
      filtersMap.value.clear()
      for (const filter of alteredFilters.filters) {
        filtersMap.value.set(filter.name, filter)
        if (filterValues.value[filter.name] === undefined) {
          filterValues.value[filter.name] = filter.default ?? null
        }
      }
    }
  }

  function applyAlteredConfig(alteredConfig: {
    columns?: ColumnConfig[]
    filters?: FilterConfig[]
    actions?: ActionConfig[]
    headerActions?: HeaderActionConfig[]
  }): void {
    if (alteredConfig.columns) {
      columnsMap.value.clear()
      for (const col of alteredConfig.columns) {
        columnsMap.value.set(col.field, col)
      }
    }

    if (alteredConfig.filters) {
      filtersMap.value.clear()
      for (const filter of alteredConfig.filters) {
        filtersMap.value.set(filter.name, filter)
        if (filterValues.value[filter.name] === undefined) {
          filterValues.value[filter.name] = filter.default ?? null
        }
      }
    }

    if (alteredConfig.actions) {
      // Route through the registry so the order list stays in sync (#1193)
      actionRegistry.clear()
      for (const action of alteredConfig.actions) {
        actionRegistry.add(action)
      }
    }

    if (alteredConfig.headerActions) {
      headerActionsMap.value.clear()
      for (const action of alteredConfig.headerActions) {
        headerActionsMap.value.set(action.name, action)
      }
    }
  }

  return { invokeListAlterHook, invokeFilterAlterHook }
}

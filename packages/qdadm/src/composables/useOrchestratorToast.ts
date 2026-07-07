/**
 * Orchestrator toast facade (#1193) — was copy-pasted verbatim in
 * useListPage, useEntityItemFormPage and useBareForm.
 */
import type { OrchestratorLike } from '../entity/EntityManager.interface'

/** Legacy-compatible toast surface used across the page composables. */
export interface ToastHelper {
  add(options: {
    severity: 'success' | 'error' | 'warn' | 'info'
    summary: string
    detail?: string
    emitter?: unknown
  }): void
}

/** Build the facade over any orchestrator-shaped object (null-tolerant). */
export function createOrchestratorToast(
  orchestrator: Pick<OrchestratorLike, 'toast'> | null | undefined
): ToastHelper {
  return {
    add({ severity, summary, detail, emitter }) {
      orchestrator?.toast?.[severity]?.(summary, detail, emitter)
    },
  }
}

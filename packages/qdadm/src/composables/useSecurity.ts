/**
 * useSecurity - ask for a permission from a component (#2242).
 *
 * `isGranted(attribute, subject?)` gives the entity managers' own verdict:
 * the application's `security.grant` judge first (#2225), then the role
 * matrix. With no security configured it grants, as managers do — a page
 * must never disagree with the list actions next to it.
 *
 * Nothing is cached: every call asks. The app remounts on `security:changed`
 * (and on login and logout), so a `v-if="isGranted('…')"` shows new answers
 * without any listener.
 *
 * Hiding is a convenience, not the protection: the server still decides.
 *
 * Usage:
 *   const { isGranted } = useSecurity()
 *   <ReplyBox v-if="isGranted('offers:debug:write')" />
 */

import { getCurrentInstance, inject } from 'vue'
import type { SecurityChecker } from '../entity/auth/SecurityChecker'

export interface UseSecurityReturn {
  /** The verdict for a permission or a `ROLE_*`, optionally about `subject` (a record). */
  isGranted: (attribute: string, subject?: unknown) => boolean
}

export function useSecurity(): UseSecurityReturn {
  if (!getCurrentInstance()) {
    throw new Error(
      '[qdadm] useSecurity() must be called within component setup() — outside a component, a module asks ctx.security.isGranted()'
    )
  }

  // null default: an app without security logs no "injection not found" warning.
  const checker = inject<SecurityChecker | null>('qdadmSecurityChecker', null)

  return {
    isGranted: (attribute, subject = null) => (checker ? checker.isGranted(attribute, subject) : true),
  }
}

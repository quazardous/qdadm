/**
 * Why a permission is granted or denied (#2363) — the same path as `SecurityChecker.isGranted`, told instead of
 * answered: the app's own judge first, the role hierarchy for a `ROLE_*` attribute, then the nearest role whose
 * grant covers the key (its exact key before a wildcard), then the user's own permissions.
 *
 * For the debug tools and the MCP's `page_snapshot`; it grants nothing and never changes a verdict.
 */
import { PermissionMatcher } from './PermissionMatcher'
import type { SecurityChecker } from '../entity/auth/SecurityChecker'

export type GrantExplanation =
  /** No current user: everything is denied. */
  | { granted: false; decidedBy: 'no-user' }
  /** The app's `security.grant` function answered (a judge that throws denies). */
  | { granted: boolean; decidedBy: 'app' }
  /** A `ROLE_*` attribute, answered by the role hierarchy. */
  | { granted: boolean; decidedBy: 'role-hierarchy'; roles: string[] }
  /** A grant covers the key: `role` holds `grant` (null: the user's own permissions). */
  | { granted: true; decidedBy: 'grant'; role: string | null; grant: string; roles: string[] }
  /** No grant of the user's roles, nor of the user, covers the key. */
  | { granted: false; decidedBy: 'grant'; roles: string[] }

const covering = (grants: readonly string[], attribute: string): string | undefined =>
  grants.includes(attribute) ? attribute : grants.find((g) => PermissionMatcher.matches(g, attribute))

export function explainGrant(checker: SecurityChecker, attribute: string, subject: unknown = null): GrantExplanation {
  const user = checker.getCurrentUser()
  if (!user) return { granted: false, decidedBy: 'no-user' }

  const judge = checker.grant
  if (judge) {
    try {
      const answer: unknown = judge.isGranted(attribute, subject, user)
      if (typeof answer === 'boolean') return { granted: answer, decidedBy: 'app' }
    } catch {
      return { granted: false, decidedBy: 'app' }
    }
  }

  const roles = (user.roles || [user.role || '']).filter((role): role is string => Boolean(role))
  if (attribute.startsWith('ROLE_')) {
    return { granted: checker.roleHierarchy.isGrantedRole(roles, attribute), decidedBy: 'role-hierarchy', roles }
  }

  for (const role of roles) {
    for (const reachable of checker.roleHierarchy.getReachableRoles(role)) {
      const grant = covering(checker.rolesProvider.getPermissions(reachable) ?? [], attribute)
      if (grant) return { granted: true, decidedBy: 'grant', role: reachable, grant, roles }
    }
  }
  const own = covering(Array.isArray(user.permissions) ? (user.permissions as string[]) : [], attribute)
  if (own) return { granted: true, decidedBy: 'grant', role: null, grant: own, roles }

  return { granted: false, decidedBy: 'grant', roles }
}

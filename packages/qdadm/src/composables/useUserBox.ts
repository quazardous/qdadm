/**
 * useUserBox - what the sidebar user box shows (#4157)
 *
 * Shared by AppLayout and DefaultUserInfo: the signed-in user's name,
 * subtitle, initials, avatar picture and profile link, all read from the
 * auth user and the `app` config (`app.userRoute`, `app.userAvatar`).
 * `app.userRoute` is an app route, or an absolute URL opened in a new tab.
 */
import { computed, inject, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useAuth } from './useAuth'
import { prettifyRole } from '../utils/formatters'

export interface UserBoxUser {
  username?: string
  name?: string
  email?: string
  role?: string
  avatar?: string | null
  avatarUrl?: string | null
  [key: string]: unknown
}

/** Where the avatar picture is, for a user; null or '' shows the initials. */
export type UserAvatarResolver = (user: UserBoxUser) => string | null | undefined

interface UserBoxAppConfig {
  userRoute?: RouteLocationRaw | null
  userAvatar?: UserAvatarResolver | null
}

/**
 * An absolute URL (`https://…`, `http://…`, `//host/…`, `mailto:…`) rather
 * than an app route. Only these schemes: a route name may hold a colon.
 */
export function isExternalUserLink(link: unknown): boolean {
  return typeof link === 'string' && /^(https?:|mailto:|\/\/)/i.test(link.trim())
}

/**
 * The avatar URL of a user: the app's resolver when it has one, else
 * `user.avatar` or `user.avatarUrl`.
 */
export function resolveUserAvatar(user: UserBoxUser | null | undefined, resolver?: UserAvatarResolver | null): string | null {
  if (!user) return null
  let url: unknown
  if (resolver) {
    try {
      url = resolver(user)
    } catch (err) {
      console.warn('[qdadm] app.userAvatar threw, showing initials:', err)
      return null
    }
  } else {
    url = user.avatar || user.avatarUrl
  }
  return typeof url === 'string' && url.trim() ? url : null
}

export interface UseUserBoxReturn {
  user: ComputedRef<UserBoxUser | null>
  displayName: ComputedRef<string>
  subtitle: ComputedRef<string>
  initials: ComputedRef<string>
  /** The picture to show, or null for the initials (none, or it failed). */
  avatarUrl: ComputedRef<string | null>
  /** Call from the img's `error` event: the initials come back. */
  avatarFailed: () => void
  /** The profile page, when the app declares one: an app route or an external URL. */
  userRoute: RouteLocationRaw | null
  /** Bind on the profile link: `{ to }` for a route, `{ href, target, rel }` for an external URL. */
  userLink: { is: 'a' | 'RouterLink'; attrs: Record<string, unknown> } | null
}

export function useUserBox(): UseUserBoxReturn {
  const { user: authUser } = useAuth()
  const app = inject<UserBoxAppConfig | null>('qdadmApp', null)

  const user = computed(() => (authUser.value as UserBoxUser | null) ?? null)

  const displayName = computed(() => user.value?.username || user.value?.name || 'User')

  const subtitle = computed(() => {
    if (user.value?.email) return user.value.email
    // raw ROLE_* constants are ugly by default — prettify (#1388)
    return user.value?.role ? prettifyRole(user.value.role) : ''
  })

  const initials = computed(() => {
    const username = user.value?.username
    if (!username) return '?'
    return username.substring(0, 2).toUpperCase()
  })

  const resolved = computed(() => resolveUserAvatar(user.value, app?.userAvatar))
  const failed: Ref<string | null> = ref(null)
  // A new URL gets its own chance to load
  watch(resolved, () => (failed.value = null))
  const avatarUrl = computed(() => (resolved.value && resolved.value !== failed.value ? resolved.value : null))

  const userRoute = app?.userRoute ?? null
  const userLink = !userRoute
    ? null
    : isExternalUserLink(userRoute)
      ? { is: 'a' as const, attrs: { href: userRoute as string, target: '_blank', rel: 'noopener noreferrer' } }
      : // A bare string is a route name, as for homeRoute; '/…' is a path
        { is: 'RouterLink' as const, attrs: { to: typeof userRoute === 'string' && !userRoute.startsWith('/') ? { name: userRoute } : userRoute } }

  return {
    user,
    displayName,
    subtitle,
    initials,
    avatarUrl,
    avatarFailed: () => (failed.value = resolved.value),
    userRoute,
    userLink,
  }
}

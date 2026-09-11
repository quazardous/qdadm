/**
 * A lazy page whose chunk no longer exists (#2295), typically in a tab left open across a deploy: the build renamed
 * its hashed chunks, the tab still runs the old bundle, and the import 404s. The router aborts the navigation and
 * nothing tells the user; on a first load the screen stays blank.
 *
 * The page reloads once, at the URL the user was going to, which fetches the new index.html. A flag in
 * sessionStorage keeps a chunk that is really missing from reloading in a loop: a second failure is reported
 * instead. The flag is cleared by the next navigation that succeeds.
 */
import type { Router } from 'vue-router'

export const CHUNK_RELOAD_KEY = 'qdadm:chunk-reload'

// Chrome, Firefox, Safari, Vite's preload helper, webpack.
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk \S+ failed/i

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  return CHUNK_ERROR.test(`${String(name ?? '')} ${typeof message === 'string' ? message : String(error)}`)
}

type FlagStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface ChunkReloadOptions {
  /** A second failure, or no way to guard a reload: tell the user. */
  notify(error: unknown): void
  /** Default: sessionStorage. Without one, nothing reloads: a loop could not be stopped. */
  storage?: FlagStorage | null
  /** Default: load `href` for real. */
  reload?(href: string): void
  /** Where Vite dispatches `vite:preloadError`. Default: window. */
  target?: EventTarget | null
}

function sessionFlags(): FlagStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function reloadAt(href: string): void {
  const url = new URL(href, window.location.href).href
  // The failed navigation never changed the URL; the reload must land where the user was going.
  if (url !== window.location.href) window.history.pushState(null, '', url)
  window.location.reload()
}

/** Returns a function that removes the handlers. */
export function installChunkReload(router: Router, options: ChunkReloadOptions): () => void {
  const storage = options.storage === undefined ? sessionFlags() : options.storage
  const reload = options.reload ?? reloadAt
  const target = options.target === undefined ? (typeof window === 'undefined' ? null : window) : options.target
  let reloading = false

  const failed = (error: unknown, href: string | null) => {
    if (reloading) return
    let tried = true
    try {
      tried = !storage || storage.getItem(CHUNK_RELOAD_KEY) !== null
      if (!tried) storage!.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
    } catch {
      tried = true
    }
    if (tried) {
      console.error('[qdadm] a page could not be loaded, and reloading did not help', error)
      options.notify(error)
      return
    }
    reloading = true
    console.warn('[qdadm] a page could not be loaded, probably a new deploy: reloading once', error)
    reload(href ?? (typeof window === 'undefined' ? '/' : window.location.href))
  }

  let routerSaw = false
  const removeOnError = router.onError((error, to) => {
    if (!isChunkLoadError(error)) return
    routerSaw = true
    failed(error, to ? router.resolve(to).href : null)
  })
  const removeAfterEach = router.afterEach((_to, _from, failure) => {
    if (failure || reloading) return
    try {
      storage?.removeItem(CHUNK_RELOAD_KEY)
    } catch {
      /* nothing to clear */
    }
  })

  // Vite dispatches this before the import rejects. When the import belongs to a navigation, the router hears the
  // rejection a few microtasks later and handles it with the page the user wanted; waiting one task lets it go
  // first, and the failure is then not handled twice.
  const onPreloadError = (event: Event) => {
    const error = (event as Event & { payload?: unknown }).payload ?? event
    routerSaw = false
    setTimeout(() => {
      if (!routerSaw) failed(error, null)
    }, 0)
  }
  target?.addEventListener('vite:preloadError', onPreloadError)

  return () => {
    removeOnError()
    removeAfterEach()
    target?.removeEventListener('vite:preloadError', onPreloadError)
  }
}

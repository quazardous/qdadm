/**
 * usePageTitle - Provide custom page title for PageHeader
 *
 * Use this composable in custom pages to set the title displayed in PageHeader.
 * For standard CRUD pages, useForm handles this automatically.
 *
 * Usage:
 * ```ts
 * // Simple title
 * const { setTitle } = usePageTitle('My Custom Page')
 *
 * // Decorated title (entityLabel shown prominently, action+entityName as badge)
 * usePageTitle({
 *   action: 'View',
 *   entityName: 'Stats',
 *   entityLabel: 'Dashboard'
 * })
 *
 * // Reactive updates
 * const { setTitle } = usePageTitle('Initial')
 * setTitle('Updated Title')
 * ```
 */
import { ref, provide, watchEffect, isRef, unref, type Ref } from 'vue'

/**
 * Title parts for decorated title display
 */
export interface TitleParts {
  simple?: string
  action?: string
  entityName?: string
  entityLabel?: string
}

/**
 * Title input type - can be string or TitleParts object
 */
export type TitleInput = string | TitleParts | null

/**
 * Return type for usePageTitle
 */
export interface UsePageTitleReturn {
  titleParts: Ref<TitleParts | null>
  setTitle: (newTitle: TitleInput | Ref<TitleInput>) => void
}

export function usePageTitle(
  initialTitle: TitleInput | Ref<TitleInput> = null
): UsePageTitleReturn {
  const titleParts = ref<TitleParts | null>(null)

  // Convert string to titleParts format (simple title)
  function normalize(title: TitleInput): TitleParts | null {
    if (!title) return null
    if (typeof title === 'string') {
      return { simple: title }
    }
    return title
  }

  // Set title (string or { action, entityName, entityLabel })
  function setTitle(newTitle: TitleInput | Ref<TitleInput>): void {
    titleParts.value = normalize(unref(newTitle))
  }

  // Initialize with provided value
  if (initialTitle !== null) {
    if (isRef(initialTitle)) {
      // Reactive: watch for changes
      watchEffect(() => {
        setTitle(initialTitle.value)
      })
    } else {
      setTitle(initialTitle)
    }
  }

  // Provide to PageHeader via same key as useForm
  provide('qdadmPageTitleParts', titleParts)

  return { titleParts, setTitle }
}

/**
 * Element refs (#2247): the short ids a page snapshot prints (`e12`) and the
 * action tools take back.
 *
 * An element keeps its ref for as long as it lives, across snapshots. A ref
 * whose element was re-rendered or removed fails loudly: acting on whatever
 * now sits in its place would be worse.
 */
export interface RefRegistry {
  /** The element's ref, minted on first sight. */
  refOf(element: Element): string
  /** The element behind a ref, or an error that says to take a new snapshot. */
  resolve(ref: string): Element
}

export function createRefs(): RefRegistry {
  const byElement = new WeakMap<Element, string>()
  const byRef = new Map<string, WeakRef<Element>>()
  let seq = 0

  return {
    refOf(element) {
      let ref = byElement.get(element)
      if (!ref) {
        ref = `e${++seq}`
        byElement.set(element, ref)
        byRef.set(ref, new WeakRef(element))
        // Forget refs whose element was garbage-collected, now and then.
        if (seq % 500 === 0) for (const [r, weak] of byRef) if (!weak.deref()) byRef.delete(r)
      }
      return ref
    },
    resolve(ref) {
      const element = byRef.get(String(ref).replace(/^\[?ref=|\]$/g, ''))?.deref()
      if (!element || !element.isConnected) {
        throw new Error(
          `ref ${ref} is no longer in the page (re-rendered or removed) — take a new page_snapshot and use the refs it prints`
        )
      }
      return element
    },
  }
}

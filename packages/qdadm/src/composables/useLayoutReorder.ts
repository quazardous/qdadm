/**
 * useLayoutReorder (#5526): moving the items of a layout, by a handle, with
 * the mouse, touch, pen or the keyboard. The dashboards' grid and an ordered
 * list (QdLayoutOrder) share it; each says how to find an item on screen and
 * how a move is made.
 *
 * - The keyboard, on the handle: the arrows move one place, Home and End to
 *   the ends.
 * - The pointer: pressed on the handle, the item under the pointer is the
 *   drop place, previewed as it goes; released, it stays; Escape or a
 *   cancelled pointer puts everything back.
 *
 * Followed on window, not with pointer capture: a preview moves the item in
 * the DOM, which drops a capture and would lose the pointerup.
 */
import { onBeforeUnmount, ref, type Ref } from 'vue'

export interface LayoutReorderOptions {
  /** The ids an item moves among, as shown */
  group: (id: string) => string[]
  /** An item that keeps its place */
  isFixed?: (id: string) => boolean
  /** The element an item is drawn in, to find what the pointer is over */
  locate: (id: string) => HTMLElement | null
  /** Move it to an index of its group, for good (the keyboard); false when nothing moved */
  move: (id: string, index: number) => boolean
  /** Move it while dragging, not yet for good */
  preview: (id: string, index: number) => void
  /** What to put back if the drag is cancelled */
  snapshot: () => () => void
  /** It moved (the keyboard) or was dropped (the pointer): announce it, focus its handle */
  onMoved?: (id: string) => void
  /** The drag was cancelled */
  onCancel?: () => void
}

export interface UseLayoutReorderReturn {
  /** The id being dragged, or null */
  dragging: Ref<string | null>
  onHandleKey: (event: KeyboardEvent, id: string) => void
  onPointerDown: (event: PointerEvent, id: string) => void
  /** Stop a drag, keeping what was previewed */
  stop: () => void
}

export function useLayoutReorder(options: LayoutReorderOptions): UseLayoutReorderReturn {
  const dragging = ref<string | null>(null)
  let restore: (() => void) | null = null

  function onHandleKey(event: KeyboardEvent, id: string): void {
    const group = options.group(id)
    const from = group.indexOf(id)
    if (from === -1) return
    const to = { ArrowUp: from - 1, ArrowLeft: from - 1, ArrowDown: from + 1, ArrowRight: from + 1, Home: 0, End: group.length - 1 }[event.key]
    if (to === undefined) return
    event.preventDefault()
    if (options.move(id, to)) options.onMoved?.(id)
  }

  function onPointerDown(event: PointerEvent, id: string): void {
    if (options.isFixed?.(id) || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    restore = options.snapshot()
    dragging.value = id
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onDragKey)
  }

  function stop(): void {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('keydown', onDragKey)
    dragging.value = null
    restore = null
  }

  function onPointerMove(event: PointerEvent): void {
    const id = dragging.value
    if (!id) return
    // The item of the same group under the pointer is the drop place
    const group = options.group(id)
    for (let i = 0; i < group.length; i++) {
      const other = group[i]!
      if (other === id || options.isFixed?.(other)) continue
      const r = options.locate(other)?.getBoundingClientRect()
      if (r && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) {
        options.preview(id, i)
        return
      }
    }
  }

  function onPointerUp(): void {
    const id = dragging.value
    if (!id) return
    stop()
    options.onMoved?.(id)
  }

  function cancel(): void {
    restore?.()
    stop()
    options.onCancel?.()
  }
  function onPointerCancel(): void {
    if (dragging.value) cancel()
  }
  function onDragKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && dragging.value) cancel()
  }

  onBeforeUnmount(stop)
  return { dragging, onHandleKey, onPointerDown, stop }
}

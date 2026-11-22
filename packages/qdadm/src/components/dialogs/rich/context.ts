/**
 * What a rich dialog shares with its blocks (#5445): how many are still
 * rendering (a markdown block waits for its library). While one is, the
 * content does not count as read just because it fits.
 */
import { inject, onBeforeUnmount, type InjectionKey, type Ref } from 'vue'

export const RICH_PENDING: InjectionKey<Ref<number>> = Symbol('qdRichPending')

/** A block says it renders: call the returned function once done */
export function useRichPending(): () => void {
  const pending = inject(RICH_PENDING, null)
  if (!pending) return () => {}
  pending.value++
  let done = false
  const finish = () => {
    if (done) return
    done = true
    pending.value--
  }
  onBeforeUnmount(finish)
  return finish
}

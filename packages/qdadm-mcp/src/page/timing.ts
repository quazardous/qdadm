/**
 * Waiting inside the page (#2247) without trusting the frame clock.
 *
 * The tab an agent drives is often in the background — the user is looking at
 * the agent. There the browser runs no requestAnimationFrame at all, and
 * stretches a chain of timers (a timer set from a timer) to one run a minute.
 * So nothing here waits on a frame, and every delay starts from a message
 * task: background throttling then holds it to a second at most.
 */

/** Let the app process what an event started: its microtasks, then one task. */
export function yieldToApp(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })
}

/** A delay that never becomes a nested timer chain. */
export function pause(ms: number): Promise<void> {
  return yieldToApp().then(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))
}

/**
 * Type declarations for @quazardous/quarkernel
 *
 * quarkernel is an event-driven kernel library used by qdadm
 * for signal/event handling.
 */

declare module '@quazardous/quarkernel' {
  export interface KernelOptions {
    debug?: boolean
    [key: string]: unknown
  }

  export interface ListenerOptions {
    priority?: number
    id?: string
    after?: string | string[]
    once?: boolean
  }

  export interface ListenerContext {
    id?: string
    cancel: () => void
    emit: (signal: string, payload: unknown) => Promise<void>
  }

  export type ListenerCallback = (
    event: { name: string; data: unknown },
    ctx: ListenerContext
  ) => void | Promise<void>

  export interface QuarKernel {
    on(signal: string, handler: ListenerCallback, options?: ListenerOptions): () => void
    once(signal: string, handler: ListenerCallback, options?: ListenerOptions): () => void
    off(signal: string, handler: ListenerCallback): void
    emit(signal: string, payload?: unknown): Promise<void>
    destroy(): void
  }

  export function createKernel(options?: KernelOptions): QuarKernel
}

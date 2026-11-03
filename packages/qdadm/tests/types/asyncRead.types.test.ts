/**
 * A typed useAsyncRead() fits QdPending and QdPendingZone's `read` prop (#4665),
 * and its `data` keeps the loader's type, `undefined` until read.
 *
 * Run: npm run type-check (vue-tsc reads this file through tsconfig.typetest.json)
 */
import { describe, it, expect } from 'vitest'
import { useAsyncRead, type UseAsyncReadReturn } from '../../src/composables/useAsyncRead'

interface Backup {
  at: string
  size: number
}

describe('useAsyncRead types (#4665)', () => {
  it('a typed read is a read of unknown, as the components take it', () => {
    const backups = useAsyncRead(async (): Promise<Backup[] | null> => [], { immediate: false })
    const first: Backup | undefined = backups.data.value?.[0] ?? undefined
    // @ts-expect-error data is undefined until read: not a plain Backup[]
    const all: Backup[] = backups.data.value
    const asProp: UseAsyncReadReturn<unknown> = backups
    expect([first, all, asProp.pending.value]).toBeDefined()
  })
})

/**
 * Type-conformance fixture (#1387): the EXACT patterns documented in
 * docs/tutorial-mini-admin.md and the root README, written WITHOUT casts.
 * If any of these stops compiling, the docs and the shipped types have
 * diverged — fix the types, not the docs.
 *
 * Covered contradictions (each used to force an `as any` in a TS consumer):
 * 1. authAdapter: a LocalStorageSessionAuthAdapter subclass assigned to
 *    KernelOptions.authAdapter
 * 2. entityAuthAdapter: the function form `() => authAdapter.getUser()`
 * 3. children: `{ entity, foreignKey, label }` (README parent-child shape)
 * 4. handled in TutorialPatterns.vue (FormInput accepts generated fields)
 * 5. data generic defaults: index access on form/show data without generics
 */
import { Kernel, Module, EntityManager, MockApiStorage, LocalStorageSessionAuthAdapter } from '@quazardous/qdadm'
import type { KernelOptions } from '@quazardous/qdadm'

// ── 1. authAdapter subclass (tutorial step 3) ────────────────────────────
class MyAuthAdapter extends LocalStorageSessionAuthAdapter {
  constructor() {
    super('smoke_auth')
  }

  async login({ username, password }: { username: string; password: string }) {
    const user = { id: '1', username, role: 'ROLE_ADMIN' }
    void password
    const token = 'smoke-token'
    this.setSession(token, user)
    this.persist()
    return { user, token }
  }
}

const authAdapter = new MyAuthAdapter()

// ── 3. children shape from the root README ───────────────────────────────
class BooksModule extends Module {
  static override name = 'books'

  // the tutorial's documented signature — ModuleContext isn't part of the
  // documented surface yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async connect(ctx: any) {
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      children: {
        loans: { entity: 'loans', foreignKey: 'book_id', label: 'Loans' },
      },
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
      },
      storage: new MockApiStorage({ entityName: 'books', initialData: [] }),
    }))
  }
}

// ── 1 + 2. Kernel options as the tutorial writes them ────────────────────
export const kernelOptions: KernelOptions = {
  moduleDefs: [BooksModule],
  authAdapter,
  entityAuthAdapter: () => authAdapter.getUser(),
}

export function makeKernel(): Kernel {
  return new Kernel({ ...kernelOptions, root: {} })
}

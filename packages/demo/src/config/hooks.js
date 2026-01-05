/**
 * Lifecycle hooks for demo app
 *
 * Register hooks after kernel.createApp() but before mount().
 */

/**
 * Register demo hooks on kernel
 * @param {import('qdadm').Kernel} kernel
 */
export function registerHooks(kernel) {
  // presave: Add audit timestamps for books
  kernel.hooks.register('entity:presave', (context) => {
    if (context.entity !== 'books') return
    const { record, isNew } = context
    const now = new Date().toISOString()
    if (isNew) {
      record.created_at = now
    }
    record.updated_at = now
  }, { priority: 50 })

  // postsave: Log save operations for books
  kernel.hooks.register('entity:postsave', (context) => {
    if (context.entity !== 'books') return
    const { result, isNew } = context
    console.log(`[demo] Book ${isNew ? 'created' : 'updated'}: ${result.title}`)
  }, { priority: 50 })

  // predelete: Log delete operations for books
  kernel.hooks.register('entity:predelete', (context) => {
    if (context.entity !== 'books') return
    console.log(`[demo] About to delete book ID: ${context.id}`)
  }, { priority: 50 })

  // menu:alter: Customize navigation (example)
  kernel.hooks.register('menu:alter', (context) => {
    // Add custom nav modifications here
    return context
  }, { priority: 50 })
}

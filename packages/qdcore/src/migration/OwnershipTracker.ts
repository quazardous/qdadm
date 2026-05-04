/**
 * OwnershipTracker — runtime registry of "which plugin owns which column".
 *
 * Used at uninstall time to figure out exactly what to drop:
 * - For tables OWNED by the plugin → drop the table entirely
 * - For tables owned by OTHER plugins where this plugin added columns →
 *   drop only the added columns, keep the table and other plugins' columns
 *
 * Pure book-keeping; the actual DROP COLUMN / DROP TABLE statements come
 * from the diff engine.
 *
 * Persistence: this is the in-memory mirror of `qdcms_schema_state` (the
 * runner's persistence layer). The runner hydrates this from the DB at
 * boot and updates both in-memory and on-disk on every state change.
 */

export interface ColumnOwnership {
  table: string
  column: string
  owner: string
}

export interface TableOwnership {
  table: string
  owner: string
}

export class OwnershipTracker {
  /** Map of `<table>` → owner plugin id. */
  private tables = new Map<string, string>()
  /** Map of `<table>:<column>` → owner plugin id. */
  private columns = new Map<string, string>()

  /** Record that a plugin owns a table (and implicitly its built-in columns). */
  registerTable(table: string, owner: string): void {
    if (this.tables.has(table)) {
      throw new OwnershipConflictError(
        `table "${table}" already owned by "${this.tables.get(table)}", cannot reassign to "${owner}"`,
      )
    }
    this.tables.set(table, owner)
  }

  /** Record an extension column on a (typically other-owned) table. */
  registerColumn(table: string, column: string, owner: string): void {
    const key = `${table}:${column}`
    if (this.columns.has(key)) {
      throw new OwnershipConflictError(
        `column "${table}.${column}" already owned by "${this.columns.get(key)}", cannot reassign to "${owner}"`,
      )
    }
    this.columns.set(key, owner)
  }

  /** Drop ownership of a table (called at uninstall). */
  unregisterTable(table: string): void {
    this.tables.delete(table)
    // Cascade: drop any column ownership rows for this table.
    for (const key of this.columns.keys()) {
      if (key.startsWith(`${table}:`)) this.columns.delete(key)
    }
  }

  /** Drop ownership of one column (called when an extension is removed). */
  unregisterColumn(table: string, column: string): void {
    this.columns.delete(`${table}:${column}`)
  }

  /** Plugin id owning the table, or undefined if none. */
  tableOwner(table: string): string | undefined {
    return this.tables.get(table)
  }

  /** Plugin id owning the column, or undefined if none. */
  columnOwner(table: string, column: string): string | undefined {
    return this.columns.get(`${table}:${column}`)
  }

  /** All tables owned by a given plugin (for uninstall planning). */
  tablesOwnedBy(plugin: string): string[] {
    const out: string[] = []
    for (const [table, owner] of this.tables) {
      if (owner === plugin) out.push(table)
    }
    return out
  }

  /**
   * All extension columns this plugin added to OTHER plugins' tables.
   * Excludes columns on tables this plugin owns (those go away with the
   * table itself).
   */
  extensionsBy(plugin: string): ColumnOwnership[] {
    const out: ColumnOwnership[] = []
    for (const [key, owner] of this.columns) {
      if (owner !== plugin) continue
      const [table, column] = key.split(':')
      if (this.tables.get(table) === plugin) continue // own table → skip
      out.push({ table, column, owner })
    }
    return out
  }

  /** All recorded ownership entries — used for diagnostics + tests. */
  snapshot(): { tables: TableOwnership[]; columns: ColumnOwnership[] } {
    return {
      tables: Array.from(this.tables, ([table, owner]) => ({ table, owner })),
      columns: Array.from(this.columns, ([key, owner]) => {
        const [table, column] = key.split(':')
        return { table, column, owner }
      }),
    }
  }

  /** Clear everything — useful for tests; never called in production. */
  clear(): void {
    this.tables.clear()
    this.columns.clear()
  }
}

export class OwnershipConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OwnershipConflictError'
  }
}

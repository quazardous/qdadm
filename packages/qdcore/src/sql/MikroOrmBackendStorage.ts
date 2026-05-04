/**
 * MikroOrmBackendStorage — BackendStorage impl on top of MikroORM.
 *
 * Wraps a MikroORM instance keyed by a SQL connection. The schema is
 * mutated via MikroORM SchemaGenerator (driven from outside by the
 * MigrationRunner), and CRUD goes through MikroORM EntityManager + the
 * generic Repository<T> our contract requires.
 *
 * Phase 1b scope: SQLite only (in-memory or file). The same code works
 * for MariaDB/Postgres by swapping the driver — addressed in Phase 2.
 */

import {
  MikroORM,
  type Options,
  type EntitySchema,
  type EntityManager,
} from '@mikro-orm/core'
import type {
  BackendStorage,
  EntityDescriptor,
  Query,
  Repository,
} from '../entity/types'
import { descriptorToEntitySchema } from './descriptorToEntitySchema'

/**
 * Always-present entities the storage adds to every MikroORM init,
 * regardless of plugin contributions. Today this is just the
 * `qdcms_schema_state` system table — needed because MikroORM v6
 * refuses an empty entity list at init time.
 *
 * Lazy-loaded to avoid a circular import (SqlMigrationStore imports
 * descriptorToEntitySchema → ... → MikroOrmBackendStorage).
 */
async function getSystemEntities(): Promise<EntitySchema[]> {
  const { SchemaStateEntity } = await import('./SqlMigrationStore')
  return [SchemaStateEntity]
}

export interface MikroOrmBackendStorageOptions {
  /**
   * MikroORM driver options. For SQLite tests, pass `{ dbName: ':memory:' }`.
   * For file SQLite: `{ dbName: './path/to/db.sqlite' }`.
   * Other dialects: see MikroORM driver-specific docs.
   */
  ormOptions: Options
  /**
   * Optional initial entity descriptors. More can be added after construction
   * via {@link MikroOrmBackendStorage.registerEntities} before {@link connect}.
   * Note: MikroORM v6 requires entities at init; calling registerEntities
   * after connect requires re-init (handled internally by Phase 1b's
   * "rebuild ORM on schema change" pattern from the MigrationRunner).
   */
  entities?: EntityDescriptor[]
}

export class MikroOrmBackendStorage implements BackendStorage {
  private orm: MikroORM | null = null
  private entitySchemas: EntitySchema[] = []
  private readonly ormOptions: Options

  constructor(options: MikroOrmBackendStorageOptions) {
    this.ormOptions = options.ormOptions
    if (options.entities) {
      this.entitySchemas = options.entities.map(descriptorToEntitySchema)
    }
  }

  /**
   * Replace the registered entity set. Caller MUST disconnect/reconnect
   * after calling this (MikroORM's metadata is fixed at init).
   */
  registerEntities(entities: EntityDescriptor[]): void {
    this.entitySchemas = entities.map(descriptorToEntitySchema)
  }

  async connect(): Promise<void> {
    if (this.orm) return
    const systemEntities = await getSystemEntities()
    this.orm = await MikroORM.init({
      ...this.ormOptions,
      entities: [...systemEntities, ...this.entitySchemas],
      // Disable MikroORM's own migration system — ours is on top.
      migrations: { disableForeignKeys: false },
      // We drive the schema; MikroORM should not auto-create.
      ensureDatabase: false,
    } as Options)
  }

  async disconnect(): Promise<void> {
    if (!this.orm) return
    await this.orm.close()
    this.orm = null
  }

  /**
   * Direct access to the underlying MikroORM instance — used by the
   * MigrationRunner to access the SchemaGenerator and the connection.
   * Throws if not connected.
   */
  getOrm(): MikroORM {
    if (!this.orm) throw new Error('MikroOrmBackendStorage: not connected')
    return this.orm
  }

  repository<T>(entityName: string): Repository<T> {
    const orm = this.getOrm()
    const em = orm.em.fork()
    const repo = em.getRepository(entityName) as unknown as MikroOrmRepoLike<T>
    return new MikroRepositoryAdapter<T>(em, repo, entityName)
  }

  async transaction<R>(fn: (tx: BackendStorage) => Promise<R>): Promise<R> {
    const orm = this.getOrm()
    return await orm.em.transactional(async () => {
      // For Phase 1b we pass `this` — a single-process SQLite connection
      // shares state across forked EMs anyway. Multi-connection drivers
      // would need a forked storage handle; revisit then.
      return await fn(this)
    })
  }
}

// ─── Internal: MikroORM repository adapter to our Repository<T> contract ──

interface MikroOrmRepoLike<T> {
  findOne(where: Partial<T>): Promise<T | null>
  find(where: Partial<T>, options?: { orderBy?: unknown; limit?: number; offset?: number }): Promise<T[]>
  count(where?: Partial<T>): Promise<number>
}

class MikroRepositoryAdapter<T> implements Repository<T> {
  constructor(
    private em: EntityManager,
    private repo: MikroOrmRepoLike<T>,
    private entityName: string,
  ) {}

  async find(id: string | number): Promise<T | null> {
    return await this.repo.findOne({ id } as unknown as Partial<T>)
  }

  async list(query?: Query<T>): Promise<T[]> {
    return await this.repo.find(
      (query?.where ?? {}) as Partial<T>,
      {
        orderBy: query?.orderBy,
        limit: query?.limit,
        offset: query?.offset,
      },
    )
  }

  async count(query?: Query<T>): Promise<number> {
    return await this.repo.count((query?.where ?? {}) as Partial<T>)
  }

  async create(data: Partial<T>): Promise<T> {
    const entity = this.em.create(this.entityName, data as Record<string, unknown>)
    await this.em.persistAndFlush(entity)
    return entity as unknown as T
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    const found = await this.repo.findOne({ id } as unknown as Partial<T>)
    if (!found) throw new Error(`${this.entityName} ${String(id)} not found`)
    Object.assign(found as object, data)
    await this.em.flush()
    return found
  }

  async delete(id: string | number): Promise<void> {
    const found = await this.repo.findOne({ id } as unknown as Partial<T>)
    if (!found) return
    await this.em.removeAndFlush(found as object)
  }
}

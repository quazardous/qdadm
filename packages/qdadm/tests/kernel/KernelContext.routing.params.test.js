/**
 * Unit tests for child-route parent param resolution (qdadm #1201).
 *
 * The parent id URL param must not collide with the child's own :id.
 * Precedence: per-call parentParam > kernel routeParamResolver >
 * parentParamMode (auto | always | bare).
 *
 * NOTE: the module registry is global — every test uses unique entity
 * names to stay isolated.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { KernelContext } from '../../src/kernel/KernelContext'
import { Module } from '../../src/kernel/Module'
import { getRoutes } from '../../src/module/moduleRegistry'

const noopPage = () => Promise.resolve({ default: {} })

function makeCtx(kernelOptions = {}) {
  const kernel = {
    orchestrator: {
      isRegistered: () => true,
      get: () => ({ idField: 'id' }),
    },
    options: kernelOptions,
    _pendingProvides: new Map(),
    _pendingComponents: new Map(),
  }
  return new KernelContext(kernel, new Module())
}

function findRoute(name) {
  return getRoutes().find((r) => r.name === name)
}

describe('child-route parent param resolution (#1201)', () => {
  it('auto mode: family WITH show namespaces the parent, child keeps :id', () => {
    const ctx = makeCtx()
    ctx.crud('p1jobs', { list: noopPage })
    ctx.crud('p1tasks', { list: noopPage, show: noopPage }, { parentRoute: 'p1job' })

    const list = findRoute('p1job-p1task')
    const show = findRoute('p1job-p1task-show')
    expect(list.path).toBe('p1jobs/:p1jobId/p1tasks')
    expect(show.path).toBe('p1jobs/:p1jobId/p1tasks/:id')
    expect(show.meta.parent.param).toBe('p1jobId')
  })

  it('auto mode: list-only family falls back to the bare :id (unchanged URLs)', () => {
    const ctx = makeCtx()
    ctx.crud('p2jobs', { list: noopPage })
    ctx.crud('p2tasks', { list: noopPage }, { parentRoute: 'p2job' })

    const list = findRoute('p2job-p2task')
    expect(list.path).toBe('p2jobs/:id/p2tasks')
    expect(list.meta.parent.param).toBe('id')
  })

  it('auto mode: form family (create/edit) namespaces the parent too', () => {
    const ctx = makeCtx()
    ctx.crud('p3jobs', { list: noopPage })
    ctx.crud('p3tasks', { list: noopPage, form: noopPage }, { parentRoute: 'p3job' })

    const edit = findRoute('p3job-p3task-edit')
    expect(edit.path).toBe('p3jobs/:p3jobId/p3tasks/:id/edit')
    expect(edit.meta.parent.param).toBe('p3jobId')
  })

  it('per-call parentParam overrides everything', () => {
    const ctx = makeCtx({
      parentParamMode: 'bare',
      routeParamResolver: () => 'resolverWins',
    })
    ctx.crud('p4jobs', { list: noopPage })
    ctx.crud(
      'p4tasks',
      { list: noopPage, show: noopPage },
      { parentRoute: 'p4job', parentParam: 'jobUuid' },
    )

    const show = findRoute('p4job-p4task-show')
    expect(show.path).toBe('p4jobs/:jobUuid/p4tasks/:id')
    expect(show.meta.parent.param).toBe('jobUuid')
  })

  it('kernel routeParamResolver wins over the mode default', () => {
    const seen = []
    const ctx = makeCtx({
      routeParamResolver: (rctx) => {
        seen.push(rctx)
        return 'mappedId'
      },
    })
    ctx.crud('p5jobs', { list: noopPage })
    ctx.crud('p5tasks', { list: noopPage, show: noopPage }, { parentRoute: 'p5job' })

    const show = findRoute('p5job-p5task-show')
    expect(show.path).toBe('p5jobs/:mappedId/p5tasks/:id')
    expect(seen[0]).toEqual({
      parentEntity: 'p5jobs',
      parentRouteName: 'p5job',
      childEntity: 'p5tasks',
      parentIdField: 'id',
    })
  })

  it("mode 'always' namespaces even a list-only family", () => {
    const ctx = makeCtx({ parentParamMode: 'always' })
    ctx.crud('p6jobs', { list: noopPage })
    ctx.crud('p6tasks', { list: noopPage }, { parentRoute: 'p6job' })

    const list = findRoute('p6job-p6task')
    expect(list.path).toBe('p6jobs/:p6jobId/p6tasks')
    expect(list.meta.parent.param).toBe('p6jobId')
  })

  it("mode 'bare' throws an explicit error on collision instead of shadowing", () => {
    const ctx = makeCtx({ parentParamMode: 'bare' })
    ctx.crud('p7jobs', { list: noopPage })
    expect(() =>
      ctx.crud('p7tasks', { list: noopPage, show: noopPage }, { parentRoute: 'p7job' }),
    ).toThrow(/shadow the parent id/)
  })

  it('childPage keeps the bare parent param in auto mode (single-id family)', () => {
    const ctx = makeCtx()
    ctx.crud('p8jobs', { list: noopPage })
    ctx.childPage('p8job', 'stats', { component: noopPage })

    const page = findRoute('p8job-stats')
    expect(page.path).toBe('p8jobs/:id/stats')
    expect(page.meta.parent.param).toBe('id')
  })
})

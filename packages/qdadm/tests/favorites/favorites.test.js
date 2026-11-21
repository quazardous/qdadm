/**
 * Favourites and recents (#5349): kept in the `favorites` and `recents`
 * entities the app declares, through their managers; the star beside a page
 * title, "Save this search", the records opened, and the two cards that read
 * them live. Without the entity, the star hides.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useFavorites, useRecent } from '../../src/favorites/useFavorites'
import { resetFavoriteLists, configureFavorites, RECENT_MAX } from '../../src/favorites/store'
import QdFavoriteStar from '../../src/components/layout/QdFavoriteStar.vue'
import QdSaveSearch from '../../src/components/lists/QdSaveSearch.vue'
import PageHeader from '../../src/components/layout/PageHeader.vue'
import { QdFavoritesCard, QdRecentCard } from '../../src/cards/index'

/** An entity's manager over an array, as a storage would answer */
function memoryManager(rows = []) {
  let next = 1
  const m = {
    idField: 'id',
    rows,
    calls: [],
    list: async () => ({ items: m.rows.map((r) => ({ ...r })), total: m.rows.length }),
    create: async (data) => {
      m.calls.push(['create', data])
      const row = { ...data, id: `r${next++}` }
      m.rows.push(row)
      return row
    },
    delete: async (id) => {
      m.calls.push(['delete', id])
      m.rows = m.rows.filter((r) => r.id !== id)
    },
    patch: async (id, data) => {
      m.calls.push(['patch', id, data])
      Object.assign(m.rows.find((r) => r.id === id), data)
    },
  }
  return m
}

let managers
const orchestrator = () => ({ has: (name) => name in managers, get: (name) => managers[name] })

async function mountWith(component, props = {}, path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
  await router.push(path)
  let api
  const Host = defineComponent({
    setup() {
      api = { favorites: useFavorites(), recent: useRecent() }
      return () => h(component, props)
    },
  })
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [router], provide: { qdadmOrchestrator: orchestrator() } } })
  await flushPromises()
  return { wrapper, router, ...api }
}

beforeEach(() => {
  resetFavoriteLists()
  managers = { favorites: memoryManager(), recents: memoryManager() }
})

describe('favourites (#5349)', () => {
  it('are records of the favorites entity, read and written through its manager', async () => {
    managers.favorites.rows.push({ id: 'f1', kind: 'list', label: 'Books', to: '/books', at: '2026-11-19T10:00:00Z', owner: 'bob' }, { id: 'f2', bogus: true })
    const { favorites } = await mountWith({ render: () => null })
    expect(favorites.available).toBe(true)
    expect(favorites.list.value.map((f) => f.label)).toEqual(['Books'])

    await favorites.add({ kind: 'item', label: 'Dune', to: '/books/1', entity: 'books' })
    expect(managers.favorites.calls[0]).toEqual(['create', expect.objectContaining({ kind: 'item', label: 'Dune', to: '/books/1', entity: 'books', at: expect.any(String) })])
    const dune = favorites.find('/books/1')
    expect(dune.id).toBe('r1')

    await favorites.rename('f1', 'All the books')
    expect(managers.favorites.calls.at(-1)).toEqual(['patch', 'f1', { label: 'All the books' }])
    expect(await favorites.toggle({ kind: 'item', label: 'Dune', to: '/books/1' })).toBe(false)
    expect(managers.favorites.calls.at(-1)).toEqual(['delete', 'r1'])
  })

  it('a failed write leaves the list as it was', async () => {
    managers.favorites.create = async () => {
      throw new Error('403')
    }
    const { favorites } = await mountWith({ render: () => null })
    const warn = console.warn
    console.warn = () => {}
    expect(await favorites.add({ kind: 'item', label: 'Dune', to: '/books/1' })).toBeNull()
    console.warn = warn
    expect(favorites.list.value).toEqual([])
    expect(favorites.error.value).toBe('403')
  })

  it('without the entity: not available, the star hides', async () => {
    delete managers.favorites
    const { wrapper, favorites } = await mountWith(QdFavoriteStar, { label: 'Dune' }, '/books/1')
    expect(favorites.available).toBe(false)
    expect(wrapper.find('[data-favorite-star]').exists()).toBe(false)
  })

  it('configureFavorites names another entity, or turns them off', async () => {
    managers.stars = memoryManager([{ id: 's1', kind: 'board', label: 'Board', to: '/', at: 1 }])
    configureFavorites({ favorites: 'stars', recents: false })
    const { favorites, recent } = await mountWith({ render: () => null })
    expect(favorites.list.value.map((f) => f.label)).toEqual(['Board'])
    expect(recent.available).toBe(false)
  })

  it('the star follows the page: pressed, and saying so in words', async () => {
    const { wrapper, favorites } = await mountWith(QdFavoriteStar, { label: 'Dune', kind: 'item' }, '/books/1?run=abc')
    const star = wrapper.find('[data-favorite-star]')
    expect(star.attributes('aria-pressed')).toBe('false')
    expect(star.attributes('aria-label')).toBe('Add Dune to favourites')
    await star.trigger('click')
    await flushPromises()
    // The page's path, without its query
    expect(favorites.list.value).toEqual([expect.objectContaining({ to: '/books/1', label: 'Dune', kind: 'item' })])
    expect(star.attributes('aria-pressed')).toBe('true')
    expect(star.attributes('aria-label')).toBe('Remove Dune from favourites')
  })

  it("a record's show and edit pages share one favourite", async () => {
    const edit = await mountWith(QdFavoriteStar, { label: 'Dune', kind: 'item', entity: 'books', itemId: '1' }, '/books/1/edit')
    await edit.wrapper.find('[data-favorite-star]').trigger('click')
    await flushPromises()
    expect(managers.favorites.rows[0]).toMatchObject({ entity: 'books', itemId: '1', to: '/books/1/edit' })
    edit.wrapper.unmount()
    const show = await mountWith(QdFavoriteStar, { label: 'Dune', kind: 'item', entity: 'books', itemId: '1' }, '/books/1')
    expect(show.wrapper.find('[data-favorite-star]').attributes('aria-pressed')).toBe('true')
    await show.favorites.forgetItem('books', '1')
    expect(managers.favorites.rows).toEqual([])
  })

  it("PageHeader draws the star with the page's title, only when asked", async () => {
    const off = await mountWith(PageHeader, { title: 'Books' })
    expect(off.wrapper.find('[data-favorite-star]').exists()).toBe(false)
    off.wrapper.unmount()
    const on = await mountWith(PageHeader, { titleParts: { action: 'Edit', entityName: 'Book', entityLabel: 'Dune' }, favorite: { kind: 'item' } })
    expect(on.wrapper.find('[data-favorite-star]').attributes('aria-label')).toBe('Add Dune to favourites')
  })

  it('"Save this search" asks for a name and keeps the list with its query', async () => {
    const { wrapper, favorites } = await mountWith(QdSaveSearch, { defaultName: 'Sci-fi', entity: 'books' }, '/books?books.genre=sci-fi&run=xyz')
    await wrapper.find('[data-save-search]').trigger('click')
    const input = wrapper.find('input')
    expect(input.element.value).toBe('Sci-fi')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('Sci-fi to read')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(favorites.list.value).toEqual([expect.objectContaining({ kind: 'search', label: 'Sci-fi to read', to: '/books?books.genre=sci-fi', entity: 'books' })])
    expect(wrapper.find('[data-save-search]').text()).toBe('Search saved')
  })
})

describe('recents (#5349)', () => {
  it('the last one first, once each, at most 20; a deleted record leaves', async () => {
    const { recent } = await mountWith({ render: () => null })
    for (let i = 0; i < 25; i++) {
      await recent.record({ entity: 'books', itemId: String(i), label: `Book ${i}`, to: `/books/${i}` })
      await new Promise((r) => setTimeout(r, 1))
    }
    await recent.record({ entity: 'books', itemId: '20', label: 'Book 20', to: '/books/20' })
    expect(recent.list.value.length).toBe(RECENT_MAX)
    expect(managers.recents.rows.length).toBe(RECENT_MAX)
    expect(recent.list.value.slice(0, 2).map((r) => r.itemId)).toEqual(['20', '24'])
    expect(recent.list.value.filter((r) => r.itemId === '20').length).toBe(1)
    await recent.forget('books', 20)
    expect(recent.list.value.some((r) => r.itemId === '20')).toBe(false)
    expect(managers.recents.rows.some((r) => r.itemId === '20')).toBe(false)
  })
})

describe('the favorites and recent cards (#5349)', () => {
  it('read the favourites live, grouped by kind', async () => {
    const { wrapper, favorites } = await mountWith(QdFavoritesCard)
    expect(wrapper.find('.qd-card-empty').exists()).toBe(true)
    await favorites.add({ kind: 'item', label: 'Dune', to: '/books/1' })
    await favorites.add({ kind: 'search', label: 'Sci-fi', to: '/books?g=sci-fi' })
    await flushPromises()
    expect(wrapper.findAll('.qd-favorites-kind').map((k) => k.text())).toEqual(['core.favorites.kind.item', 'core.favorites.kind.search'])
    expect(wrapper.findAll('.qd-favorites-link').map((a) => a.attributes('href')).sort()).toEqual(['/books/1', '/books?g=sci-fi'])
  })

  it('say there is no entity rather than nothing', async () => {
    delete managers.favorites
    const { wrapper } = await mountWith(QdFavoritesCard)
    expect(wrapper.find('.qd-card-empty').text()).toContain('No favorites entity is declared')
  })

  it('read the recents live, with when', async () => {
    const { wrapper, recent } = await mountWith(QdRecentCard)
    await recent.record({ entity: 'books', itemId: '1', label: 'Dune', to: '/books/1' })
    await flushPromises()
    expect(wrapper.find('.qd-recent-label').text()).toBe('Dune')
    expect(wrapper.find('.qd-recent-when').exists()).toBe(true)
  })
})

describe('removing a favourite from its card, the card icon (#5392)', () => {
  it('a × removes the line at once; it stays where it was, saying so, with an Undo that puts it back', async () => {
    managers.favorites.rows.push(
      { id: 'f1', kind: 'item', label: 'Dune', to: '/books/1', entity: 'books', itemId: '1', at: '2026-11-19T10:00:00Z' },
      { id: 'f2', kind: 'item', label: 'Emma', to: '/books/2', at: '2026-11-19T11:00:00Z' }
    )
    const { wrapper, favorites } = await mountWith(QdFavoritesCard)
    const removeDune = wrapper.find('[data-favorite="f1"] [data-favorite-remove]')
    expect(removeDune.attributes('aria-label')).toBe('Remove Dune from favourites')
    await removeDune.trigger('click')
    await flushPromises()
    expect(managers.favorites.calls).toContainEqual(['delete', 'f1'])
    expect(favorites.list.value.map((f) => f.label)).toEqual(['Emma'])
    const line = wrapper.find('[data-favorite="f1"]')
    expect(line.attributes('data-removed')).toBe('true')
    expect(line.text()).toContain('Dune removed from favourites')
    // Where it was: after Emma, the latest first
    expect(wrapper.findAll('[data-favorite]').map((l) => l.attributes('data-favorite'))).toEqual(['f2', 'f1'])
    expect(document.activeElement?.hasAttribute('data-favorite-undo')).toBe(true)

    await line.find('[data-favorite-undo]').trigger('click')
    await flushPromises()
    expect(managers.favorites.calls.at(-1)).toEqual(['create', expect.objectContaining({ label: 'Dune', to: '/books/1', entity: 'books', itemId: '1' })])
    expect(wrapper.find('[data-removed]').exists()).toBe(false)
    expect(wrapper.findAll('.qd-favorites-label').map((l) => l.text()).sort()).toEqual(['Dune', 'Emma'])
    wrapper.unmount()
  })

  it('the last one removed: the card keeps its line and its Undo, not the empty state', async () => {
    managers.favorites.rows.push({ id: 'f1', kind: 'list', label: 'Books', to: '/books', at: '2026-11-19T10:00:00Z' })
    const { wrapper } = await mountWith(QdFavoritesCard)
    await wrapper.find('[data-favorite-remove]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.qd-card-empty').exists()).toBe(false)
    expect(wrapper.find('[data-favorite-undo]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('a failed removal: the line is back, no Undo', async () => {
    managers.favorites.rows.push({ id: 'f1', kind: 'list', label: 'Books', to: '/books', at: '2026-11-19T10:00:00Z' })
    managers.favorites.delete = async () => {
      throw new Error('offline')
    }
    const { wrapper } = await mountWith(QdFavoritesCard)
    await wrapper.find('[data-favorite-remove]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-favorite-undo]').exists()).toBe(false)
    expect(wrapper.find('.qd-favorites-label').text()).toBe('Books')
    wrapper.unmount()
  })

  it('no × without removable: data of a board of its own has no dead button', async () => {
    managers.favorites.rows.push({ id: 'f1', kind: 'list', label: 'Books', to: '/books', at: '2026-11-19T10:00:00Z' })
    const { wrapper } = await mountWith(QdFavoritesCard, { removable: false })
    expect(wrapper.find('[data-favorite-remove]').exists()).toBe(false)
  })

  it("a card shows its type's icon; the envelope changes it, or hides it with null", async () => {
    const { wrapper } = await mountWith(QdFavoritesCard)
    expect(wrapper.find('.qd-card-title .qd-card-icon').classes()).toEqual(expect.arrayContaining(['pi', 'pi-star']))
    wrapper.unmount()
    const other = await mountWith(QdFavoritesCard, { icon: 'pi pi-heart' })
    expect(other.wrapper.find('.qd-card-icon').classes()).toContain('pi-heart')
    other.wrapper.unmount()
    const none = await mountWith(QdFavoritesCard, { icon: null })
    expect(none.wrapper.find('.qd-card-icon').exists()).toBe(false)
  })

  it("a record's page shows no star before its record is read; then its label, or its id", async () => {
    const before = await mountWith(PageHeader, { titleParts: { action: 'View', entityName: 'Task' }, favorite: { kind: 'item', entity: 'tasks', itemId: 7 } })
    expect(before.wrapper.find('[data-favorite-star]').exists()).toBe(false)
    before.wrapper.unmount()
    const named = await mountWith(PageHeader, { titleParts: { action: 'View', entityName: 'Task', entityLabel: 'Ship it' }, favorite: { kind: 'item', entity: 'tasks', itemId: 7, ready: true } })
    expect(named.wrapper.find('[data-favorite-star]').attributes('aria-label')).toBe('Add Ship it to favourites')
    named.wrapper.unmount()
    const bare = await mountWith(PageHeader, { titleParts: { action: 'View', entityName: 'Task' }, favorite: { kind: 'item', entity: 'tasks', itemId: 7, ready: true } })
    expect(bare.wrapper.find('[data-favorite-star]').attributes('aria-label')).toBe('Add Task #7 to favourites')
  })
})

/**
 * What docs/i18n.md promised and the code did not do (#4686): entity labels
 * and select options from the catalogue, Yes / No, action labels and the
 * "Actions" header that follow a locale change, and the locale kept across a
 * reload.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, computed, nextTick } from 'vue'
import { I18n } from '../../src/i18n/I18n'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'
import { EntityManager } from '../../src/entity/EntityManager'
import { Orchestrator } from '../../src/orchestrator/Orchestrator'
import { translateOptions } from '../../src/i18n/optionLabels'
import { Kernel } from '../../src/kernel/Kernel'
import ShowDisplay from '../../src/components/show/ShowDisplay.vue'

window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))

const MESSAGES = {
  en: { entities: { books: { label: 'Book', labelPlural: 'Books', fields: { genre: { _label: 'Genre', options: { 'non-fiction': 'Non-Fiction' } } } } } },
  fr: { entities: { books: { label: 'Livre', labelPlural: 'Livres', fields: { genre: { _label: 'Genre', options: { 'non-fiction': 'Documentaire' } } } } } },
}

async function catalogue() {
  const i18n = new I18n({ defaultLocale: 'en', messages: MESSAGES })
  await i18n.bootstrap()
  return i18n
}

describe('entity labels from the catalogue (#4686)', () => {
  it('label and labelPlural read entities.<name>.*, over the label option, and follow the locale', async () => {
    const i18n = await catalogue()
    const orchestrator = new Orchestrator()
    orchestrator.i18n = i18n
    const books = new EntityManager({ name: 'books', label: 'Volume' })
    orchestrator.register('books', books)
    const title = computed(() => books.labelPlural)
    expect(books.label).toBe('Book')
    expect(title.value).toBe('Books')
    await i18n.changeLocale('fr')
    expect(title.value).toBe('Livres')
  })

  it('without a key, the label option, then the name', async () => {
    const orchestrator = new Orchestrator()
    orchestrator.i18n = await catalogue()
    const loans = new EntityManager({ name: 'loans', label: 'Borrowing' })
    orchestrator.register('loans', loans)
    expect(loans.label).toBe('Borrowing')
    expect(loans.labelPlural).toBe('Loans')
  })
})

describe('select options from the catalogue (#4686)', () => {
  it('entities.<e>.fields.<f>.options.<value>, else the declared label, again after a locale change', async () => {
    const i18n = await catalogue()
    const declared = [{ label: 'Non fiction', value: 'non-fiction' }, { label: 'Poetry', value: 'poetry' }]
    const en = translateOptions(i18n, 'books', 'genre', declared)
    expect(en.map((o) => o.label)).toEqual(['Non-Fiction', 'Poetry'])
    await i18n.changeLocale('fr')
    // From the already translated list: the declared label is kept aside
    expect(translateOptions(i18n, 'books', 'genre', en).map((o) => o.label)).toEqual(['Documentaire', 'Poetry'])
  })

  it('a list cell (a field naming its entity) shows the translated option', async () => {
    const i18n = await catalogue()
    await i18n.changeLocale('fr')
    const field = { name: 'genre', type: 'select', entity: 'books', options: [{ label: 'Non fiction', value: 'non-fiction' }] }
    const w = mount(ShowDisplay, { props: { field, value: 'non-fiction' }, global: { provide: { [I18N_INJECTION_KEY]: i18n }, stubs: { RouterLink: true } } })
    expect(w.text()).toBe('Documentaire')
  })
})

describe('Yes and No (#4686)', () => {
  it('come from the catalogue', async () => {
    const i18n = new I18n({ defaultLocale: 'fr' })
    await i18n.bootstrap()
    const show = (value) =>
      mount(ShowDisplay, { props: { field: { name: 'active', type: 'boolean' }, value }, global: { provide: { [I18N_INJECTION_KEY]: i18n }, stubs: { RouterLink: true } } }).text()
    expect(show(true)).toBe('Oui')
    expect(show(false)).toBe('Non')
  })
})

describe('the locale is kept across a reload (#4686)', () => {
  beforeEach(() => localStorage.clear())

  async function boot(options = {}) {
    const kernel = new Kernel({ root: {}, moduleDefs: [], app: { name: 'Cockpit X' }, ...options })
    kernel._createSignalBus()
    kernel._createI18n()
    await kernel._bootstrapI18n()
    return kernel
  }

  it('a locale chosen once comes back on the next load, per app', async () => {
    const first = await boot()
    await first.signals.emit('locale:change', 'fr')
    await flushPromises()
    expect(localStorage.getItem('qdadm.locale.cockpit-x')).toBe('fr')
    const second = await boot()
    expect(second.i18n.locale.value).toBe('fr')
  })

  it('rememberLocale: false keeps nothing', async () => {
    const first = await boot({ i18n: { rememberLocale: false } })
    await first.signals.emit('locale:change', 'fr')
    await flushPromises()
    expect(first.i18n.locale.value).toBe('fr')
    expect(localStorage.getItem('qdadm.locale.cockpit-x')).toBeNull()
  })
})

describe('labels that follow a locale change (#4686)', () => {
  it("ListPage's Actions header and the list's tooltips read the catalogue at render", async () => {
    const { default: ListPage } = await import('../../src/components/lists/ListPage.vue')
    const PrimeVue = (await import('primevue/config')).default
    const i18n = new I18n({ defaultLocale: 'en', messages: { fr: { core: { table: { actions: 'Gestes' } } } } })
    await i18n.bootstrap()
    const w = mount(
      defineComponent({ render: () => h(ListPage, { items: [{ id: 1 }], getActions: () => [] }) }),
      { global: { plugins: [PrimeVue], provide: { [I18N_INJECTION_KEY]: i18n }, directives: { tooltip: {} } } }
    )
    expect(w.findAll('th').map((th) => th.text())).toContain('Actions')
    await i18n.changeLocale('fr')
    await nextTick()
    expect(w.findAll('th').map((th) => th.text())).toContain('Gestes')
  })
})

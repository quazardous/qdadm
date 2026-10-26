/**
 * YAML editors (#4303): VanillaYamlEditor binds the vanilla-yamleditor text
 * to v-model; YamlConfigEditor loads, checks, shows the diff, requires a
 * reason, saves against the revision, handles a conflict and restores from
 * the history. restYamlAdapter speaks the REST contract.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import VanillaYamlEditor from '../../src/components/editors/yaml/VanillaYamlEditor.vue'
import YamlConfigEditor from '../../src/components/editors/yaml/YamlConfigEditor.vue'
import { restYamlAdapter, YamlConflictError, normalizeProblemPath } from '../../src/components/editors/yaml/yamlConfigAdapter'

vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))

// jsdom has no layout: CodeMirror measures text ranges, revealPath scrolls to the field
Range.prototype.getClientRects ??= () => []
Range.prototype.getBoundingClientRect ??= () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })
Element.prototype.scrollIntoView ??= () => {}

const YAML = `# stores
stores:
  paris:
    enabled: true   # live
    min_stock: 3
`
const SCHEMA = {
  type: 'object',
  properties: {
    stores: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: { enabled: { type: 'boolean' }, min_stock: { type: 'integer', minimum: 0, title: 'Minimum stock' } },
      },
    },
  },
}

const stubs = {
  SimpleDialog: {
    props: ['visible', 'title', 'confirmDisabled', 'showConfirm'],
    emits: ['confirm', 'update:visible'],
    template: `<div v-if="visible" class="dialog" :data-title="title"><slot /><slot name="actions" />
      <button v-if="showConfirm !== false" class="confirm" :disabled="confirmDisabled" @click="$emit('confirm')">ok</button></div>`,
  },
  QdButton: { props: ['label', 'disabled'], template: '<button class="btn" :disabled="disabled">{{ label }}</button>' },
  QdMessage: { props: ['severity'], template: '<div class="msg" :data-severity="severity"><slot /></div>' },
  Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea class="reason" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  PayloadDiff: { props: ['left', 'right'], template: '<pre class="diff">{{ left }}|||{{ right }}</pre>' },
}

const mounted = []
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  document.body.replaceChildren()
})

function mountConfig(adapter, props = {}) {
  const w = mount(YamlConfigEditor, { props: { adapter, ...props }, global: { stubs }, attachTo: document.body })
  mounted.push(w)
  return w
}

const button = (w, label) => w.findAll('button.btn').find((b) => b.text() === label)
const field = (w, path) => w.find(`[data-path="${path}"]`)

function makeAdapter(overrides = {}) {
  return {
    load: vi.fn(async () => ({ yaml: YAML, schema: SCHEMA, revision: 'r1' })),
    check: vi.fn(async () => []),
    save: vi.fn(async () => ({ revision: 'r2' })),
    history: vi.fn(async () => [
      { revision: 'r1', author: 'ana', date: '2026-10-20T10:00:00Z', reason: 'first', before: '', after: 'stores: {}\n' },
    ]),
    ...overrides,
  }
}

async function editMinStock(w, value) {
  const input = field(w, 'stores.paris.min_stock').find('input')
  input.element.value = value
  await input.trigger('change')
  await nextTick()
}

describe('VanillaYamlEditor (#4303)', () => {
  it('binds the text to v-model and follows outside changes', async () => {
    const model = ref(YAML)
    const w = mount(VanillaYamlEditor, {
      props: { modelValue: model.value, schema: SCHEMA, 'onUpdate:modelValue': (v) => (model.value = v) },
      attachTo: document.body,
    })
    mounted.push(w)
    await nextTick()
    expect(field(w, 'stores.paris.min_stock').find('.vye-key').text()).toBe('Minimum stock')
    await editMinStock(w, '9')
    expect(model.value).toBe(YAML.replace('min_stock: 3', 'min_stock: 9'))
    await w.setProps({ modelValue: YAML.replace('enabled: true', 'enabled: false') })
    expect(field(w, 'stores.paris.enabled').find('input').element.checked).toBe(false)
  })

  it('shows external problems on their field', async () => {
    const w = mount(VanillaYamlEditor, { props: { modelValue: YAML, problems: [{ path: ['stores', 'paris', 'enabled'], message: 'server says no' }] }, attachTo: document.body })
    mounted.push(w)
    await nextTick()
    expect(field(w, 'stores.paris.enabled').find('.vye-problem').text()).toBe('server says no')
  })
})

describe('YamlConfigEditor (#4303)', () => {
  it('loads, then saves through check → diff → reason, against the revision', async () => {
    const adapter = makeAdapter()
    const saved = vi.fn()
    const w = mountConfig(adapter, { onSaved: saved })
    await flushPromises()
    expect(adapter.load).toHaveBeenCalledOnce()
    expect(button(w, 'Save…').attributes('disabled')).toBeDefined()

    await editMinStock(w, '5')
    expect(w.find('.qd-yaml-config-state').text()).toBe('Unsaved changes')
    await button(w, 'Save…').trigger('click')
    await flushPromises()
    expect(adapter.check).toHaveBeenCalledWith(YAML.replace('min_stock: 3', 'min_stock: 5'))

    const dialog = w.find('.dialog[data-title="Review the change"]')
    expect(dialog.find('.diff').text()).toContain('min_stock: 3')
    expect(dialog.find('.diff').text()).toContain('min_stock: 5')
    // A reason is required
    expect(dialog.find('button.confirm').attributes('disabled')).toBeDefined()
    await dialog.find('textarea.reason').setValue('more stock for the sale')
    await dialog.find('button.confirm').trigger('click')
    await flushPromises()

    expect(adapter.save).toHaveBeenCalledWith({ yaml: YAML.replace('min_stock: 3', 'min_stock: 5'), reason: 'more stock for the sale', revision: 'r1' })
    expect(saved).toHaveBeenCalledWith({ yaml: YAML.replace('min_stock: 3', 'min_stock: 5'), reason: 'more stock for the sale', revision: 'r2' })
    expect(w.find('.qd-yaml-config-state').text()).toBe('Up to date')
    expect(w.find('.msg').text()).toBe('Saved')
  })

  it('server problems block the save and show on the field', async () => {
    const adapter = makeAdapter({ check: vi.fn(async () => [{ path: ['stores', 'paris', 'min_stock'], message: 'too low for Paris' }]) })
    const w = mountConfig(adapter)
    await flushPromises()
    await editMinStock(w, '1')
    await button(w, 'Save…').trigger('click')
    await flushPromises()
    expect(w.find('.dialog').exists()).toBe(false)
    expect(w.find('.msg').text()).toBe('1 problem — stores.paris.min_stock: too low for Paris')
    expect(field(w, 'stores.paris.min_stock').find('.vye-problem').text()).toBe('too low for Paris')
    expect(adapter.save).not.toHaveBeenCalled()
  })

  it('schema problems block the save too', async () => {
    const adapter = makeAdapter()
    const w = mountConfig(adapter)
    await flushPromises()
    await editMinStock(w, '-2')
    await button(w, 'Save…').trigger('click')
    await flushPromises()
    expect(w.find('.dialog').exists()).toBe(false)
    expect(w.find('.msg').text()).toBe('1 problem — stores.paris.min_stock: Must be ≥ 0')
  })

  it('a conflict shows both versions; keep mine saves over their revision', async () => {
    const theirs = YAML.replace('enabled: true', 'enabled: false')
    const save = vi.fn().mockRejectedValueOnce(new YamlConflictError({ yaml: theirs, revision: 'r9' })).mockResolvedValueOnce({ revision: 'r10' })
    const w = mountConfig(makeAdapter({ save }))
    await flushPromises()
    await editMinStock(w, '5')
    await button(w, 'Save…').trigger('click')
    await flushPromises()
    await w.find('textarea.reason').setValue('why')
    await w.find('button.confirm').trigger('click')
    await flushPromises()

    const conflict = w.find('.dialog[data-title="Changed meanwhile"]')
    expect(conflict.find('.diff').text()).toContain('enabled: false')
    await button(w, 'Keep mine and save over it').trigger('click')
    await flushPromises()
    await w.find('textarea.reason').setValue('why again')
    await w.find('button.confirm').trigger('click')
    await flushPromises()
    expect(save.mock.calls[1][0].revision).toBe('r9')
  })

  it('loads a version from the history, to be saved again', async () => {
    const adapter = makeAdapter()
    const w = mountConfig(adapter)
    await flushPromises()
    await button(w, 'History').trigger('click')
    await flushPromises()
    expect(w.find('.qd-yaml-history-entry').text()).toContain('first')
    expect(w.find('.qd-yaml-history-entry').text()).toContain('ana')
    await button(w, 'Load this version').trigger('click')
    await flushPromises()
    expect(w.find('.qd-yaml-config-state').text()).toBe('Unsaved changes')
    expect(w.find('.msg').text()).toContain('r1')
  })

  it('read only from the server: no save, no check', async () => {
    const w = mountConfig(makeAdapter({ load: vi.fn(async () => ({ yaml: YAML, readOnly: true })) }))
    await flushPromises()
    expect(button(w, 'Save…')).toBeUndefined()
    expect(button(w, 'Check')).toBeUndefined()
    expect(w.find('.qd-yaml-config-state').text()).toBe('Read only')
  })
})

describe('restYamlAdapter (#4303)', () => {
  const json = (status, body) => ({ ok: status < 400, status, statusText: '', text: async () => JSON.stringify(body) })

  it('speaks the contract, with ?path=', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(200, { yaml: 'a: 1\n', revision: 3 }))
      .mockResolvedValueOnce(json(200, { problems: [{ path: 'a.b[0]', message: 'no' }] }))
      .mockResolvedValueOnce(json(200, { revision: 4 }))
      .mockResolvedValueOnce(json(200, [{ revision: 3, after: 'a: 1\n' }]))
    const adapter = restYamlAdapter('/api/conf/', { fetch, path: ['filters', 'paris'] })
    expect(await adapter.load()).toEqual({ yaml: 'a: 1\n', revision: 3, schema: undefined, readOnly: undefined })
    expect(await adapter.check('a: 2\n')).toEqual([{ path: ['a', 'b', 0], message: 'no', severity: 'error' }])
    expect(await adapter.save({ yaml: 'a: 2\n', reason: 'r', revision: 3 })).toEqual({ revision: 4 })
    expect((await adapter.history())[0].revision).toBe(3)
    expect(fetch.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)).toEqual([
      'GET /api/conf?path=filters.paris',
      'POST /api/conf/check?path=filters.paris',
      'PUT /api/conf?path=filters.paris',
      'GET /api/conf/history?path=filters.paris',
    ])
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ yaml: 'a: 2\n', reason: 'r', revision: 3 })
  })

  it('turns a 409 into a YamlConflictError carrying the server version', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(409, { yaml: 'b: 1\n', revision: 9 }))
    const err = await restYamlAdapter('/api/conf', { fetch }).save({ yaml: 'x', reason: 'r', revision: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(YamlConflictError)
    expect(err.current).toMatchObject({ yaml: 'b: 1\n', revision: 9 })
  })

  it('surfaces the server message on an error', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(403, { message: 'not allowed' }))
    await expect(restYamlAdapter('/x', { fetch }).load()).rejects.toThrow('not allowed')
  })

  it('reads problem paths in the usual shapes', () => {
    expect(normalizeProblemPath('a.b[2].c')).toEqual(['a', 'b', 2, 'c'])
    expect(normalizeProblemPath('/a/0')).toEqual(['a', 0])
    expect(normalizeProblemPath(['a', '1'])).toEqual(['a', 1])
  })
})

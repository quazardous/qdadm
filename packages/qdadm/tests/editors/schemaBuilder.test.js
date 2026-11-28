/**
 * The schema builder (#5587): the document's structure read from its JSON
 * Schema, generic x-… annotations, the app's handlers; every edit a patch.
 *
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { parse } from 'yaml'
import QdSchemaBuilder from '../../src/components/editors/yaml/schema/QdSchemaBuilder.vue'
import { sectionsOf, fieldKind, conditionTypes, resolverOf, newItem, addListItem, defaultFor } from '../../src/components/editors/yaml/schema/schemaModel'

export const SCHEMA = {
  type: 'object',
  properties: {
    preprocess: {
      title: 'Preprocessing',
      type: 'array',
      items: {
        type: 'object',
        'x-title': 'name',
        'x-enabled': 'enabled',
        required: ['name', 'match'],
        properties: {
          name: { type: 'string' },
          enabled: { type: 'boolean' },
          when: { $ref: '#/$defs/when' },
          match: { type: 'string', title: 'Matches', 'x-widget': 'regex' },
          message: { type: 'string', title: 'Message' },
          extract: {
            type: 'object',
            title: 'Targets',
            propertyNames: { enum: ['supplier', 'host'] },
            additionalProperties: { type: 'string', examples: ['{script|dir}', '{host}'] },
            'x-enumLabels': { supplier: 'Supplier' },
          },
          split: { type: 'boolean', title: 'Split' },
        },
      },
    },
    rules: {
      title: 'Rules',
      type: 'array',
      items: {
        type: 'object',
        'x-title': 'name',
        properties: {
          name: { type: 'string' },
          when: { $ref: '#/$defs/when' },
          then: {
            type: 'object',
            title: 'Then',
            properties: {
              route: { type: 'string', title: 'Route', examples: ['it', 'purchases.b2b'] },
              show: { type: 'array', title: 'Show', items: { type: 'string' } },
            },
          },
        },
      },
    },
    version: { type: 'integer' },
    hidden: { type: 'array', 'x-section': false, items: { type: 'object', properties: { a: { type: 'string' } } } },
  },
  $defs: {
    when: { 'x-widget': 'conditions', oneOf: [{ $ref: '#/$defs/condition' }, { $ref: '#/$defs/group' }] },
    group: {
      oneOf: [
        { type: 'object', required: ['all'], properties: { all: { type: 'array', items: { $ref: '#/$defs/when' } } } },
        { type: 'object', required: ['any'], properties: { any: { type: 'array', items: { $ref: '#/$defs/when' } } } },
      ],
    },
    condition: {
      oneOf: [
        { title: 'Channel', type: 'object', required: ['channel'], properties: { channel: { type: 'string', examples: ['supplier.sftp', 'supplier.price'] } } },
        { title: 'Kind', type: 'object', required: ['kind'], properties: { kind: { enum: ['warning', 'error'] } } },
      ],
    },
  },
}

export const YAML = `# log rules
preprocess:
  # sftp refusals
  - name: sftp refusé
    when: { channel: supplier.sftp }
    match: 'connexion sftp refusée'
    extract: { supplier: '{script|dir}' } # who failed
    split: true
rules:
  - name: prix d'achat invalide
    when: { all: [ { channel: supplier.price }, { kind: warning } ] }
    then: { route: purchases.b2b, show: [id_product] }
`

describe('the schema read (#5587)', () => {
  it('sections: the root lists of objects, x-section: false left out', () => {
    expect(sectionsOf(SCHEMA).map((s) => [s.key, s.label])).toEqual([['preprocess', 'Preprocessing'], ['rules', 'Rules']])
    expect(sectionsOf({ type: 'array', items: { type: 'object', properties: { a: {} } } }).map((s) => s.path)).toEqual([[]])
  })

  it('fields by schema; an app handler wins; an unknown widget is raw', () => {
    const items = sectionsOf(SCHEMA)[0].items
    const k = (key, handlers = []) => fieldKind(items.properties[key], SCHEMA, handlers).kind
    expect(k('message')).toBe('param')
    expect(k('split')).toBe('param')
    expect(k('extract')).toBe('keyTable')
    expect(k('when')).toBe('conditions')
    expect(k('match')).toBe('raw')
    expect(k('match', ['regex'])).toBe('handler')
    const rules = sectionsOf(SCHEMA)[1].items
    expect(fieldKind(rules.properties.then, SCHEMA).kind).toBe('object')
    expect(fieldKind(rules.properties.then.properties.show, SCHEMA).kind).toBe('list')
    expect(fieldKind(rules.properties.then.properties.route, SCHEMA)).toEqual({ kind: 'param', param: { type: 'text', suggestions: ['it', 'purchases.b2b'] } })
  })

  it('the key table: its keys, labels and value suggestions', () => {
    const kt = fieldKind(sectionsOf(SCHEMA)[0].items.properties.extract, SCHEMA)
    expect(kt).toEqual({ kind: 'keyTable', keys: [{ value: 'supplier', label: 'Supplier' }, { value: 'host' }], free: false, suggestions: ['{script|dir}', '{host}'] })
  })

  it('the condition types of a tree, through refs and groups', () => {
    const resolve = resolverOf(SCHEMA)
    const types = conditionTypes(resolve(SCHEMA.$defs.when), resolve)
    expect(Object.keys(types)).toEqual(['channel', 'kind'])
    expect(types.channel.param).toEqual({ type: 'text', suggestions: ['supplier.sftp', 'supplier.price'] })
    expect(types.kind.param.type).toBe('enum')
  })

  it('a new item: its title, its required keys', () => {
    const items = sectionsOf(SCHEMA)[0].items
    expect(newItem(items, SCHEMA, 'New')).toEqual({ name: 'New', match: '' })
    expect(defaultFor(items.properties.when, SCHEMA)).toEqual({ all: [] })
  })

  it('an item added to a list, a missing list, an empty document', () => {
    expect(parse(addListItem(YAML, ['rules'], { name: 'x' })).rules).toHaveLength(2)
    const noRules = YAML.slice(0, YAML.indexOf('rules:'))
    const out = addListItem(noRules, ['rules'], { name: 'x' })
    expect(parse(out).rules).toEqual([{ name: 'x' }])
    expect(out).toContain('# sftp refusals')
    expect(parse(addListItem('', ['rules'], { name: 'x' }))).toEqual({ rules: [{ name: 'x' }] })
  })
})

describe('QdSchemaBuilder (#5587)', () => {
  const mounted = []
  afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))
  const Regex = defineComponent({
    props: ['value', 'path', 'schema', 'readOnly'],
    emits: ['update', 'apply'],
    setup: (p, { emit }) => () => h('input', { class: 'regex', value: p.value, 'data-title': p.schema.title, onChange: (e) => emit('update', e.target.value) }),
  })
  function build(yaml = YAML, handlers = { regex: Regex }) {
    let text = yaml
    const w = mount(QdSchemaBuilder, {
      props: { modelValue: text, schema: SCHEMA, handlers, 'onUpdate:modelValue': (v) => { text = v; w.setProps({ modelValue: v }) } },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, text: () => text }
  }
  const change = async (el, value) => {
    el.element.value = value
    await el.trigger('change')
    await flushPromises()
  }

  it('two sections as tabs, the first shown: its cards, titles and fields', () => {
    const { w } = build()
    expect(w.findAll('[data-section-tab]').map((b) => b.text())).toEqual(['Preprocessing 1', 'Rules 1'])
    expect(w.find('[data-item-title]').element.value).toBe('sftp refusé')
    expect(w.findAll('[data-item="0"] [data-field]').map((f) => f.attributes('data-field'))).toEqual(['when', 'match', 'extract', 'split'])
    // the app's handler draws `match`, with its schema
    expect(w.find('input.regex').attributes('data-title')).toBe('Matches')
    // `message` is optional and absent: offered
    expect(w.find('[data-add-field]').findAll('option').map((o) => o.text())).toContain('Message')
  })

  it('a key table value changed: one line, its comment kept', async () => {
    const { w, text } = build()
    await change(w.find('[data-key="supplier"] [data-key-value]'), '{script}')
    expect(text()).toContain("extract: { supplier: '{script}' } # who failed")
    expect(text()).toContain('# sftp refusals')
  })

  it('a key added from the list; the handler writes its value', async () => {
    const { w, text } = build()
    await change(w.find('[data-add-key]'), 'host')
    expect(parse(text()).preprocess[0].extract).toEqual({ supplier: '{script|dir}', host: '' })
    await change(w.find('input.regex'), 'refus(é|e)')
    expect(parse(text()).preprocess[0].match).toBe('refus(é|e)')
  })

  it('a bare condition: drawn as one, wrapped in all when one is added', async () => {
    const { w, text } = build()
    expect(w.find('[data-field="when"] [data-bare]').exists()).toBe(true)
    await change(w.find('[data-field="when"] [data-add-condition]'), 'kind')
    expect(parse(text()).preprocess[0].when).toEqual({ all: [{ channel: 'supplier.sftp' }, { kind: 'warning' }] })
  })

  it('the second section: a nested object, a list, an item added; a field added', async () => {
    const { w, text } = build()
    await w.find('[data-section-tab="rules"]').trigger('click')
    expect(w.find('[data-field="then"] [data-field="route"]').exists()).toBe(true)
    expect(w.findAll('[data-field="show"] [data-entry]')).toHaveLength(1)
    await w.find('[data-field="show"] [data-add-entry]').trigger('click')
    await flushPromises()
    expect(parse(text()).rules[0].then.show).toEqual(['id_product', ''])
    await w.find('[data-item-add]').trigger('click')
    await flushPromises()
    expect(parse(text()).rules.map((r) => r.name)).toEqual(["prix d'achat invalide", 'New item'])
    await w.find('[data-section-tab="preprocess"]').trigger('click')
    await change(w.find('[data-add-field]'), 'message')
    expect(parse(text()).preprocess[0].message).toBe('')
    expect(text()).toContain('# log rules')
  })

  it('switched off: enabled: false written', async () => {
    const { w, text } = build()
    await w.find('[data-item-enabled]').setValue(false)
    await flushPromises()
    expect(parse(text()).preprocess[0].enabled).toBe(false)
  })

  it('without the handler: match shows as YAML, with « Edit in the text »', () => {
    const { w } = build(YAML, {})
    expect(w.find('[data-field="match"] [data-rule-raw]').exists()).toBe(true)
  })
})

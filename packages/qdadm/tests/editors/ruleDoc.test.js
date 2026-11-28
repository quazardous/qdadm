/**
 * The rule builder's edits keep the file as written (#5581): comments, key
 * order, flow maps; only what is touched changes.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { parse } from 'yaml'
import { moveItem, duplicateItem, addRule, removeAt, setAt, renameKeyAt, setEnabled, addItemAt } from '../../src/components/editors/yaml/rules/ruleDoc'
import { parseThreshold, formatThreshold, fitsParam, vocabularyFromSchema, defaultParam } from '../../src/components/editors/yaml/rules/vocabulary'

const RULES = `# routing rules
# les achats B2B : le prix fournisseur, pas l'IT
- name: prix d'achat invalide
  when:
    all:
      - channel: supplier.price
      - any:
          - measure: { refused: ">= 1000" }
          - measure: { refused_ratio: ">= 20%" } # the share refused
  then:
    route: purchases.b2b
    severity: critical

# the rest goes to IT
- name: le reste
  when:
    all:
      - channel: app.warning
  then:
    route: it
`

describe('edits keep the comments (#5581)', () => {
  it('a threshold changed: one line, its comment kept', () => {
    const out = setAt(RULES, [0, 'when', 'all', 1, 'any', 1, 'measure', 'refused_ratio'], '>= 25%')
    expect(out).toContain('refused_ratio: ">= 25%" } # the share refused')
    expect(out.split('\n').filter((l, i) => l !== RULES.split('\n')[i])).toHaveLength(1)
  })

  it('a key renamed in place', () => {
    const out = renameKeyAt(RULES, [0, 'when', 'all', 1, 'any', 0, 'measure'], 'refused', 'refused_ratio')
    expect(parse(out)[0].when.all[1].any[0]).toEqual({ measure: { refused_ratio: '>= 1000' } })
    expect(out).toContain("# les achats B2B : le prix fournisseur, pas l'IT")
  })

  it('a rule moved: its comment goes with it, the file\'s head stays', () => {
    const out = moveItem(RULES, [], 1, 0)
    expect(parse(out).map((r) => r.name)).toEqual(['le reste', "prix d'achat invalide"])
    expect(out.indexOf('# the rest goes to IT')).toBeLessThan(out.indexOf('- name: le reste'))
    expect(out.startsWith('# routing rules\n')).toBe(true)
    // the blank lines stay between the rules, none at the top
    expect(out).toMatch(/route: it\n\n- name: prix/)
    expect(moveItem(out, [], 1, 0).startsWith('# routing rules\n')).toBe(true)
    // a blank line under the head: the first rule's own comment moves with it
    const spaced = RULES.replace('# routing rules\n', '# routing rules\n\n')
    const moved = moveItem(spaced, [], 1, 0)
    expect(moved.startsWith('# routing rules\n')).toBe(true)
    expect(moved.indexOf('# les achats B2B')).toBeGreaterThan(moved.indexOf('route: it'))
    expect(moved.indexOf('# les achats B2B')).toBeLessThan(moved.indexOf("- name: prix d'achat"))
    expect(out).toContain('# the share refused')
    expect(out).toContain('measure: { refused: ">= 1000" }')
  })

  it('a rule duplicated, named « (copy) », the original\'s comments kept', () => {
    const out = duplicateItem(RULES, [], 0)
    expect(parse(out).map((r) => r.name)).toEqual(["prix d'achat invalide", "prix d'achat invalide (copy)", 'le reste'])
    expect(out).toContain('# routing rules')
  })

  it('add, remove, enabled', () => {
    let out = addRule(RULES, [], { name: 'new', when: { all: [] }, then: {} }, parse(RULES))
    expect(parse(out)).toHaveLength(3)
    out = removeAt(out, [2])
    expect(parse(out)).toHaveLength(2)
    out = setEnabled(out, [1], parse(out)[1], false)
    expect(parse(out)[1].enabled).toBe(false)
    out = setEnabled(out, [1], parse(out)[1], true)
    expect(parse(out)[1].enabled).toBe(true)
    expect(out).toContain('# the rest goes to IT')
    out = addItemAt(out, [1, 'when', 'all'], { channel: 'x' })
    expect(parse(out)[1].when.all).toHaveLength(2)
  })

  it('an empty document: the list is made', () => {
    expect(parse(addRule('', [], { name: 'a' }, null))).toEqual([{ name: 'a' }])
    expect(parse(addRule('rules: null\n', ['rules'], { name: 'a' }, null))).toEqual({ rules: [{ name: 'a' }] })
  })
})

describe('the vocabulary (#5581)', () => {
  it('thresholds read and written', () => {
    expect(parseThreshold('>= 20%')).toEqual({ op: '>=', value: 20, percent: true })
    expect(parseThreshold('< 1000')).toEqual({ op: '<', value: 1000, percent: false })
    expect(parseThreshold('about 3')).toBe(null)
    expect(formatThreshold({ op: '<=', value: 5, percent: true })).toBe('<= 5%')
  })

  it('a keyed threshold fits only a one-entry map of a known key with a threshold', () => {
    const p = { type: 'keyedThreshold', keys: [{ value: 'refused' }, { value: 'refused_ratio', unit: '%' }] }
    expect(fitsParam(p, { refused: '>= 1000' })).toBe(true)
    expect(fitsParam(p, { other: '>= 1' })).toBe(false)
    expect(fitsParam(p, { refused: 'lots' })).toBe(false)
    expect(defaultParam(p)).toEqual({ refused: '>= 0' })
  })

  it('from a JSON Schema, by the convention', () => {
    const v = vocabularyFromSchema({
      type: 'array',
      $defs: {
        condition: {
          oneOf: [
            { title: 'Channel', required: ['channel'], properties: { channel: { type: 'string', enum: ['app.warning', 'supplier.price'] } } },
            { title: 'Measure', required: ['measure'], properties: { measure: { type: 'object', maxProperties: 1, propertyNames: { enum: ['refused', 'refused_ratio'] }, 'x-units': { refused_ratio: '%' } } } },
            { title: 'Min level', required: ['level'], properties: { level: { type: 'string', 'x-qd-param': 'threshold' } } },
          ],
        },
      },
      items: { properties: { then: { properties: { route: { type: 'string', title: 'Route' }, severity: { enum: ['info', 'critical'] } } } } },
    })
    expect(v.conditions.channel.param).toEqual({ type: 'enum', options: [{ value: 'app.warning' }, { value: 'supplier.price' }] })
    expect(v.conditions.measure.param).toEqual({ type: 'keyedThreshold', keys: [{ value: 'refused' }, { value: 'refused_ratio', unit: '%' }] })
    expect(v.conditions.level.param.type).toBe('threshold')
    expect(v.actions.route).toEqual({ label: 'Route', param: { type: 'text' } })
    expect(v.actions.severity.param.type).toBe('enum')
  })
})

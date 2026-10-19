/**
 * Payload helpers (#4112): detection, XML, CSV, form, masking, diff.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  detectFormat,
  prettyXml,
  piecesText,
  parseCsv,
  parseForm,
  maskKeys,
  maskJson,
  normalizeLines,
  diffLines,
  diffCsv,
  hexDump,
} from '../../src/utils/payload'

describe('detectFormat (#4112)', () => {
  it('takes the explicit format, then the content type, then sniffs', () => {
    expect(detectFormat('{"a":1}', 'text/plain', 'xml')).toBe('xml')
    expect(detectFormat('a=1', 'application/soap+xml; charset=utf-8')).toBe('xml')
    expect(detectFormat('x', 'text/csv')).toBe('csv')
    expect(detectFormat({ a: 1 })).toBe('json')
    expect(detectFormat(' [1, 2] ')).toBe('json')
    expect(detectFormat('<order id="1"/>')).toBe('xml')
    expect(detectFormat('amount=12.50&currency=EUR&token=abc')).toBe('form')
    expect(detectFormat('sku;qty;price\nA1;2;9.90\nB2;1;19.00')).toBe('csv')
    expect(detectFormat('hello world')).toBe('text')
    expect(detectFormat('{not json}')).toBe('text')
  })

  it('tells binary bytes from text bytes', () => {
    expect(detectFormat(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]))).toBe('binary')
    expect(detectFormat(new TextEncoder().encode('<a>b</a>'))).toBe('xml')
  })
})

describe('prettyXml (#4112)', () => {
  it('indents, keeps text-only elements on one line, and highlights', () => {
    const { ok, lines } = prettyXml('<?xml version="1.0"?><order id="7"><!-- c --><line sku="A1"><qty>2</qty></line><note><![CDATA[a < b]]></note><empty/></order>')
    expect(ok).toBe(true)
    expect(lines.map(piecesText)).toEqual([
      '<?xml version="1.0"?>',
      '<order id="7">',
      '  <!-- c -->',
      '  <line sku="A1">',
      '    <qty>2</qty>',
      '  </line>',
      '  <note>',
      '    <![CDATA[a < b]]>',
      '  </note>',
      '  <empty/>',
      '</order>',
    ])
    const order = lines[1]
    expect(order.find((p) => p.cls === 'pl-tag').text).toBe('order')
    expect(order.find((p) => p.cls === 'pl-value').text).toBe('"7"')
  })

  it('handles namespaces, single quotes and a SOAP envelope', () => {
    const { ok, lines } = prettyXml(`<soap:Envelope xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'><soap:Body><m:Ack>OK</m:Ack></soap:Body></soap:Envelope>`)
    expect(ok).toBe(true)
    expect(lines.map(piecesText)[2]).toBe('    <m:Ack>OK</m:Ack>')
  })

  it('falls back to the raw text on broken XML', () => {
    expect(prettyXml('<a><b></a>')).toMatchObject({ ok: false, error: '</a> does not close <b>' })
    expect(prettyXml('<a>')).toMatchObject({ ok: false, error: '<a> is never closed' })
    expect(prettyXml('<a>\n<b').lines.map(piecesText)).toEqual(['<a>', '<b'])
  })

  it('masks element text and attributes', () => {
    const mask = maskKeys(['password', 'token'])
    const text = prettyXml('<auth token="t0k3n"><user>bob</user><password>hunter2</password></auth>', mask).lines.map(piecesText)
    expect(text).toEqual(['<auth token="••••••">', '  <user>bob</user>', '  <password>••••••</password>', '</auth>'])
  })
})

describe('CSV and form (#4112)', () => {
  it('reads quoted fields, doubled quotes and fields over two lines', () => {
    const { separator, rows } = parseCsv('sku,label,qty\nA1,"Mug, blue",2\nB2,"He said ""hi""\nthen left",1')
    expect(separator).toBe(',')
    expect(rows).toEqual([
      ['sku', 'label', 'qty'],
      ['A1', 'Mug, blue', '2'],
      ['B2', 'He said "hi"\nthen left', '1'],
    ])
  })

  it('decodes a form and masks by key', () => {
    expect(parseForm('amount=12.50&card_number=4111111111111111&label=caf%C3%A9+cr%C3%A8me', maskKeys())).toEqual([
      ['amount', '12.50'],
      ['card_number', '••••••'],
      ['label', 'café crème'],
    ])
  })

  it('masks JSON at any depth', () => {
    expect(maskJson({ user: { name: 'a', password: 'x' }, items: [{ token: 'y' }] }, maskKeys())).toEqual({
      user: { name: 'a', password: '••••••' },
      items: [{ token: '••••••' }],
    })
  })

  it('dumps bytes in hex with their ASCII', () => {
    expect(hexDump(new TextEncoder().encode('PDF\u0001'))[0]).toMatch(/^00000000  50 44 46 01\s+PDF\.$/)
  })
})

describe('diff (#4112)', () => {
  it('finds the inserted and deleted lines', () => {
    const ops = diffLines(['a', 'b', 'c', 'd'], ['a', 'c', 'x', 'd'])
    expect(ops.map((o) => `${o.type[0]}${o.text}`)).toEqual(['ea', 'db', 'ec', 'ix', 'ed'])
    expect(diffLines([], ['a'])).toEqual([{ type: 'insert', right: 0, text: 'a' }])
    expect(diffLines(['a'], [])).toEqual([{ type: 'delete', left: 0, text: 'a' }])
    expect(diffLines(['a'], ['a'])).toEqual([{ type: 'equal', left: 0, right: 0, text: 'a' }])
  })

  it('compares content, not formatting: key order and indentation vanish', () => {
    const left = normalizeLines('{"b":1,"a":{"y":2,"x":3}}', 'json')
    const right = normalizeLines({ a: { x: 3, y: 2 }, b: 1 }, 'json')
    expect(diffLines(left, right).every((o) => o.type === 'equal')).toBe(true)
    const xa = normalizeLines('<o><a>1</a></o>', 'xml')
    const xb = normalizeLines('<o>\n    <a>1</a>\n</o>', 'xml')
    expect(xa).toEqual(xb)
  })

  it('matches CSV rows on a key and compares cells by header', () => {
    const left = parseCsv('sku,qty,price\nA1,2,9.90\nB2,1,19.00\nC3,5,1.00').rows
    const right = parseCsv('sku,price,qty\nA1,9.90,2\nB2,18.00,1\nD4,3.00,1').rows
    const { header, rows } = diffCsv(left, right, 'sku')
    expect(header).toEqual(['sku', 'qty', 'price'])
    expect(rows.map((r) => [r.key, r.status, r.changed])).toEqual([
      ['A1', 'same', []],
      ['B2', 'changed', [2]],
      ['C3', 'removed', []],
      ['D4', 'added', []],
    ])
    expect(diffCsv(left, right, 'nope')).toBeNull()
  })
})

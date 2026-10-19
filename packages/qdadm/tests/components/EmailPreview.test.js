/**
 * EmailPreview (#4113): a captured email rendered without letting it run or
 * reach out.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import EmailPreview from '../../src/components/display/EmailPreview.vue'
import { emailDocument, fromMailpit, EMAIL_SANDBOX } from '../../src/utils/email'
import { parseMime } from '../../src/email'

const global = { plugins: [PrimeVue], directives: { tooltip: {} } }
const preview = (props) => mount(EmailPreview, { props, global })

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const ORDER = {
  from: { name: 'Shop', address: 'orders@shop.test' },
  to: ['ana@example.test'],
  subject: 'Your order #48211',
  date: '2026-10-19T08:00:00Z',
  headers: [{ key: 'Message-ID', value: '<a1@shop.test>' }, { key: 'X-Mailer', value: 'shop' }],
  html: '<p>Hello <b>Ana</b></p><img src="https://track.test/open.gif"><img src="cid:logo@shop">',
  text: 'Hello Ana',
  attachments: [
    { filename: 'logo.png', contentType: 'image/png', content: PNG, contentId: '<logo@shop>', disposition: 'inline' },
    { filename: 'invoice.pdf', contentType: 'application/pdf', size: 48213, url: '/files/invoice.pdf' },
  ],
}

function csp(doc) {
  return doc.match(/Content-Security-Policy" content="([^"]+)"/)[1]
}

describe('emailDocument (#4113)', () => {
  it('blocks everything remote, and images until asked', () => {
    const doc = emailDocument(ORDER.html, { attachments: ORDER.attachments })
    expect(doc.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')).toBe(true)
    expect(csp(doc)).toContain("default-src 'none'")
    expect(csp(doc)).toMatch(/img-src data:(;|$)/)
    expect(csp(emailDocument(ORDER.html, { allowRemoteImages: true }))).toContain('img-src data: https: http:')
  })

  it('points cid: images at their attachment', () => {
    const doc = emailDocument(ORDER.html, { attachments: ORDER.attachments })
    expect(doc).toContain(`src="data:image/png;base64,${PNG}"`)
    expect(doc).not.toContain('cid:logo@shop')
  })

  it('lets an attachment served by the app through the policy, by origin', () => {
    const doc = emailDocument('<img src="cid:x">', { attachments: [{ contentId: 'x', url: 'https://mail.test/api/v1/message/1/part/2' }] })
    expect(csp(doc)).toContain('img-src data: https://mail.test')
    expect(doc).toContain('src="https://mail.test/api/v1/message/1/part/2"')
  })

  it('drops what the policy does not stop: refresh, prefetch, base, even with encoded attributes', () => {
    const doc = emailDocument(
      '<meta http-equiv="&#x72;efresh" content="0;url=https://evil.test/">' +
        '<link rel="dns-prefetch" href="//evil.test"><link rel=preconnect href="https://evil.test">' +
        '<base href="https://evil.test/"><p>hi</p>'
    )
    expect(doc).not.toMatch(/evil\.test/)
    expect(doc).toContain('<p>hi</p>')
    expect(doc.match(/<base/g)).toHaveLength(1)
  })
})

describe('EmailPreview (#4113)', () => {
  it('renders the HTML in a sandbox without scripts or same-origin', () => {
    const wrapper = preview({ email: { ...ORDER, html: '<script>parent.alert(1)</script><p>x</p>' } })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('sandbox')).toBe(EMAIL_SANDBOX)
    expect(EMAIL_SANDBOX).not.toMatch(/allow-scripts|allow-same-origin|allow-forms|allow-top-navigation/)
    expect(iframe.attributes('referrerpolicy')).toBe('no-referrer')
    expect(wrapper.find('script').exists()).toBe(false)
  })

  it('counts blocked remote images and loads them on demand', async () => {
    const wrapper = preview({ email: ORDER })
    expect(wrapper.find('.qd-email-blocked').text()).toContain('core.email.imagesBlocked')
    expect(csp(wrapper.find('iframe').attributes('srcdoc'))).not.toContain('https:')
    await wrapper.findAll('button').find((b) => b.text() === 'core.email.loadImages').trigger('click')
    expect(csp(wrapper.find('iframe').attributes('srcdoc'))).toContain('https:')
  })

  it('shows the main headers on top, the rest folded, and switches tabs', async () => {
    const wrapper = preview({ email: ORDER })
    expect(wrapper.find('.qd-email-subject').text()).toBe('Your order #48211')
    expect(wrapper.find('.qd-email-main').text()).toContain('Shop <orders@shop.test>')
    expect(wrapper.findAll('.qd-email-headers tr')).toHaveLength(2)
    expect(wrapper.findAll('.qd-email-tab').map((t) => t.text())).toEqual(['core.email.tab.html', 'core.email.tab.text'])
    await wrapper.findAll('.qd-email-tab')[1].trigger('click')
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('.qd-email-text').text()).toBe('Hello Ana')
  })

  it('lists attachments with their size, and previews images', () => {
    const wrapper = preview({ email: ORDER })
    const rows = wrapper.findAll('.qd-email-attachment')
    expect(rows.map((r) => r.find('.qd-email-att-name').text())).toEqual(['logo.png', 'invoice.pdf'])
    expect(rows[0].find('img').attributes('src')).toMatch(/^data:image\/png;base64,/)
    expect(rows[0].text()).toContain('core.email.inline')
    expect(rows[1].text()).toContain('47.1 KB')
  })

  it('parses a raw MIME message with postal-mime', async () => {
    const raw = [
      'From: "Shop" <orders@shop.test>',
      'To: ana@example.test',
      'Subject: =?UTF-8?Q?Commande_confirm=C3=A9e?=',
      'Date: Mon, 19 Oct 2026 10:00:00 +0200',
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="b1"',
      '',
      '--b1',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Merci Ana',
      '--b1',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Merci <b>Ana</b></p>',
      '--b1--',
      '',
    ].join('\r\n')
    const wrapper = preview({ raw, parser: parseMime })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('.qd-email-subject').exists()).toBe(true))
    expect(wrapper.find('.qd-email-subject').text()).toBe('Commande confirmée')
    expect(wrapper.findAll('.qd-email-tab')).toHaveLength(3)
    expect(wrapper.find('iframe').attributes('srcdoc')).toContain('<p>Merci <b>Ana</b></p>')
  })

  it('shows the source and says why when a raw message has no parser', () => {
    const wrapper = preview({ raw: 'Subject: x\r\n\r\nbody' })
    expect(wrapper.find('.qd-email-warning').text()).toContain('core.email.noParser')
    expect(wrapper.find('.qd-email-source').text()).toContain('Subject: x')
  })
})

describe('fromMailpit (#4113)', () => {
  it('maps a Mailpit message and points parts at its API', () => {
    const email = fromMailpit(
      {
        ID: 'abc',
        From: { Name: 'Shop', Address: 'orders@shop.test' },
        To: [{ Name: '', Address: 'ana@example.test' }],
        Subject: 'Hi',
        HTML: '<p>x</p>',
        Attachments: [{ PartID: '2', FileName: 'a.pdf', ContentType: 'application/pdf', Size: 10 }],
        Inline: [{ PartID: '3', FileName: 'logo.png', ContentType: 'image/png', ContentID: 'logo' }],
      },
      'http://localhost:8025/'
    )
    expect(email.from).toEqual({ name: 'Shop', address: 'orders@shop.test' })
    expect(email.attachments.map((a) => [a.url, a.disposition])).toEqual([
      ['http://localhost:8025/api/v1/message/abc/part/2', 'attachment'],
      ['http://localhost:8025/api/v1/message/abc/part/3', 'inline'],
    ])
  })
})

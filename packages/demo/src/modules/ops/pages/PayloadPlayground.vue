<script setup>
/**
 * PayloadPlayground — what an integration sends its providers (#4112).
 */
import { ref } from 'vue'
import { usePageTitle, PayloadViewer, PayloadDiff, maskKeys } from '@quazardous/qdadm'
import Card from 'primevue/card'
import SelectButton from 'primevue/selectbutton'

usePageTitle('Payloads')

const mask = maskKeys()

const SOAP = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><auth token="sk_live_51Hx9"/></soap:Header><soap:Body><m:PlaceOrder xmlns:m="urn:acme:orders"><m:Order id="PO-77812" date="2026-10-19"><!-- shop order #48211 --><m:Line sku="SKU-778" qty="2"><m:Label>Mug, blue &amp; white</m:Label></m:Line><m:Line sku="SKU-102" qty="1"><m:Label>Tea towel</m:Label></m:Line><m:Note><![CDATA[Deliver <before> noon]]></m:Note></m:Order></m:PlaceOrder></soap:Body></soap:Envelope>`

const CAPTURED_SOAP = SOAP.replace('qty="1"', 'qty="3"').replace('<m:Note>', '<m:Gift>true</m:Gift><m:Note>')

const FEED = `sku;label;qty;price
SKU-778;"Mug, blue & white";14;9.90
SKU-102;Tea towel;0;4.50
SKU-311;"Teapot ""Classic""";3;29.00`
const FEED_NEXT = `sku;label;qty;price
SKU-778;"Mug, blue & white";12;9.90
SKU-311;"Teapot ""Classic""";3;27.00
SKU-404;Coaster set;40;6.00`

const PAYMENT = 'amount=89.90&currency=EUR&order_ref=48211&card_number=4111111111111111&cvv=123&return_url=https%3A%2F%2Fshop.test%2Fpaid'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, 0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x00, 0x00, ...Array.from({ length: 1400 }, (_, i) => i % 256)])

const samples = [
  { label: 'SOAP order', value: 'soap' },
  { label: 'CSV feed', value: 'csv' },
  { label: 'Payment form', value: 'form' },
  { label: 'JSON', value: 'json' },
  { label: 'PDF label', value: 'pdf' },
]
const sample = ref('soap')

const VIEW = {
  soap: { body: SOAP, request: { method: 'POST', url: 'https://supplier.acme.test/soap/orders', status: 200, headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', Authorization: 'Basic c2hvcDpzZWNyZXQ=', SOAPAction: 'PlaceOrder' } } },
  csv: { body: FEED, contentType: 'text/csv' },
  form: { body: PAYMENT, request: { method: 'POST', url: 'https://psp.test/v1/pay', status: 402, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } } },
  json: { body: { order: 48211, customer: { email: 'ana@example.test', password: 'hunter2' }, lines: [{ sku: 'SKU-778', qty: 2 }] }, request: { method: 'PUT', url: 'https://marketplace.test/api/orders/MKP-20931', status: 409 } },
  pdf: { body: PDF, contentType: 'application/pdf', filename: 'label-6A1234567890.pdf' },
}
</script>

<template>
  <div class="payload-playground">
    <Card>
      <template #title>A captured message</template>
      <template #content>
        <p class="hint">Each format in its own shape. Tokens, passwords, card numbers and the Authorization header are masked.</p>
        <SelectButton v-model="sample" :options="samples" option-label="label" option-value="value" :allow-empty="false" class="pick" />
        <PayloadViewer v-bind="VIEW[sample]" :mask="mask" />
      </template>
    </Card>

    <Card>
      <template #title>Expected against captured</template>
      <template #content>
        <p class="hint">Two SOAP calls: the indentation differs, the content differs in two places.</p>
        <PayloadDiff :left="SOAP" :right="CAPTURED_SOAP" :mask="mask" />
      </template>
    </Card>

    <Card>
      <template #title>Two captures of the same feed</template>
      <template #content>
        <p class="hint">Rows matched on <code>sku</code>, cells compared by column.</p>
        <PayloadDiff :left="FEED" :right="FEED_NEXT" format="csv" csv-key="sku" :labels="['Monday', 'Tuesday']" />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.payload-playground {
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

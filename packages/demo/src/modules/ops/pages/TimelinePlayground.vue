<script setup>
/**
 * TimelinePlayground — one order followed through every provider (#4111).
 */
import { ref } from 'vue'
import { usePageTitle, EntityTimeline, JsonViewer } from '@quazardous/qdadm'
import Card from 'primevue/card'
import Button from 'primevue/button'

usePageTitle('Timeline')

const ACTORS = {
  marketplace: { label: 'Marketplace', color: '#7c3aed', icon: 'pi pi-shopping-bag' },
  shop: { label: 'Shop', color: '#2563eb', icon: 'pi pi-shop' },
  supplier: { label: 'Supplier', color: '#d97706', icon: 'pi pi-box' },
  carrier: { label: 'Carrier', color: '#16a34a', icon: 'pi pi-truck' },
  payment: { label: 'Payment', color: '#db2777', icon: 'pi pi-credit-card' },
}

const hour = 3_600_000
const t0 = Date.now() - 30 * hour
let nextId = 1
const ev = (offsetH, actor, title, kind, payload, severity) => ({
  id: nextId++, at: new Date(t0 + offsetH * hour).toISOString(), actor, title, kind, payload, severity,
})

const events = ref([
  ev(0, 'marketplace', 'Order MKP-20931 injected', 'injected', { order: 'MKP-20931', lines: 2, total: 89.9 }),
  ev(0.02, 'payment', 'Payment authorised', 'paid', { amount: 89.9, method: 'card' }, 'success'),
  ev(0.05, 'shop', 'Order imported as #48211', 'imported', { shop_id: 48211 }),
  ev(1.5, 'supplier', 'Purchase order sent (XML)', 'po_sent', { supplier: 'ACME', format: 'xml' }),
  ev(9, 'supplier', 'Supplier confirmed, 1 line backordered', 'po_ack', { backordered: ['SKU-778'] }, 'warn'),
  ev(17, 'shop', 'Ready to ship', 'ready', { warehouse: 'LYON-2' }),
  ev(17.3, 'carrier', 'Label requested', 'label', { carrier: 'colis', tracking: '6A1234567890' }),
])

const NEXT = [
  ['carrier', 'Parcel picked up', 'picked', { depot: 'Lyon' }, null],
  ['marketplace', 'Shipping confirmed to the marketplace', 'shipped_ack', { status: 'shipped' }, 'success'],
  ['carrier', 'Delivery failed: address incomplete', 'delivery_failed', { attempt: 1 }, 'danger'],
  ['payment', 'Partial refund 12.50', 'refund', { amount: 12.5 }, 'warn'],
]
let step = 0

function addEvent() {
  const [actor, title, kind, payload, severity] = NEXT[step++ % NEXT.length]
  events.value = [...events.value, { id: nextId++, at: new Date().toISOString(), actor, title, kind, payload, severity }]
}

const GAPS = [
  { label: 'injected → ready to ship', from: (e) => e.kind === 'injected', to: (e) => e.kind === 'ready' },
  { label: 'ready → picked up', from: (e) => e.kind === 'ready', to: (e) => e.kind === 'picked' },
]
</script>

<template>
  <div class="timeline-playground">
    <Card>
      <template #title>Order MKP-20931</template>
      <template #content>
        <p class="hint">
          Each actor has its colour; the chips hide one (the choice stays in the URL). Click an event for its payload.
          “Something happens” adds an event, which flashes.
        </p>
        <div class="row">
          <Button size="small" icon="pi pi-plus" label="Something happens" @click="addEvent" />
        </div>
        <EntityTimeline :events="events" :actors="ACTORS" :gaps="GAPS" query-key="hide">
          <template #detail="{ event }">
            <JsonViewer :model-value="event.payload" />
          </template>
        </EntityTimeline>
      </template>
    </Card>

    <Card>
      <template #title>Time between events</template>
      <template #content>
        <p class="hint">The same history, newest first, with the time since the previous event.</p>
        <EntityTimeline :events="events" :actors="ACTORS" order="desc" gaps height="20rem" />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.timeline-playground {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hint {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
}

.row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
</style>

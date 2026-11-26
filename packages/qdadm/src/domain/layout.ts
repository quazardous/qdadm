/**
 * A domain bar's layout (#5526): which of the domain's indicators the bar
 * shows, in which order, with which parameters, chosen by the app (an admin,
 * on a page of its own) on the dashboards' layout core.
 *
 * - The catalogue is the domain's `indicators`; a `repeatable` one, with a
 *   `params` schema, is added as many times as wanted, each with its own
 *   parameters, which reach its functions.
 * - The layout is the dashboards' (`{ v, order, hidden, instances }`), read
 *   with the bar's profile: a new indicator waits hidden, at most `maxCards`
 *   shown.
 * - It comes from `features.domainBar.layout(domain)` (a layout, a promise of
 *   one, or null for the declared indicators as they are), or a `layout`
 *   prop: an editor's preview.
 */
import { ref } from 'vue'
import {
  BAR_PROFILE,
  reconcileArrangement,
  shownItems,
  type CardDef,
  type CardsArrangement,
} from '../composables/useCardsArrangement'
import type { DomainDefinition, DomainIndicator } from './registry'

/** The most a bar shows unless the domain or the app says otherwise */
export const DOMAIN_BAR_MAX = 8

/** A domain's indicators as layout items: what an editor's catalogue and order list take */
export function domainLayoutItems(domain: DomainDefinition): CardDef[] {
  return (domain.indicators ?? []).map((i) => ({
    id: i.id,
    card: {
      title: i.label ?? (typeof i.title === 'string' ? i.title : i.id),
      ...(i.description ? { description: i.description } : {}),
      ...(i.repeatable ? { repeatable: true } : {}),
      ...(i.params ? { params: i.params } : {}),
    },
  }))
}

/** The bar's max: the domain's, else the app's, else 8 */
export function domainBarMax(domain: DomainDefinition, appMax?: number | null): number {
  return domain.maxCards ?? appMax ?? DOMAIN_BAR_MAX
}

/** A saved layout, read for a domain with the bar's profile */
export function reconcileDomainLayout(saved: unknown, domain: DomainDefinition): CardsArrangement {
  return reconcileArrangement(saved, domainLayoutItems(domain), BAR_PROFILE)
}

/** An added indicator: its template, its own id and title, its parameters given to its functions */
function bound(def: DomainIndicator, id: string, params: Record<string, unknown>, title?: string): DomainIndicator {
  const withParams = <A extends unknown[], R>(fn: ((...args: [...A, Record<string, unknown>]) => R) | undefined) =>
    fn ? (...args: A) => fn(...args, params) : undefined
  const of = <V,>(v: V | ((d: unknown, p?: Record<string, unknown>) => V | undefined) | undefined) =>
    typeof v === 'function' ? (d: unknown) => (v as (d: unknown, p?: Record<string, unknown>) => V | undefined)(d, params) : v
  return {
    ...def,
    id,
    repeatable: false,
    title: title ?? (of(def.title) as DomainIndicator['title']),
    icon: of(def.icon) as DomainIndicator['icon'],
    to: of(def.to) as DomainIndicator['to'],
    options: { ...(def.options ?? {}), ...params },
    ...(def.load ? { load: withParams<[], unknown>(def.load as never) } : {}),
    ...(def.value ? { value: withParams<[unknown], unknown>(def.value as never) } : {}),
    ...(typeof def.status === 'function' ? { status: withParams<[unknown], never>(def.status as never) } : {}),
    ...(def.visible ? { visible: withParams<[unknown], boolean>(def.visible as never) } : {}),
  }
}

/**
 * The indicators a bar draws for a layout: every declared one (their counts
 * feed the nav badges, shown or not) and the added ones; and the ids shown,
 * in order. No layout (null, undefined): the declared ones, as declared.
 */
export function domainBarIndicators(
  domain: DomainDefinition,
  layout: unknown,
  appMax?: number | null
): { indicators: DomainIndicator[]; shown: string[] | null } {
  const declared = (domain.indicators ?? []).filter((i) => !i.repeatable)
  if (layout === null || layout === undefined) return { indicators: declared, shown: null }
  const items = domainLayoutItems(domain)
  const arrangement = reconcileArrangement(layout, items, BAR_PROFILE)
  const templates = new Map((domain.indicators ?? []).filter((i) => i.repeatable).map((i) => [i.id, i]))
  const added = arrangement.instances.flatMap((inst) => {
    const t = templates.get(inst.block)
    return t ? [bound(t, inst.id, inst.params, inst.title)] : []
  })
  return {
    indicators: [...declared, ...added],
    shown: shownItems(arrangement, items, domainBarMax(domain, appMax)).map((c) => c.id),
  }
}

// ── Reading it again after a save ────────────────────────────────────────────
const versions = ref<Record<string, number>>({})

/** The layout's version for a domain: the bar reads it again when it moves */
export function domainBarVersion(name: string): number {
  return versions.value[name] ?? 0
}

/** After the app saved a layout: the bar of that domain (or of all) reads it again */
export function reloadDomainBar(name?: string): void {
  if (name) versions.value = { ...versions.value, [name]: domainBarVersion(name) + 1 }
  else versions.value = Object.fromEntries(Object.entries(versions.value).map(([k, v]) => [k, v + 1]).concat([['*', (versions.value['*'] ?? 0) + 1]]))
}

/** The global version, moved by reloadDomainBar() without a name */
export function domainBarGlobalVersion(): number {
  return versions.value['*'] ?? 0
}

export function useDomainBar(): { reload: (name?: string) => void } {
  return { reload: reloadDomainBar }
}

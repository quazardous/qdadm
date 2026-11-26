/** Domains and their bar (#5389) */
export { default as QdDomainBar } from './QdDomainBar.vue'
export { default as QdDomainBarZone } from './QdDomainBarZone.vue'
export { default as QdBadge } from './QdBadge.vue'
export { registerDomain, getDomain, listDomains, domainOfRoute, resolveDomain, badgeTone, DOMAIN_QUERY } from './registry'
export type { DomainConfig, DomainDefinition, DomainIndicator, DomainIndicatorProps, DomainLook, DomainNavEntry, DomainResolver, DomainResolverContext, DomainSource, DomainDataSource } from './registry'
export { withDomain, useDomainLink, leaveDomain } from './keep'
// A bar's layout chosen by the app (#5526), on the dashboards' layout core
export { domainLayoutItems, reconcileDomainLayout, domainBarIndicators, domainBarMax, reloadDomainBar, useDomainBar, DOMAIN_BAR_MAX } from './layout'
export type { IndicatorParams } from './registry'

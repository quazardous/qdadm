/** Domains and their bar (#5389) */
export { default as QdDomainBar } from './QdDomainBar.vue'
export { default as QdDomainBarZone } from './QdDomainBarZone.vue'
export { default as QdBadge } from './QdBadge.vue'
export { registerDomain, getDomain, listDomains, domainOfRoute, badgeTone } from './registry'
export type { DomainConfig, DomainDefinition, DomainIndicator, DomainLook, DomainNavEntry } from './registry'

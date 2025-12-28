/**
 * Zones Module
 *
 * Zone registry for extensible UI composition.
 * Inspired by Twig/Symfony block system.
 */

export { ZoneRegistry, createZoneRegistry } from './ZoneRegistry.js'
export {
  ZONES,
  LAYOUT_ZONES,
  LIST_ZONES,
  FORM_ZONES,
  registerStandardZones,
  getStandardZoneNames
} from './zones.js'

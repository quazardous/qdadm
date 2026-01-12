/**
 * Zones Module
 *
 * Zone registry for extensible UI composition.
 * Inspired by Twig/Symfony block system.
 */

export {
  ZoneRegistry,
  createZoneRegistry,
  type BlockOperation,
  type WrapperInfo,
  type BlockConfig,
  type ZoneConfig,
  type ZoneDefineOptions,
  type ZoneListInfo,
  type ZoneDetailInfo,
  type ZoneInspection,
  type ZoneRegistryOptions,
} from './ZoneRegistry'
export {
  ZONES,
  LAYOUT_ZONES,
  LIST_ZONES,
  FORM_ZONES,
  DASHBOARD_ZONES,
  registerStandardZones,
  getStandardZoneNames,
} from './zones'

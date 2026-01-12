/**
 * qdadm - Module system exports
 */

export {
  registry,
  initModules,
  setSectionOrder,
  getRoutes,
  getNavSections,
  alterMenuSections,
  isMenuAltered,
  getRouteFamilies,
  getEntityConfigs,
  getEntityConfig,
  getSiblingRoutes,
  getChildRoutes,
  isRouteInFamily,
  resetRegistry,
  type ParentConfig,
  type ModuleRouteMeta,
  type ModuleRoute,
  type NavItem,
  type NavItemWithSection,
  type NavSection,
  type AddRoutesOptions,
  type EntityConfig,
  type ModuleInitContext,
  type ModuleInitFunction,
  type ModuleDefinition,
  type InitModulesOptions,
  type MenuAlterContext,
} from './moduleRegistry'

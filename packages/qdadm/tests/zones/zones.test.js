/**
 * Unit tests for standard zone definitions
 *
 * Tests cover:
 * - Zone constant definitions (layout, list, form)
 * - registerStandardZones helper
 * - getStandardZoneNames utility
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry.js'
import {
  ZONES,
  LAYOUT_ZONES,
  LIST_ZONES,
  FORM_ZONES,
  DASHBOARD_ZONES,
  registerStandardZones,
  getStandardZoneNames
} from '../../src/zones/zones.js'

describe('zones.js', () => {
  describe('LAYOUT_ZONES', () => {
    it('defines header zone', () => {
      expect(LAYOUT_ZONES.HEADER).toBe('header')
    })

    it('defines menu zone', () => {
      expect(LAYOUT_ZONES.MENU).toBe('menu')
    })

    it('defines breadcrumb zone', () => {
      expect(LAYOUT_ZONES.BREADCRUMB).toBe('breadcrumb')
    })

    it('defines sidebar zone', () => {
      expect(LAYOUT_ZONES.SIDEBAR).toBe('sidebar')
    })

    it('defines main zone', () => {
      expect(LAYOUT_ZONES.MAIN).toBe('main')
    })

    it('defines footer zone', () => {
      expect(LAYOUT_ZONES.FOOTER).toBe('footer')
    })

    it('defines toaster zone', () => {
      expect(LAYOUT_ZONES.TOASTER).toBe('toaster')
    })

    it('has exactly 7 zones', () => {
      expect(Object.keys(LAYOUT_ZONES)).toHaveLength(7)
    })
  })

  describe('LIST_ZONES', () => {
    it('defines before-table zone', () => {
      expect(LIST_ZONES.BEFORE_TABLE).toBe('before-table')
    })

    it('defines table zone', () => {
      expect(LIST_ZONES.TABLE).toBe('table')
    })

    it('defines after-table zone', () => {
      expect(LIST_ZONES.AFTER_TABLE).toBe('after-table')
    })

    it('defines pagination zone', () => {
      expect(LIST_ZONES.PAGINATION).toBe('pagination')
    })

    it('has exactly 4 zones', () => {
      expect(Object.keys(LIST_ZONES)).toHaveLength(4)
    })
  })

  describe('FORM_ZONES', () => {
    it('defines form-header zone', () => {
      expect(FORM_ZONES.FORM_HEADER).toBe('form-header')
    })

    it('defines form-fields zone', () => {
      expect(FORM_ZONES.FORM_FIELDS).toBe('form-fields')
    })

    it('defines form-tabs zone', () => {
      expect(FORM_ZONES.FORM_TABS).toBe('form-tabs')
    })

    it('defines actions zone', () => {
      expect(FORM_ZONES.ACTIONS).toBe('actions')
    })

    it('has exactly 4 zones', () => {
      expect(Object.keys(FORM_ZONES)).toHaveLength(4)
    })
  })

  describe('DASHBOARD_ZONES', () => {
    it('defines dashboard-stats zone', () => {
      expect(DASHBOARD_ZONES.STATS).toBe('dashboard-stats')
    })

    it('defines dashboard-widgets zone', () => {
      expect(DASHBOARD_ZONES.WIDGETS).toBe('dashboard-widgets')
    })

    it('defines dashboard-recent-activity zone', () => {
      expect(DASHBOARD_ZONES.RECENT_ACTIVITY).toBe('dashboard-recent-activity')
    })

    it('has exactly 3 zones', () => {
      expect(Object.keys(DASHBOARD_ZONES)).toHaveLength(3)
    })
  })

  describe('ZONES (combined)', () => {
    it('includes all layout zones', () => {
      expect(ZONES.HEADER).toBe('header')
      expect(ZONES.MENU).toBe('menu')
      expect(ZONES.BREADCRUMB).toBe('breadcrumb')
      expect(ZONES.SIDEBAR).toBe('sidebar')
      expect(ZONES.MAIN).toBe('main')
      expect(ZONES.FOOTER).toBe('footer')
      expect(ZONES.TOASTER).toBe('toaster')
    })

    it('includes all list zones', () => {
      expect(ZONES.BEFORE_TABLE).toBe('before-table')
      expect(ZONES.TABLE).toBe('table')
      expect(ZONES.AFTER_TABLE).toBe('after-table')
      expect(ZONES.PAGINATION).toBe('pagination')
    })

    it('includes all form zones', () => {
      expect(ZONES.FORM_HEADER).toBe('form-header')
      expect(ZONES.FORM_FIELDS).toBe('form-fields')
      expect(ZONES.FORM_TABS).toBe('form-tabs')
      expect(ZONES.ACTIONS).toBe('actions')
    })

    it('includes all dashboard zones', () => {
      expect(ZONES.DASHBOARD_STATS).toBe('dashboard-stats')
      expect(ZONES.DASHBOARD_WIDGETS).toBe('dashboard-widgets')
      expect(ZONES.DASHBOARD_RECENT_ACTIVITY).toBe('dashboard-recent-activity')
    })

    it('has exactly 18 zones total', () => {
      expect(Object.keys(ZONES)).toHaveLength(18)
    })

    it('matches values with category exports', () => {
      // Layout zones
      expect(ZONES.HEADER).toBe(LAYOUT_ZONES.HEADER)
      expect(ZONES.MENU).toBe(LAYOUT_ZONES.MENU)
      expect(ZONES.BREADCRUMB).toBe(LAYOUT_ZONES.BREADCRUMB)
      expect(ZONES.SIDEBAR).toBe(LAYOUT_ZONES.SIDEBAR)
      expect(ZONES.MAIN).toBe(LAYOUT_ZONES.MAIN)
      expect(ZONES.FOOTER).toBe(LAYOUT_ZONES.FOOTER)
      expect(ZONES.TOASTER).toBe(LAYOUT_ZONES.TOASTER)
      // List zones
      expect(ZONES.BEFORE_TABLE).toBe(LIST_ZONES.BEFORE_TABLE)
      expect(ZONES.TABLE).toBe(LIST_ZONES.TABLE)
      expect(ZONES.AFTER_TABLE).toBe(LIST_ZONES.AFTER_TABLE)
      expect(ZONES.PAGINATION).toBe(LIST_ZONES.PAGINATION)
      // Form zones
      expect(ZONES.FORM_HEADER).toBe(FORM_ZONES.FORM_HEADER)
      expect(ZONES.FORM_FIELDS).toBe(FORM_ZONES.FORM_FIELDS)
      expect(ZONES.FORM_TABS).toBe(FORM_ZONES.FORM_TABS)
      expect(ZONES.ACTIONS).toBe(FORM_ZONES.ACTIONS)
    })
  })

  describe('registerStandardZones', () => {
    let registry

    beforeEach(() => {
      registry = new ZoneRegistry()
    })

    it('registers all standard zones in registry', () => {
      registerStandardZones(registry)

      const zoneNames = registry.listZones().map(z => z.name)
      // Layout zones
      expect(zoneNames).toContain('header')
      expect(zoneNames).toContain('menu')
      expect(zoneNames).toContain('breadcrumb')
      expect(zoneNames).toContain('sidebar')
      expect(zoneNames).toContain('main')
      expect(zoneNames).toContain('footer')
      expect(zoneNames).toContain('toaster')
      // List zones
      expect(zoneNames).toContain('before-table')
      expect(zoneNames).toContain('table')
      expect(zoneNames).toContain('after-table')
      expect(zoneNames).toContain('pagination')
      // Form zones
      expect(zoneNames).toContain('form-header')
      expect(zoneNames).toContain('form-fields')
      expect(zoneNames).toContain('form-tabs')
      expect(zoneNames).toContain('actions')
      // Dashboard zones
      expect(zoneNames).toContain('dashboard-stats')
      expect(zoneNames).toContain('dashboard-widgets')
      expect(zoneNames).toContain('dashboard-recent-activity')
    })

    it('registers exactly 18 zones', () => {
      registerStandardZones(registry)
      expect(registry.listZones()).toHaveLength(18)
    })

    it('returns registry for chaining', () => {
      const result = registerStandardZones(registry)
      expect(result).toBe(registry)
    })

    it('allows block registration after standard zones', () => {
      registerStandardZones(registry)

      const MockComponent = { name: 'MockComponent' }
      registry.registerBlock(ZONES.HEADER, { component: MockComponent, weight: 10 })

      const blocks = registry.getBlocks('header')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].component).toBe(MockComponent)
    })

    it('all registered zones start empty', () => {
      registerStandardZones(registry)

      for (const zoneName of registry.listZones()) {
        expect(registry.getBlocks(zoneName)).toHaveLength(0)
        expect(registry.hasBlocks(zoneName)).toBe(false)
      }
    })

    it('all registered zones have no default component', () => {
      registerStandardZones(registry)

      for (const zoneName of registry.listZones()) {
        expect(registry.getDefault(zoneName)).toBeNull()
      }
    })
  })

  describe('getStandardZoneNames', () => {
    it('returns all zone names', () => {
      const names = getStandardZoneNames()
      // Layout zones
      expect(names).toContain('header')
      expect(names).toContain('menu')
      expect(names).toContain('breadcrumb')
      expect(names).toContain('sidebar')
      expect(names).toContain('main')
      expect(names).toContain('footer')
      expect(names).toContain('toaster')
      // List zones
      expect(names).toContain('before-table')
      expect(names).toContain('table')
      expect(names).toContain('after-table')
      expect(names).toContain('pagination')
      // Form zones
      expect(names).toContain('form-header')
      expect(names).toContain('form-fields')
      expect(names).toContain('form-tabs')
      expect(names).toContain('actions')
      // Dashboard zones
      expect(names).toContain('dashboard-stats')
      expect(names).toContain('dashboard-widgets')
      expect(names).toContain('dashboard-recent-activity')
    })

    it('returns exactly 18 names', () => {
      expect(getStandardZoneNames()).toHaveLength(18)
    })

    it('returns array of strings', () => {
      const names = getStandardZoneNames()
      expect(Array.isArray(names)).toBe(true)
      for (const name of names) {
        expect(typeof name).toBe('string')
      }
    })

    it('contains only unique values', () => {
      const names = getStandardZoneNames()
      const unique = [...new Set(names)]
      expect(names).toHaveLength(unique.length)
    })
  })
})

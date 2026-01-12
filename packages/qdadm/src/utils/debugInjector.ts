/**
 * Debug Injector - Bypasses MCP/DevTools limitations
 *
 * Usage in browser console:
 *   window.__debug.listFilters()
 *   window.__debug.setFilter('queue_status', 'pending')
 *   window.__debug.getVueApp()
 *   window.__debug.triggerEvent('filterChange', { name: 'queue_status', value: 'pending' })
 */

interface SelectInfo {
  index: number
  element: Element
  component: VueComponentProxy | null
  value: unknown
  placeholder: string | null | undefined
}

interface VueComponentProxy {
  modelValue?: unknown
  localFilterValues?: Record<string, unknown>
  onFilterChange?: (name: string) => void
  $options?: { name?: string }
  $parent?: VueComponentProxy
}

interface VNodeComponent {
  proxy?: VueComponentProxy
  parent?: VNodeComponent
  type?: { name?: string; __name?: string }
  subTree?: { children?: VNodeComponent[] }
  component?: VNodeComponent
}

interface VueApp {
  _instance?: VNodeComponent
}

declare global {
  interface Window {
    __debug: DebugInjector
  }
  interface HTMLElement {
    __vue_app__?: VueApp
    __vueParentComponent?: VNodeComponent
  }
}

class DebugInjector {
  vueApp: VueApp | null = null
  components: Map<string, VueComponentProxy> = new Map()

  /**
   * Initialize and expose to window
   */
  init(): this {
    window.__debug = this
    console.log('🔧 Debug Injector initialized. Use window.__debug to access.')
    this.findVueApp()
    return this
  }

  /**
   * Find Vue app instance
   */
  findVueApp(): VueApp | null {
    const appEl = document.querySelector('#app') as HTMLElement | null
    if (appEl && appEl.__vue_app__) {
      this.vueApp = appEl.__vue_app__
      console.log('✅ Vue app found:', this.vueApp)
      return this.vueApp
    }
    console.warn('⚠️ Vue app not found on #app')
    return null
  }

  /**
   * Get Vue component instance from DOM element
   */
  getComponentFromElement(selector: string | Element): VueComponentProxy | null {
    const el = (
      typeof selector === 'string' ? document.querySelector(selector) : selector
    ) as HTMLElement | null
    if (!el) return null

    // Vue 3 stores component on __vueParentComponent
    let vnode = el.__vueParentComponent
    while (vnode && !vnode.proxy) {
      vnode = vnode.parent
    }
    return vnode?.proxy || null
  }

  /**
   * Find all PrimeVue Select components
   */
  findSelects(): SelectInfo[] {
    const selects = document.querySelectorAll('[data-pc-name="select"]')
    const results: SelectInfo[] = []
    selects.forEach((el, i) => {
      const component = this.getComponentFromElement(el)
      results.push({
        index: i,
        element: el,
        component,
        value: component?.modelValue,
        placeholder: el.querySelector('[data-pc-section="label"]')?.textContent,
      })
    })
    console.table(
      results.map((r) => ({
        index: r.index,
        placeholder: r.placeholder,
        value: r.value,
      }))
    )
    return results
  }

  /**
   * Simulate selecting a value in a PrimeVue Select
   */
  selectValue(selectIndex: number, optionText: string): boolean {
    const selects = this.findSelects()
    const select = selects[selectIndex]
    if (!select) {
      console.error(`Select ${selectIndex} not found`)
      return false
    }

    // Click to open dropdown
    ;(select.element as HTMLElement).click()

    // Wait for dropdown to open and find option
    setTimeout(() => {
      const options = document.querySelectorAll('[data-pc-section="option"]')
      for (const opt of options) {
        if (opt.textContent?.includes(optionText)) {
          console.log(`🎯 Clicking option: ${opt.textContent}`)
          ;(opt as HTMLElement).click()
          return true
        }
      }
      console.error(`Option "${optionText}" not found`)
      // Close dropdown
      document.body.click()
    }, 100)

    return true
  }

  /**
   * Direct Vue reactivity manipulation - find ListPage component
   */
  findListPage(): VueComponentProxy | null {
    // Find the main content area
    const main = document.querySelector('main')
    if (!main) return null

    let component = this.getComponentFromElement(main)

    // Walk up to find ListPage
    while (component) {
      if (component.$options?.name === 'ListPage' || component.localFilterValues) {
        console.log('✅ Found ListPage component:', component)
        return component
      }
      component = component.$parent || null
    }

    // Alternative: search in Vue app's component tree
    console.warn('ListPage not found via DOM, searching component tree...')
    return null
  }

  /**
   * Get current filter values from ListPage
   */
  getFilterValues(): Record<string, unknown> | null {
    const listPage = this.findListPage()
    if (listPage) {
      console.log('Filter values:', listPage.localFilterValues)
      return listPage.localFilterValues || null
    }
    return null
  }

  /**
   * Directly set a filter value (bypasses UI)
   */
  setFilterDirect(filterName: string, value: unknown): boolean {
    const listPage = this.findListPage()
    if (!listPage) {
      console.error('ListPage not found')
      return false
    }

    console.log(`Setting ${filterName} = ${value}`)
    if (listPage.localFilterValues) {
      listPage.localFilterValues[filterName] = value
    }

    // Trigger the change handler
    if (listPage.onFilterChange) {
      listPage.onFilterChange(filterName)
    }

    return true
  }

  /**
   * Dispatch a custom event that Vue components can listen to
   */
  dispatchFilterChange(filterName: string, value: unknown): void {
    const event = new CustomEvent('debug:filterChange', {
      detail: { filterName, value },
      bubbles: true,
    })
    document.dispatchEvent(event)
    console.log(`📤 Dispatched debug:filterChange for ${filterName}=${value}`)
  }

  /**
   * Log all Vue component instances in the tree
   */
  logComponentTree(root: VNodeComponent | null = null, depth = 0): void {
    if (!root) {
      root = this.findVueApp()?._instance || null
      if (!root) return
    }

    const indent = '  '.repeat(depth)
    const name = root.type?.name || root.type?.__name || 'Anonymous'
    console.log(`${indent}${name}`)

    if (root.subTree?.children) {
      for (const child of root.subTree.children) {
        if (child?.component) {
          this.logComponentTree(child.component, depth + 1)
        }
      }
    }
  }

  /**
   * Execute code in Vue component context
   */
  execInComponent(selector: string, code: string): unknown {
    const component = this.getComponentFromElement(selector)
    if (!component) {
      console.error('Component not found')
      return null
    }

    try {
      const fn = new Function('component', `with(component) { return ${code} }`)
      return fn(component)
    } catch (e) {
      console.error('Exec failed:', e)
      return null
    }
  }

  /**
   * Monitor all events on an element
   */
  monitorEvents(selector: string): void {
    const el = document.querySelector(selector)
    if (!el) return

    const events = ['click', 'change', 'input', 'focus', 'blur', 'mousedown', 'mouseup']
    events.forEach((evt) => {
      el.addEventListener(
        evt,
        (e) => {
          console.log(`📡 ${evt}:`, e.target, e)
        },
        true
      )
    })
    console.log(`Monitoring events on ${selector}`)
  }

  /**
   * Quick help
   */
  help(): void {
    console.log(`
🔧 Debug Injector Commands:
  __debug.findSelects()           - List all Select components
  __debug.selectValue(0, 'text')  - Select option by text in Select #0
  __debug.findListPage()          - Find ListPage component
  __debug.getFilterValues()       - Get current filter values
  __debug.setFilterDirect('name', 'value') - Directly set filter
  __debug.monitorEvents('selector') - Monitor all events
  __debug.logComponentTree()      - Log Vue component tree
  __debug.help()                  - Show this help
    `)
  }
}

// Auto-initialize in development
const debugInjector = new DebugInjector()

export default debugInjector
export { DebugInjector }

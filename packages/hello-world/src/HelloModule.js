/**
 * HelloModule - Module System v2 Example
 *
 * Demonstrates the new Module class pattern:
 * - Extends Module base class
 * - Uses static properties for name, requires, priority
 * - Uses connect(ctx) for registration via KernelContext fluent API
 */

import { Module } from 'qdadm'

export class HelloModule extends Module {
  static name = 'hello'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // Register routes using fluent API
    ctx.routes('hello', [
      {
        path: '',
        name: 'hello',
        component: () => import('./pages/HelloPage.vue')
      }
    ])

    // Register navigation item
    ctx.navItem({
      section: 'Main',
      route: 'hello',
      icon: 'pi pi-home',
      label: 'Hello'
    })
  }
}

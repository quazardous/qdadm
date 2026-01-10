/**
 * ActiveStack - Reactive container for the active navigation stack
 *
 * Simple container rebuilt from route by useActiveStack.
 * Each level: { entity, id, data, label }
 *
 * @example
 * // Route /books/123/loans → Stack:
 * [
 *   { entity: 'books', id: '123', data: null, label: 'Books' },
 *   { entity: 'loans', id: null, data: null, label: 'Loans' }
 * ]
 */

import { ref, computed } from 'vue'

export class ActiveStack {
  constructor() {
    this._stack = ref([])
  }

  /**
   * Replace entire stack (called on route change)
   */
  set(levels) {
    this._stack.value = levels
  }

  /**
   * Update a level's data and label
   */
  updateLevel(index, data, label) {
    if (index < 0 || index >= this._stack.value.length) return
    const newStack = [...this._stack.value]
    newStack[index] = { ...newStack[index], data, label }
    this._stack.value = newStack
  }

  /**
   * Find and update level by entity name
   */
  updateByEntity(entity, data, label) {
    const index = this._stack.value.findIndex(l => l.entity === entity)
    if (index !== -1) {
      this.updateLevel(index, data, label)
    }
  }

  clear() {
    this._stack.value = []
  }

  // Computed accessors
  get levels() {
    return computed(() => this._stack.value)
  }

  get current() {
    return computed(() => this._stack.value.at(-1) || null)
  }

  get parent() {
    return computed(() => this._stack.value.at(-2) || null)
  }

  get root() {
    return computed(() => this._stack.value[0] || null)
  }

  get depth() {
    return computed(() => this._stack.value.length)
  }
}

export default ActiveStack

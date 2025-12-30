/**
 * QueryExecutor - MongoDB-like query execution for arrays
 *
 * Provides client-side filtering with the same query syntax used for API calls.
 * Pure functions, no Vue dependencies, null-safe operations.
 *
 * Supported operators:
 * - Implicit: value → $eq, array → $in
 * - Comparison: $eq, $ne, $gt, $gte, $lt, $lte
 * - Set: $in, $nin, $like, $between
 * - Logical: $or, $and
 *
 * @example
 * // Simple equality (implicit $eq)
 * QueryExecutor.execute(items, { status: 'active' })
 *
 * // Array membership (implicit $in)
 * QueryExecutor.execute(items, { status: ['active', 'pending'] })
 *
 * // Nested field access
 * QueryExecutor.execute(items, { 'author.name': 'John' })
 */

/**
 * Get nested value from object using dot notation
 *
 * @param {string} path - Dot-separated path (e.g., 'author.name')
 * @param {object} obj - Source object
 * @returns {*} - Value at path or undefined if not found
 *
 * @example
 * getNestedValue('author.name', { author: { name: 'John' } }) // → 'John'
 * getNestedValue('author.name', { author: null }) // → undefined
 * getNestedValue('missing.path', {}) // → undefined
 */
export function getNestedValue(path, obj) {
  if (obj === null || obj === undefined) return undefined
  if (!path || typeof path !== 'string') return undefined

  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = current[key]
  }

  return current
}

/**
 * Check if a value matches a condition with an operator
 *
 * @param {*} itemValue - Value from the item
 * @param {*} condition - Condition to match (operator object or value)
 * @returns {boolean}
 */
function matchCondition(itemValue, condition) {
  // Null/undefined condition matches null/undefined values
  if (condition === null || condition === undefined) {
    return itemValue === condition
  }

  // Explicit operator object (e.g., { $eq: 'value' })
  if (typeof condition === 'object' && !Array.isArray(condition)) {
    return matchOperator(itemValue, condition)
  }

  // Implicit $in for arrays
  if (Array.isArray(condition)) {
    return matchIn(itemValue, condition)
  }

  // Implicit $eq for primitive values
  return itemValue === condition
}

/**
 * Match a value against an operator object
 *
 * @param {*} itemValue - Value from the item
 * @param {object} operators - Object with operator keys
 * @returns {boolean}
 */
function matchOperator(itemValue, operators) {
  for (const [op, expected] of Object.entries(operators)) {
    switch (op) {
      case '$eq':
        if (itemValue !== expected) return false
        break

      case '$ne':
        if (itemValue === expected) return false
        break

      case '$gt':
        if (itemValue === null || itemValue === undefined) return false
        if (expected === null || expected === undefined) return false
        if (typeof itemValue !== typeof expected) return false
        if (!(itemValue > expected)) return false
        break

      case '$gte':
        if (itemValue === null || itemValue === undefined) return false
        if (expected === null || expected === undefined) return false
        if (typeof itemValue !== typeof expected) return false
        if (!(itemValue >= expected)) return false
        break

      case '$lt':
        if (itemValue === null || itemValue === undefined) return false
        if (expected === null || expected === undefined) return false
        if (typeof itemValue !== typeof expected) return false
        if (!(itemValue < expected)) return false
        break

      case '$lte':
        if (itemValue === null || itemValue === undefined) return false
        if (expected === null || expected === undefined) return false
        if (typeof itemValue !== typeof expected) return false
        if (!(itemValue <= expected)) return false
        break

      case '$in':
        if (!matchIn(itemValue, expected)) return false
        break

      case '$nin':
        if (!matchNin(itemValue, expected)) return false
        break

      case '$like':
        if (!matchLike(itemValue, expected)) return false
        break

      case '$between':
        if (!matchBetween(itemValue, expected)) return false
        break

      default:
        // Unknown operator - skip (fail-safe, return true for this check)
        break
    }
  }
  return true
}

/**
 * Match $in operator - value in array
 *
 * @param {*} itemValue - Value to check
 * @param {Array} values - Array of allowed values
 * @returns {boolean}
 */
function matchIn(itemValue, values) {
  if (!Array.isArray(values)) return false
  if (values.length === 0) return false
  return values.includes(itemValue)
}

/**
 * Match $nin operator - value not in array
 *
 * @param {*} itemValue - Value to check
 * @param {Array} values - Array of disallowed values
 * @returns {boolean}
 */
function matchNin(itemValue, values) {
  if (!Array.isArray(values)) return true
  if (values.length === 0) return true
  return !values.includes(itemValue)
}

/**
 * Match $like operator - case-insensitive substring match
 *
 * @param {*} itemValue - Value to check
 * @param {string} pattern - Substring to find
 * @returns {boolean}
 */
function matchLike(itemValue, pattern) {
  if (itemValue === null || itemValue === undefined) return false
  if (pattern === null || pattern === undefined) return false
  const str = String(itemValue).toLowerCase()
  const search = String(pattern).toLowerCase()
  return str.includes(search)
}

/**
 * Match $between operator - inclusive range check
 *
 * @param {*} itemValue - Value to check
 * @param {Array} range - [min, max] tuple
 * @returns {boolean}
 */
function matchBetween(itemValue, range) {
  if (itemValue === null || itemValue === undefined) return false
  if (!Array.isArray(range) || range.length !== 2) return false
  const [min, max] = range
  return itemValue >= min && itemValue <= max
}

/**
 * Match an item against a query object
 *
 * @param {object} item - Item to check
 * @param {object} query - Query object
 * @returns {boolean}
 */
function matchQuery(item, query) {
  if (!query || typeof query !== 'object') return true
  if (Object.keys(query).length === 0) return true

  for (const [key, condition] of Object.entries(query)) {
    // Logical operators
    if (key === '$or') {
      if (!matchOr(item, condition)) return false
      continue
    }

    if (key === '$and') {
      if (!matchAnd(item, condition)) return false
      continue
    }

    // Field condition
    const itemValue = getNestedValue(key, item)
    if (!matchCondition(itemValue, condition)) {
      return false
    }
  }

  return true
}

/**
 * Match $or operator - at least one condition must match
 *
 * @param {object} item - Item to check
 * @param {Array} conditions - Array of query objects
 * @returns {boolean}
 */
function matchOr(item, conditions) {
  if (!Array.isArray(conditions)) return true
  if (conditions.length === 0) return true
  return conditions.some(cond => matchQuery(item, cond))
}

/**
 * Match $and operator - all conditions must match
 *
 * @param {object} item - Item to check
 * @param {Array} conditions - Array of query objects
 * @returns {boolean}
 */
function matchAnd(item, conditions) {
  if (!Array.isArray(conditions)) return true
  if (conditions.length === 0) return true
  return conditions.every(cond => matchQuery(item, cond))
}

/**
 * QueryExecutor - Static class for MongoDB-like array filtering
 */
export class QueryExecutor {
  /**
   * Execute query on array of items
   *
   * @param {Array} items - Source items to filter
   * @param {Object} query - MongoDB-like query object
   * @returns {{ items: Array, total: number }}
   *
   * @example
   * // Filter by status
   * QueryExecutor.execute(books, { status: 'published' })
   * // => { items: [...], total: 5 }
   *
   * // Filter by multiple values
   * QueryExecutor.execute(books, { status: ['draft', 'published'] })
   *
   * // Empty query returns all items
   * QueryExecutor.execute(books, {})
   * // => { items: [...all books...], total: 100 }
   */
  static execute(items, query) {
    // Guard against invalid input
    if (!Array.isArray(items)) {
      return { items: [], total: 0 }
    }

    // Empty query returns all items
    if (!query || typeof query !== 'object' || Object.keys(query).length === 0) {
      return { items: [...items], total: items.length }
    }

    try {
      const filtered = items.filter(item => matchQuery(item, query))
      return { items: filtered, total: filtered.length }
    } catch {
      // Return empty for malformed queries (fail-safe)
      return { items: [], total: 0 }
    }
  }

  /**
   * Check if single item matches query
   *
   * @param {Object} item - Item to check
   * @param {Object} query - Query object
   * @returns {boolean}
   *
   * @example
   * const book = { title: 'Vue 3', status: 'published' }
   * QueryExecutor.match(book, { status: 'published' }) // true
   * QueryExecutor.match(book, { status: 'draft' }) // false
   */
  static match(item, query) {
    if (item === null || item === undefined) return false

    // Empty query matches everything
    if (!query || typeof query !== 'object' || Object.keys(query).length === 0) {
      return true
    }

    try {
      return matchQuery(item, query)
    } catch {
      return false
    }
  }
}

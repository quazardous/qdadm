/**
 * Canonical JSON serialization for hashing.
 *
 * Why JSON, not YAML, when the user-facing format is YAML?
 * - YAML's grammar has many serialisation degrees of freedom (flow vs block,
 *   quoted vs unquoted scalars, key ordering). Hashing the YAML text would
 *   be brittle.
 * - JSON canonicalization is a well-known, stable problem (RFC 8785). We
 *   implement the relevant subset: sort object keys lexicographically,
 *   recurse, no whitespace, JSON.stringify-style escaping.
 * - YAML deserialises to a JS value; once we have the JS value, we hash
 *   its canonical JSON form. The original YAML never enters the hash.
 *
 * Caveats:
 * - Top-level objects only (no leading scalar) — sufficient for our
 *   schema descriptors.
 * - `undefined` values are dropped (matches JSON.stringify behaviour).
 * - Numbers are emitted via JSON.stringify (no NaN, Infinity).
 * - Map / Set / Date / RegExp / BigInt are NOT supported — feed plain
 *   JSON-compatible structures.
 */

export function canonicalJSON(value: unknown): string {
  return stringify(value)
}

function stringify(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'null' // safety net; caller should strip
  const t = typeof value
  if (t === 'boolean' || t === 'number') return JSON.stringify(value)
  if (t === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(stringify).join(',') + ']'
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
    const parts = keys.map(
      (k) => JSON.stringify(k) + ':' + stringify(obj[k]),
    )
    return '{' + parts.join(',') + '}'
  }
  // Functions, symbols → drop (caller's data leak; not our problem to
  // serialise meaningfully).
  return 'null'
}

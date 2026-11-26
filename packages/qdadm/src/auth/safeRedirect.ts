/**
 * Where to go back after a login (#5524): a local path of the app, never
 * another site. `?redirect=` comes from the address, which anyone can write;
 * a value that is not a plain local path gives `fallback`.
 *
 * Kept: `/books/12/edit?tab=loans#notes`. Refused: `//evil.com`,
 * `https://evil.com`, `/\evil.com`, `javascript:…`, anything with a control
 * character, anything not starting with one `/`.
 */
export function safeRedirect(value: unknown, fallback = '/'): string {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string' || !v) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return fallback
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.includes('\\')) return fallback
  return v
}

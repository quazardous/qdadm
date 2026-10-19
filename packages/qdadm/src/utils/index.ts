/**
 * qdadm - Utils exports
 */

// Formatters
export {
  formatDate,
  formatDateTime,
  formatDateTimeShort,
  formatDateOnly,
  formatTimeOnly,
  formatDateOrNever,
  formatDuration,
  formatDurationBetween,
  formatNumber,
  formatCurrency,
  formatBytes,
  formatPercent,
  setEmptyPlaceholder,
  getEmptyPlaceholder,
} from './formatters'

// Error formatting
export { formatFetchError, type FetchErrorLike } from './errors'

// Field-name humanization
export { humanizeFieldName } from './humanize'

// Transformers
export {
  toKeyValueArray,
  toKeyValueObject,
  toLanguageCodes,
  toLanguageObjects,
  toDateObject,
  toIsoDate,
  toIsoDateTime,
  deepClone,
  getSparseUpdate,
  isEqual,
} from './transformers'

// ANSI escapes in logs (#4110)
export { parseAnsiLine, stripAnsi, ansiStyleToCss, type AnsiStyle, type AnsiSegment } from './ansi'

// Payloads in their own format (#4112)
export {
  detectFormat,
  maskKeys,
  prettyXml,
  parseCsv,
  parseForm,
  diffLines,
  diffCsv,
  normalizeLines,
  type PayloadFormat,
  type PayloadBody,
  type PayloadMask,
  type DiffOp,
} from './payload'

// Type exports
export type { KeyValuePair, LanguageObject } from './transformers'

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
  byteUnits,
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

// Captured emails (#4113); raw MIME parsing is in '@quazardous/qdadm/email'
export {
  emailDocument,
  fromMailpit,
  formatAddresses,
  EMAIL_SANDBOX,
  type ParsedEmail,
  type EmailAddress,
  type EmailAttachment,
  type EmailParser,
  type MailpitMessage,
} from './email'

// Type exports
export type { KeyValuePair, LanguageObject } from './transformers'

/**
 * useFormatBytes (#4384): formatBytes in the app's language, with the unit
 * labels of the catalogue (core.units.bytes.*), so an app can rename them.
 *
 *   const formatBytes = useFormatBytes()
 *   formatBytes(1468006) // "1,4 Mo" in French
 */
import { useI18n } from '../i18n/useI18n'
import { byteUnits, formatBytes } from '../utils/formatters'

const KEYS = ['b', 'kb', 'mb', 'gb', 'tb']

export function useFormatBytes(): (bytes: number | null | undefined) => string {
  const { tOr, locale } = useI18n()
  return (bytes) => {
    const fallback = byteUnits(locale.value)
    const units = KEYS.map((key, i) => tOr(`core.units.bytes.${key}`, fallback[i]!))
    return formatBytes(bytes, locale.value, units)
  }
}

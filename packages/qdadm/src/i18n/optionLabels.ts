/**
 * Option labels from the catalogue (#4686)
 *
 * A select field's options translate through
 * `entities.<entity>.fields.<field>.options.<value>`; an option without a key
 * keeps the label it was declared with. The declared labels are kept on the
 * result so a later locale change translates from them again.
 */

interface CatalogueLike {
  resolve: (key: string) => { hit: boolean; result: string }
}

export interface LabeledOption {
  label?: string
  value?: unknown
  [key: string]: unknown
}

/** The options with their labels in the current language. */
export function translateOptions<O extends LabeledOption>(
  i18n: CatalogueLike | null | undefined,
  entity: string | null | undefined,
  field: string,
  options: O[] | null | undefined
): O[] | null | undefined {
  if (!i18n || !entity || !Array.isArray(options)) return options
  return options.map((option) => {
    if (option === null || typeof option !== 'object' || option.value === undefined || option.value === null) return option
    const declared = (option as O & { _declaredLabel?: string })._declaredLabel ?? option.label
    const trace = i18n.resolve(`entities.${entity}.fields.${field}.options.${String(option.value)}`)
    const label = trace.hit && typeof trace.result === 'string' ? trace.result : declared
    return { ...option, label, _declaredLabel: declared }
  })
}

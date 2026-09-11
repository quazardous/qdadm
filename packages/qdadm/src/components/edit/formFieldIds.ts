import type { ComputedRef, InjectionKey } from 'vue'

/** What a FormField gives the control inside it, so its label names that control (#2268). */
export interface FormFieldIds {
  /** The id the field's label points at: unique to the field instance. */
  inputId: ComputedRef<string>
  /** The label's own id, for controls named with aria-labelledby. Undefined when the field has no label. */
  labelId: ComputedRef<string | undefined>
}

export const FORM_FIELD_IDS: InjectionKey<FormFieldIds> = Symbol('qdadm.formFieldIds')

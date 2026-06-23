/**
 * jsonValidator - build a vanilla-jsoneditor `Validator` from wrapper props.
 *
 * Pure helper extracted from VanillaJsonEditor so the resolution logic
 * (raw validator vs JSON Schema vs none) is unit-testable without mounting the
 * Svelte editor. See qdadm #1050.
 */
import {
  createAjvValidator,
  type Validator,
  type JSONSchema,
  type AjvValidatorOptions,
} from 'vanilla-jsoneditor'

export type { Validator, JSONSchema }

export interface JsonValidatorOptions {
  /** Raw validator function — takes precedence over `schema` when both are set. */
  validator?: Validator
  /** JSON Schema; compiled to a validator via Ajv (bundled in vanilla-jsoneditor). */
  schema?: JSONSchema
  /** Optional `$ref` definitions passed through to `createAjvValidator`. */
  schemaDefinitions?: AjvValidatorOptions['schemaDefinitions']
  /** Optional Ajv options passed through to `createAjvValidator`. */
  ajvOptions?: AjvValidatorOptions['ajvOptions']
}

/**
 * Resolve the effective validator:
 * - an explicit `validator` wins;
 * - otherwise a `schema` is compiled with `createAjvValidator`;
 * - otherwise `undefined` (no validation — the wrapper's default behavior).
 */
export function buildJsonValidator(options: JsonValidatorOptions): Validator | undefined {
  if (options.validator) return options.validator
  if (options.schema) {
    return createAjvValidator({
      schema: options.schema,
      schemaDefinitions: options.schemaDefinitions,
      ajvOptions: options.ajvOptions,
    })
  }
  return undefined
}

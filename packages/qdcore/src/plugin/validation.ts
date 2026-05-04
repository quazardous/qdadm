/**
 * Pure manifest validation helpers. Used by the registry on register and
 * exposed as standalone exports so consumer apps can pre-validate manifests
 * (e.g. CLI codegen, YAML loader).
 */

import {
  PluginValidationError,
  type PluginManifest,
} from './types'

const ID_RE = /^[a-z][a-z0-9_-]*$/
const PREFIX_RE = /^[a-z][a-z0-9_]*$/
// Loose semver — major.minor.patch with optional pre-release / build metadata.
// Stricter than `parseSemver` proper (which would require a dep) but enough to
// reject obvious garbage at register time.
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export function isValidPluginId(id: string): boolean {
  return ID_RE.test(id)
}

export function isValidPluginPrefix(prefix: string): boolean {
  return PREFIX_RE.test(prefix)
}

export function isValidSemver(version: string): boolean {
  return SEMVER_RE.test(version)
}

/**
 * Validate a manifest. Throws `PluginValidationError` on the first issue.
 *
 * Rationale: validation must be all-or-nothing at register time so the
 * registry never holds partial / inconsistent entries. Tests assert each
 * error class via the message prefix.
 */
export function validateManifest(manifest: PluginManifest): void {
  if (!manifest || typeof manifest !== 'object') {
    throw new PluginValidationError('manifest is not an object')
  }
  if (!manifest.id) {
    throw new PluginValidationError('manifest.id is required')
  }
  if (!isValidPluginId(manifest.id)) {
    throw new PluginValidationError(
      `manifest.id "${manifest.id}" must match ${ID_RE} (lowercase, [a-z0-9_-], starts with a letter)`,
      manifest.id,
    )
  }
  if (!manifest.version) {
    throw new PluginValidationError('manifest.version is required', manifest.id)
  }
  if (!isValidSemver(manifest.version)) {
    throw new PluginValidationError(
      `manifest.version "${manifest.version}" is not valid semver`,
      manifest.id,
    )
  }
  if (!manifest.prefix) {
    throw new PluginValidationError('manifest.prefix is required', manifest.id)
  }
  if (!isValidPluginPrefix(manifest.prefix)) {
    throw new PluginValidationError(
      `manifest.prefix "${manifest.prefix}" must match ${PREFIX_RE} (lowercase, [a-z0-9_], starts with a letter, no dashes)`,
      manifest.id,
    )
  }
  if (manifest.dependencies) {
    if (!Array.isArray(manifest.dependencies)) {
      throw new PluginValidationError(
        'manifest.dependencies must be an array',
        manifest.id,
      )
    }
    for (const dep of manifest.dependencies) {
      if (!dep || typeof dep !== 'object') {
        throw new PluginValidationError(
          `manifest.dependencies entry must be an object`,
          manifest.id,
        )
      }
      if (!isValidPluginId(dep.id)) {
        throw new PluginValidationError(
          `manifest.dependencies entry has invalid id "${dep.id}"`,
          manifest.id,
        )
      }
    }
  }
  if (manifest.extensions) {
    if (typeof manifest.extensions !== 'object' || Array.isArray(manifest.extensions)) {
      throw new PluginValidationError(
        'manifest.extensions must be an object keyed by table name',
        manifest.id,
      )
    }
    for (const tableName of Object.keys(manifest.extensions)) {
      if (!PREFIX_RE.test(tableName.split('_')[0] ?? '')) {
        throw new PluginValidationError(
          `manifest.extensions table "${tableName}" should start with a plugin prefix segment`,
          manifest.id,
        )
      }
    }
  }
}

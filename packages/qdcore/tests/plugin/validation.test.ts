/**
 * Manifest validation — pure-function tests.
 *
 * The validator is the gatekeeper for everything else (registry refuses to
 * accept invalid manifests). Tests must cover every error branch so the
 * registry never sees malformed input.
 */

import { describe, expect, it } from 'vitest'
import {
  isValidPluginId,
  isValidPluginPrefix,
  isValidSemver,
  PluginValidationError,
  validateManifest,
  type PluginManifest,
} from '../../src/plugin'

const baseManifest = (): PluginManifest => ({
  id: 'core',
  version: '1.0.0',
  prefix: 'core',
})

describe('plugin validation primitives', () => {
  describe('isValidPluginId', () => {
    it.each([
      ['core', true],
      ['dynamic_content', true],
      ['my-shop', true],
      ['a', true],
      ['x9z_2-c', true],
      ['', false],
      ['Core', false],
      ['9core', false],
      ['_core', false],
      ['core space', false],
      ['core.dot', false],
      ['CORE', false],
    ])('isValidPluginId(%j) === %s', (input, expected) => {
      expect(isValidPluginId(input)).toBe(expected)
    })
  })

  describe('isValidPluginPrefix', () => {
    it.each([
      ['core', true],
      ['dc', true],
      ['my_shop', true],
      ['x9', true],
      ['', false],
      ['Core', false],
      ['my-shop', false], // dashes are NOT allowed in prefixes (table naming)
      ['9dc', false],
      ['_dc', false],
    ])('isValidPluginPrefix(%j) === %s', (input, expected) => {
      expect(isValidPluginPrefix(input)).toBe(expected)
    })
  })

  describe('isValidSemver', () => {
    it.each([
      ['1.0.0', true],
      ['0.0.1', true],
      ['1.2.3-alpha.1', true],
      ['1.2.3+build.42', true],
      ['1.2.3-alpha.1+build.42', true],
      ['10.20.30', true],
      ['1.0', false],
      ['1', false],
      ['1.0.0.0', false],
      ['v1.0.0', false],
      ['', false],
      ['latest', false],
    ])('isValidSemver(%j) === %s', (input, expected) => {
      expect(isValidSemver(input)).toBe(expected)
    })
  })
})

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    expect(() => validateManifest(baseManifest())).not.toThrow()
  })

  it.each([null, undefined, 'string', 42])('rejects non-object manifest %j', (input) => {
    expect(() => validateManifest(input as unknown as PluginManifest)).toThrow(
      PluginValidationError,
    )
  })

  it('rejects missing id', () => {
    expect(() =>
      validateManifest({ ...baseManifest(), id: '' as string }),
    ).toThrow(/manifest\.id is required/)
  })

  it('rejects invalid id', () => {
    expect(() =>
      validateManifest({ ...baseManifest(), id: 'BadId' }),
    ).toThrow(/must match/)
  })

  it('rejects missing version', () => {
    expect(() =>
      validateManifest({ ...baseManifest(), version: '' as string }),
    ).toThrow(/manifest\.version is required/)
  })

  it('rejects invalid semver', () => {
    expect(() =>
      validateManifest({ ...baseManifest(), version: '1.0' }),
    ).toThrow(/not valid semver/)
  })

  it('rejects missing prefix', () => {
    expect(() =>
      validateManifest({ ...baseManifest(), prefix: '' as string }),
    ).toThrow(/manifest\.prefix is required/)
  })

  it('rejects prefix with dashes', () => {
    expect(() =>
      validateManifest({ ...baseManifest(), prefix: 'my-shop' }),
    ).toThrow(/must match/)
  })

  it('rejects non-array dependencies', () => {
    expect(() =>
      validateManifest({
        ...baseManifest(),
        dependencies: 'core' as unknown as PluginManifest['dependencies'],
      }),
    ).toThrow(/must be an array/)
  })

  it('rejects dependency with invalid id', () => {
    expect(() =>
      validateManifest({
        ...baseManifest(),
        dependencies: [{ id: 'Bad ID' }],
      }),
    ).toThrow(/invalid id/)
  })

  it('accepts well-formed extensions', () => {
    expect(() =>
      validateManifest({
        ...baseManifest(),
        extensions: {
          core_users: { newsletter_opt_in: { type: 'boolean' } },
        },
      }),
    ).not.toThrow()
  })

  it('rejects extensions that is not an object', () => {
    expect(() =>
      validateManifest({
        ...baseManifest(),
        extensions: [] as unknown as PluginManifest['extensions'],
      }),
    ).toThrow(/keyed by table name/)
  })

  it('attaches the pluginId to the error', () => {
    try {
      validateManifest({ ...baseManifest(), id: 'core', version: 'invalid' })
    } catch (e) {
      expect(e).toBeInstanceOf(PluginValidationError)
      expect((e as PluginValidationError).pluginId).toBe('core')
      return
    }
    expect.fail('should have thrown')
  })
})

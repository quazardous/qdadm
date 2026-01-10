/**
 * Shared storage configuration for demo app
 *
 * Module-centric pattern: entities are defined in their own modules.
 * This file only exports shared utilities used across modules.
 */

import { authAdapter } from '../adapters/authAdapter'

// ============================================================================
// FIXTURES VERSIONING
// ============================================================================
const FIXTURES_VERSION = 2  // Bump: books now uses bookId instead of id
const FIXTURES_VERSION_KEY = 'qdadm_demo_fixtures_version'

const storedVersion = localStorage.getItem(FIXTURES_VERSION_KEY)
if (storedVersion !== String(FIXTURES_VERSION)) {
  Object.keys(localStorage)
    .filter(k => k.startsWith('mockapi_') || k === 'qdadm_demo_auth')
    .forEach(k => localStorage.removeItem(k))
  localStorage.setItem(FIXTURES_VERSION_KEY, String(FIXTURES_VERSION))
  console.log(`[demo] Fixtures upgraded to v${FIXTURES_VERSION}`)
}

// ============================================================================
// SHARED AUTH CHECK
// ============================================================================

/**
 * Auth check function for protected storages
 *
 * Import this in modules that need to protect their MockApiStorage:
 * ```js
 * import { authCheck } from '../../config/storages'
 * const myStorage = new MockApiStorage({ authCheck })
 * ```
 */
export const authCheck = () => !!authAdapter.getUser()

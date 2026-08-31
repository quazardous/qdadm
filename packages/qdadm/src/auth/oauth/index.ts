/**
 * OAuth sign-in helpers (#1775).
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 *
 * @module auth/oauth
 */

export {
  GoogleOAuthAdapter,
  createGoogleOAuthAdapter,
  type GoogleOAuthAdapterOptions,
  type OAuthExchangePayload,
} from './GoogleOAuthAdapter'

export {
  createPkceChallenge,
  storeAttempt,
  takeAttempt,
  clearAttempt,
  type PkceChallenge,
  type StoredAttempt,
} from './pkce'

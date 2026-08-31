/**
 * Auth module - User session authentication
 *
 * For entity-level permissions, see entity/auth/EntityAuthAdapter
 */

export {
  SessionAuthAdapter,
  LocalStorageSessionAuthAdapter,
  type LoginCredentials,
  type SessionData,
  type AuthUser,
  type ISessionAuthAdapter,
  type LocalStorageAuthConfig,
} from './SessionAuthAdapter'

export {
  GoogleOAuthAdapter,
  createGoogleOAuthAdapter,
  createPkceChallenge,
  type GoogleOAuthAdapterOptions,
  type OAuthExchangePayload,
  type PkceChallenge,
} from './oauth/index'

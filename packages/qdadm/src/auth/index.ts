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
} from './SessionAuthAdapter'

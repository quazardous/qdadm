/**
 * What a key may be granted (#5333): a plain list, as an API would give it.
 * Three-part keys, so `**:read` and `logs:*:read` are the wildcards that cover them.
 */
export const KEY_SCOPES = [
  'entity:books:read', 'entity:books:list', 'entity:books:create', 'entity:books:update', 'entity:books:delete',
  'entity:loans:read', 'entity:loans:list', 'entity:loans:create',
  'logs:errors:read', 'logs:access:read', 'logs:errors:purge',
  'cockpit:act', 'keys:manage',
]

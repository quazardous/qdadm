/**
 * API keys - a value shown once (#5319)
 *
 * Like a real key API, the storage's create answers `{ key, token }`: the key
 * and its value, which it keeps only as a prefix (a real server keeps its
 * hash). `revealOnce` takes the token out of the response before the cache
 * and the signals see it; the create form shows it once, with a copy button,
 * and goes on to the list once the user says they copied it.
 */
import { Module, MockApiStorage } from '@quazardous/qdadm'

/** A key API: the value is in create's answer, and nowhere after */
class KeysStorage extends MockApiStorage {
  async create(data) {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const token = 'qdk_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    const key = await super.create({ ...data, prefix: token.slice(0, 8), state: 'active' })
    return { key, token }
  }
}

const keysStorage = new KeysStorage({
  entityName: 'apikeys',
  initialData: [
    { id: 'k1', name: 'CI pipeline', scopes: ['entity:books:read', 'entity:books:list'], prefix: 'qdk_3f9a', state: 'active', created_at: '2026-10-02T09:12:00Z' },
  ],
})

export class ApiKeysModule extends Module {
  static moduleName = 'apikeys'
  static requires = []
  static priority = 0

  async connect(ctx) {
    ctx.messages('en', {
      entities: {
        apikeys: {
          label: 'API key',
          labelPlural: 'API keys',
          fields: { name: 'Name', scopes: 'Scopes', prefix: 'Prefix', state: 'State', created_at: 'Created' },
          reveal: { token: 'Key value' },
          revoke: { action: 'Revoke', header: 'Revoke the key', message: 'Revoke the key "{label}"? Whatever uses it stops working.' },
        },
      },
      nav: { routes: { apikey: 'API keys' } },
    })
    ctx.messages('fr', {
      entities: {
        apikeys: {
          label: "Clé d'API",
          labelPlural: "Clés d'API",
          fields: { name: 'Nom', scopes: 'Portées', prefix: 'Préfixe', state: 'État', created_at: 'Créée le' },
          reveal: { token: 'Valeur de la clé' },
          revoke: { action: 'Révoquer', header: 'Révoquer la clé', message: "Révoquer la clé « {label} » ? Ce qui l'utilise cessera de marcher." },
        },
      },
      nav: { routes: { apikey: "Clés d'API" } },
    })

    ctx.entity('apikeys', {
      name: 'apikeys',
      labelField: 'name',
      // create answers { key, token }: the key is the entity, the token is shown once
      revealOnce: { keys: ['token'], item: 'key' },
      fields: {
        name: { type: 'text', required: true, default: '' },
        scopes: { type: 'array', default: ['entity:books:read'] },
        prefix: { type: 'text', readOnly: true },
        state: { type: 'text', readOnly: true },
        created_at: { type: 'datetime', readOnly: true },
      },
      storage: keysStorage,
    })

    ctx.crud(
      'apikeys',
      {
        list: () => import('./pages/ApiKeysPage.vue'),
        form: () => import('./pages/ApiKeyForm.vue'),
      },
      { nav: { section: 'Security', icon: 'pi pi-key' } }
    )
  }
}

export default ApiKeysModule

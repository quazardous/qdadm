---
"@quazardous/qdadm": minor
---

`useOptionsLookup` endpoint mode is now kernel-aware (#1198) — the raw-fetch footgun is gone.

- **New kernel option `apiClient`** (`HttpClient` or factory), provided as `qdadmApiClient`: `new Kernel({ apiClient: myAxios })`. New exports: `useApiClient()`, `resolveApiClient()`, `API_CLIENT_INJECTION_KEY`.
- **Endpoint routing precedence**: `via: 'entityName'` (new option — that entity's `storage.request()`) > relative endpoint → kernel `apiClient` (base URL + auth applied, zero per-call wiring) > absolute URL → raw `fetch` + `headers` (escape hatch, unchanged) > relative without a registered client → legacy raw fetch **with a console warning**.
- **Failed lookups are no longer silent**: non-JSON responses (HTML page), 401/403 and parse failures log a `console.warn` naming the endpoint and the likely cause.
- `ScopeEditor` falls back to the kernel `apiClient` when no `apiAdapter` is injected (existing contract unchanged).

Purely additive — existing `endpoint` + `headers` calls keep working.

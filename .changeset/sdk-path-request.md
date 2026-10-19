---
"@quazardous/qdadm": minor
---

`SdkStorage` runs path requests (#4069). `manager.request('GET', 'distinct/x')`, which `optionsEndpoint` filters make, was read as the SDK method name `GET` and failed with "SDK method 'GET' not found", leaving the filter on "No available options". A new `request: (method, path, options, sdk)` option now carries those calls, usually to the SDK's own client; without it the error says what to pass, and `addFilter` warns by name when an `optionsEndpoint` filter sits on a storage that cannot reach it. Calling an SDK method by name through `request('getStats', params)` is unchanged.

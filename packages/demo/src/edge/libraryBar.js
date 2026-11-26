/**
 * Where the demo keeps the Library bar's layout (#5526): this browser. An app
 * keeps it on its server, shared, behind an admin right; qdadm only reads it
 * back through features.domainBar.layout.
 */
const KEY = 'demo.libraryBar'

export function loadLibraryBar() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveLibraryBar(layout) {
  try {
    if (layout) localStorage.setItem(KEY, JSON.stringify(layout))
    else localStorage.removeItem(KEY)
  } catch {
    // not kept: the bar keeps its declared indicators
  }
}

/** features.domainBar.layout: the Library's saved layout, the declared bar elsewhere */
export const domainBarLayout = (domain) => (domain.name === 'library' ? loadLibraryBar() : null)

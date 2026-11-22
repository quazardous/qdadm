/**
 * The demo's what's new (#5445), opened from the welcome page and from the
 * version in the sidebar (app.versionAction, main.js)
 */
import { openRichDialog } from '@quazardous/qdadm'

export async function openNews() {
  const r = await openRichDialog({
    title: "What's new",
    icon: 'pi pi-sparkles',
    blocks: [
      { kind: 'demo.changes', title: 'Version 2.65', meta: 'November 2026', items: [
        { tag: 'new', text: 'Rich dialogs: stacked blocks, your own content and controls' },
        { tag: 'new', text: 'Split buttons on item pages' },
        { tag: 'fix', text: 'The domain bar no longer flickers on scroll' },
      ] },
      { kind: 'markdown', title: 'Charts', meta: 'October 2026', source: 'Charts take **N series**, stacked or not:\n\n- `chart: \'area\'` with `stacked: true`\n- or a chart of your own, `registerChart(name, Component)`\n\nSee [the docs](https://github.com/quazardous/qdadm).' },
    ],
    controls: [{ key: 'dontShowAgain', label: 'Do not show again' }],
    actions: [{ key: 'later', label: 'Later', severity: 'secondary' }, { key: 'ok', label: 'Got it', icon: 'pi pi-check' }],
  })
  console.info('[demo] rich dialog answered', r)
  return r
}

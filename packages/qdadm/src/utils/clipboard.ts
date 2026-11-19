/**
 * Put text on the clipboard: `navigator.clipboard` when the page has it, a
 * selected textarea otherwise (a page served over plain http has none).
 * Throws when neither works.
 */
export async function copyText(text: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard on this page (it needs HTTPS)')
    await navigator.clipboard.writeText(text)
  } catch (err) {
    try {
      copyByCommand(text)
    } catch {
      throw err
    }
  }
}

function copyByCommand(text: string): void {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  const focused = document.activeElement as HTMLElement | null
  area.select()
  try {
    if (!document.execCommand?.('copy')) throw new Error('the browser refused to copy')
  } finally {
    // The textarea held the value: it goes at once
    area.value = ''
    area.remove()
    focused?.focus?.()
  }
}

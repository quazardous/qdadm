// @vitest-environment jsdom
/**
 * Acting in the page like a user (#2247): the event sequences and the
 * browser defaults the action tools reproduce, against a jsdom page.
 *
 * jsdom has no layout: pointer aiming falls back to the element itself, and
 * what depends on geometry (covered elements, scrolling) is proven live on
 * the demo instead.
 *
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest'
import { click, fill, pressKeys, typeText } from '../src/page/actions.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

const page = (html) => {
  document.body.innerHTML = html
  return (selector) => document.querySelector(selector)
}

const record = (element, types) => {
  const seen = []
  for (const type of types) element.addEventListener(type, () => seen.push(type))
  return seen
}

describe('click', () => {
  it('fires the pointer and mouse sequence of a real click, and takes focus', async () => {
    const $ = page('<input id="before" /><button id="save">Save</button>')
    $('#before').focus()
    const seen = record($('#save'), ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'focus'])

    expect(await click($('#save'))).toBe('clicked button "Save"')
    expect(seen).toEqual(['pointerdown', 'mousedown', 'focus', 'pointerup', 'mouseup', 'click'])
    expect(document.activeElement).toBe($('#save'))
  })

  it('toggles a checkbox through its activation, change event included', async () => {
    const $ = page('<label><input type="checkbox" id="available" /> Available</label>')
    const seen = record($('#available'), ['change'])
    await click($('#available'))
    expect($('#available').checked).toBe(true)
    expect(seen).toEqual(['change'])
  })

  it('double click adds dblclick; right click fires contextmenu, not click', async () => {
    const $ = page('<div role="button" id="row" tabindex="0">Dune</div>')
    const seen = record($('#row'), ['click', 'dblclick', 'contextmenu'])
    await click($('#row'), { clickCount: 2 })
    expect(seen).toEqual(['click', 'click', 'dblclick'])
    seen.length = 0
    await click($('#row'), { button: 'right' })
    expect(seen).toEqual(['contextmenu'])
  })

  it('looks through the debug bar floating over the app, but refuses an element a dialog mask covers', async () => {
    const $ = page('<button id="save">Save</button><div class="qd-debug"><div id="panel">No entries</div></div><div id="mask">Mask</div>')
    $('#save').getBoundingClientRect = () => ({ top: 10, left: 10, bottom: 40, right: 110, width: 100, height: 30 })
    let stack = [$('#panel'), $('#save')]
    document.elementsFromPoint = () => stack
    try {
      expect(await click($('#save'))).toBe('clicked button "Save"')
      stack = [$('#mask'), $('#save')]
      await expect(click($('#save'))).rejects.toThrow('button "Save" is covered by div "Mask"')
    } finally {
      delete document.elementsFromPoint
    }
  })

  it('refuses a disabled button and anything in the debug bar', async () => {
    const $ = page('<button id="save" disabled>Save</button><div class="qd-debug"><button id="pause">Pause</button></div>')
    await expect(click($('#save'))).rejects.toThrow('button "Save" is disabled')
    await expect(click($('#pause'))).rejects.toThrow(/debug bar/)
  })
})

describe('force (#2274)', () => {
  it('a covered element takes the click, and forced names what covered it', async () => {
    const $ = page('<button id="save">Save</button><div id="mask">Mask</div>')
    $('#save').getBoundingClientRect = () => ({ top: 10, left: 10, bottom: 40, right: 110, width: 100, height: 30 })
    document.elementsFromPoint = () => [$('#mask'), $('#save')]
    const seen = record($('#save'), ['click'])
    try {
      await expect(click($('#save'))).rejects.toThrow('button "Save" is covered by div "Mask" — close what is over it')
      const forced = []
      expect(await click($('#save'), { force: true, forced })).toBe('clicked button "Save"')
      expect(seen).toEqual(['click'])
      expect(forced).toEqual(['was covered by div "Mask"'])
    } finally {
      delete document.elementsFromPoint
    }
  })

  it('not visible and disabled: dispatched anyway, each reason listed once, in the order checked', async () => {
    const $ = page('<div role="button" id="go" tabindex="0" aria-disabled="true" style="display: none">Go</div>')
    const seen = record($('#go'), ['click'])
    const forced = []
    await click($('#go'), { force: true, forced })
    await click($('#go'), { force: true, forced })
    expect(seen).toEqual(['click', 'click'])
    expect(forced).toEqual(['not visible', 'disabled'])
  })

  it('a read-only field gets the keys with force, and the answer says what the field kept', async () => {
    const $ = page('<input id="code" aria-label="Code" readonly value="X1" />')
    const keys = record($('#code'), ['keydown'])
    const forced = []
    expect(await typeText($('#code'), 'AB', { force: true, forced })).toBe('typed into textbox "Code" — the field holds "X1"')
    expect(keys).toEqual(['keydown', 'keydown'])
    expect(forced).toEqual(['read-only'])
  })

  it('the debug bar stays refused, force or not', async () => {
    const $ = page('<div class="qd-debug"><button id="pause">Pause</button></div>')
    await expect(click($('#pause'), { force: true, forced: [] })).rejects.toThrow(/debug bar/)
  })
})

describe('typing', () => {
  it('types character by character: keydown, keypress, beforeinput, input, keyup — v-model sees each step', async () => {
    const $ = page('<label for="title">Title</label><input id="title" value="" />')
    const values = []
    $('#title').addEventListener('input', (e) => values.push(e.target.value))

    expect(await typeText($('#title'), 'Dune')).toBe('typed into textbox "Title"')
    expect($('#title').value).toBe('Dune')
    expect(values).toEqual(['D', 'Du', 'Dun', 'Dune'])
  })

  it('a key the app prevents is not inserted (an input mask, a number field)', async () => {
    const $ = page('<input id="year" value="19" />')
    $('#year').addEventListener('keypress', (e) => {
      if (!/\d/.test(e.key)) e.preventDefault()
    })
    await typeText($('#year'), '6x5')
    expect($('#year').value).toBe('1965')
  })

  it('clear replaces the value; submit presses Enter, which submits the form', async () => {
    const $ = page('<form id="f"><input id="q" value="old" /><button>Go</button></form>')
    let submitted = 0
    $('#f').addEventListener('submit', (e) => {
      e.preventDefault()
      submitted++
    })
    await typeText($('#q'), 'new', { clear: true, submit: true })
    expect($('#q').value).toBe('new')
    expect(submitted).toBe(1)
  })

  it('a wrapper with one input inside types into that input', async () => {
    const $ = page('<span class="p-inputnumber" id="wrap"><input id="inner" /></span>')
    await typeText($('#wrap'), '42')
    expect($('#inner').value).toBe('42')
  })
})

describe('press_key', () => {
  it('Tab and Shift+Tab move focus through what can be focused; Control+a then Backspace empties a field', async () => {
    const $ = page('<input id="a" value="abc" /><button id="b">B</button><a id="c">no href</a><input id="d" disabled /><textarea id="e"></textarea>')
    $('#a').focus()
    await pressKeys(null, 'Tab')
    expect(document.activeElement.id).toBe('b')
    await pressKeys(null, 'Tab')
    expect(document.activeElement.id).toBe('e')
    await pressKeys(null, 'Shift+Tab Shift+Tab')
    expect(document.activeElement.id).toBe('a')

    await pressKeys($('#a'), 'Control+a Backspace')
    expect($('#a').value).toBe('')
  })

  it('with focus left outside an open dialog, keys go to the dialog, as a trapped keyboard focus would', async () => {
    const $ = page('<button id="behind">Behind</button><div role="dialog" id="dialog" aria-label="Confirm"><button>Yes</button></div>')
    $('#behind').focus()
    const reached = []
    $('#dialog').addEventListener('keydown', (e) => reached.push(e.key))
    expect(await pressKeys(null, 'Escape')).toBe('pressed Escape on dialog "Confirm"')
    expect(reached).toEqual(['Escape'])
  })

  it('Enter and Space press a button; Escape reaches the app\'s own listener', async () => {
    const $ = page('<button id="ok">OK</button>')
    let clicks = 0
    let escapes = 0
    $('#ok').addEventListener('click', () => clicks++)
    document.addEventListener('keydown', (e) => e.key === 'Escape' && escapes++)
    await pressKeys($('#ok'), 'Enter')
    await pressKeys($('#ok'), 'Space')
    await pressKeys($('#ok'), 'Escape')
    expect(clicks).toBe(2)
    expect(escapes).toBe(1)
  })
})

describe('fill', () => {
  it('a native select, by label or value', async () => {
    const $ = page('<select id="genre" aria-label="Genre"><option value="sf">sci-fi</option><option value="fan">fantasy</option></select>')
    const seen = record($('#genre'), ['change'])
    expect(await fill($('#genre'), 'Fantasy')).toBe('selected "fantasy" in combobox "Genre"')
    expect($('#genre').value).toBe('fan')
    await fill($('#genre'), 'sf')
    expect($('#genre').value).toBe('sf')
    expect(seen).toEqual(['change', 'change'])
    await expect(fill($('#genre'), 'poetry')).rejects.toThrow('no option "poetry" in combobox "Genre" — options: "sci-fi", "fantasy"')
  })

  it('a checkbox is clicked only when its state differs', async () => {
    const $ = page('<label><input type="checkbox" id="c" checked /> Available</label>')
    expect(await fill($('#c'), true)).toBe('checkbox "Available" was already checked')
    expect(await fill($('#c'), 'false')).toBe('unchecked checkbox "Available"')
    expect($('#c').checked).toBe(false)
  })

  it('a PrimeVue-like dropdown: opened, then the option clicked', async () => {
    const $ = page(`
      <div id="select"><span role="combobox" id="genre" aria-label="Genre" aria-expanded="false" aria-controls="genre-list">sci-fi</span></div>
      <div id="overlay"></div>`)
    $('#genre').addEventListener('click', () => {
      $('#genre').setAttribute('aria-expanded', 'true')
      $('#overlay').innerHTML = '<ul role="listbox" id="genre-list"><li role="option">sci-fi</li><li role="option">fantasy</li></ul>'
      for (const option of document.querySelectorAll('[role=option]')) {
        option.addEventListener('click', () => {
          $('#genre').textContent = option.textContent
          $('#genre').setAttribute('aria-expanded', 'false')
          $('#overlay').innerHTML = ''
        })
      }
    })

    expect(await fill($('#genre'), 'fantasy')).toBe('picked "fantasy" in combobox "Genre"')
    expect($('#genre').textContent).toBe('fantasy')
    await expect(fill($('#genre'), 'poetry')).rejects.toThrow('no option "poetry" in combobox "Genre" — options: "sci-fi", "fantasy"')
  })

  it('a text field is emptied, typed into, then changed', async () => {
    const $ = page('<input id="t" aria-label="Title" value="Dune" />')
    const seen = record($('#t'), ['change'])
    expect(await fill($('#t'), 'Hyperion')).toBe('filled textbox "Title"')
    expect($('#t').value).toBe('Hyperion')
    expect(seen).toEqual(['change'])
  })

  it('a date input is set whole', async () => {
    const $ = page('<input type="date" id="d" aria-label="Due" />')
    expect(await fill($('#d'), '2026-09-11')).toBe('set textbox "Due" [type=date] to "2026-09-11"')
  })
})

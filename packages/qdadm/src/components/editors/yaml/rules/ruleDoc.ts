/**
 * The rule builder's edits (#5581), each a function of the YAML text: what it
 * touches changes, the rest of the file stays as written (comments, key
 * order, layout). The value edits are vanilla-yamleditor's patches; moving
 * and duplicating a list item go through the `yaml` lib's Document, which
 * keeps an item's comments with it.
 */
import { addKey, deleteAt, renameKey, setValue, type YamlPath } from '@quazardous/vanilla-yamleditor'
import { isMap, isSeq, parseDocument, type Node as YamlNode } from 'yaml'

export type { YamlPath }

/** Serialized as the file goes on: no folding of long lines */
const SERIALIZE = { lineWidth: 0, minContentWidth: 0 } as const

function seqAt(text: string, path: YamlPath) {
  const doc = parseDocument(text, { keepSourceTokens: true })
  if (doc.errors.length) throw new Error(doc.errors[0]!.message)
  const node = path.length ? doc.getIn(path, true) : doc.contents
  if (!isSeq(node)) throw new Error(`no list at ${JSON.stringify(path)}`)
  return { doc, seq: node }
}

/**
 * The comment above the first item holds the file's head: up to its last
 * blank line it stays at the top, what follows is the item's own and moves
 * with it. No blank line: all of it is the head.
 */
function keepHead(doc: ReturnType<typeof parseDocument>, first: YamlNode | undefined): void {
  const c = first?.commentBefore
  if (!first || !c) return
  const cut = c.lastIndexOf('\n\n')
  const head = cut < 0 ? c : c.slice(0, cut)
  first.commentBefore = cut < 0 ? undefined : c.slice(cut + 2)
  doc.commentBefore = doc.commentBefore ? `${doc.commentBefore}\n${head}` : head
}

/** A list's item moved to another index, its comments with it */
export function moveItem(text: string, seqPath: YamlPath, from: number, to: number): string {
  if (from === to) return text
  const { doc, seq } = seqAt(text, seqPath)
  if (from < 0 || from >= seq.items.length) return text
  const target = Math.max(0, Math.min(to, seq.items.length - 1))
  const items = seq.items as YamlNode[]
  // The file's head comment is read as the first item's: it stays the head
  if (!seqPath.length && (from === 0 || target === 0)) keepHead(doc, items[0])
  // The blank lines stay where they were: each position keeps its spacing
  const spaces = items.map((i) => i.spaceBefore)
  const [item] = items.splice(from, 1)
  items.splice(target, 0, item!)
  items.forEach((i, k) => { i.spaceBefore = spaces[k] })
  return doc.toString(SERIALIZE)
}

/** A list's item copied right after it; a map's title key (`name`; null: none) gets « (copy) » */
export function duplicateItem(text: string, seqPath: YamlPath, index: number, copySuffix = ' (copy)', titleKey: string | null = 'name'): string {
  const { doc, seq } = seqAt(text, seqPath)
  const item = seq.items[index] as YamlNode | undefined
  if (!item) return text
  const copy = (item as YamlNode & { clone(): YamlNode }).clone()
  if (titleKey && isMap(copy)) {
    const name = copy.get(titleKey)
    if (typeof name === 'string') copy.set(titleKey, `${name}${copySuffix}`)
  }
  seq.items.splice(index + 1, 0, copy)
  return doc.toString(SERIALIZE)
}

/**
 * An item appended to a list, through the Document: vanilla-yamleditor 0.8's
 * addItem indents the later keys of a map of several keys one level too deep
 */
export function addItemAt(text: string, seqPath: YamlPath, value: unknown): string {
  const { doc, seq } = seqAt(text, seqPath)
  // An empty `[]` takes its first item as a block list, not inline
  if (seq.flow && !seq.items.length) seq.flow = false
  seq.items.push(doc.createNode(value) as never)
  return doc.toString(SERIALIZE)
}

/** A rule added at the end of the list; on an empty document, the list itself */
export function addRule(text: string, seqPath: YamlPath, rule: unknown, listValue: unknown): string {
  if (Array.isArray(listValue)) return addItemAt(text, seqPath, rule)
  if (!seqPath.length) {
    const doc = parseDocument(text.trim() ? text : '[]')
    doc.contents = doc.createNode([rule]) as never
    return doc.toString(SERIALIZE)
  }
  return setValue(text, seqPath, [rule])
}

/** An item or a key, gone */
export const removeAt = (text: string, path: YamlPath): string => deleteAt(text, path)

/** A value set in place: its comment and style kept */
export const setAt = (text: string, path: YamlPath, value: unknown): string => setValue(text, path, value)

/** A key added to a map, at its end */
export const addKeyAt = (text: string, mapPath: YamlPath, key: string, value: unknown): string => addKey(text, mapPath, key, value)

/** A key renamed in place: `measure: { refused: … }` → `measure: { refused_ratio: … }` */
export const renameKeyAt = (text: string, mapPath: YamlPath, from: string, to: string): string => renameKey(text, mapPath, from, to)


/** A rule's `enabled`: written only when false is asked, or when it is already there */
export function setEnabled(text: string, rulePath: YamlPath, rule: Record<string, unknown> | null, enabled: boolean): string {
  if (rule && 'enabled' in rule) return setValue(text, [...rulePath, 'enabled'], enabled)
  return enabled ? text : addKey(text, rulePath, 'enabled', false)
}

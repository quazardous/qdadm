#!/usr/bin/env node
/**
 * qdadm-cards (#5339): the index and the bestiary of a folder of cards.
 *
 *   qdadm-cards index <dir> [--index <file>] [--bestiary <file>] [--title <text>]
 *   qdadm-cards check <dir> [--index <file>] [--bestiary <file>] [--title <text>]
 *
 * `check` exits 1 and lists what is wrong: a card without a sheet or a
 * schema, an example that fails its schema, an index or a bestiary out of date.
 */
import { writeCardsIndex, checkCards, type CardsOutputs } from './cardsTool.js'

const [command, dir, ...rest] = process.argv.slice(2)
const outputs: CardsOutputs = {}
for (let i = 0; i < rest.length; i += 2) {
  const value = rest[i + 1]
  if (rest[i] === '--index') outputs.index = value
  else if (rest[i] === '--bestiary') outputs.bestiary = value
  else if (rest[i] === '--title') outputs.title = value
}

if (!dir || (command !== 'index' && command !== 'check')) {
  console.error('usage: qdadm-cards index|check <dir> [--index <file>] [--bestiary <file>] [--title <text>]')
  process.exit(2)
}

if (command === 'index') {
  writeCardsIndex(dir, outputs)
  console.log(`qdadm-cards: wrote ${[outputs.index, outputs.bestiary].filter(Boolean).join(' and ') || 'nothing (no --index nor --bestiary)'}`)
} else {
  const problems = checkCards(dir, outputs)
  for (const p of problems) console.error(`✗ ${p}`)
  if (problems.length) process.exit(1)
  console.log('qdadm-cards: all cards check out')
}

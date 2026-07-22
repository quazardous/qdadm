/**
 * Vendored ESM port of `pluralize@8.0.0` (#1454).
 *
 * qdadm ships raw TS sources; `pluralize` was our only CJS dependency and
 * forced the whole `optimizeDeps.include` machinery in qdadmVitePlugin —
 * which still broke for file:-linked consumers (npm install-links=false)
 * where the dep is never installed at the consumer root. Vendoring removes
 * the dependency class entirely. Rules/irregulars tables are verbatim.
 *
 * Original: https://github.com/plurals/pluralize
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013 Blake Embrey (hello@blakeembrey.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

type Rule = [RegExp, string]

// Rule storage - pluralize and singularize need to be run sequentially,
// while other rules can be optimized using an object for instant lookups.
const pluralRules: Rule[] = []
const singularRules: Rule[] = []
const uncountables: Record<string, boolean> = {}
const irregularPlurals: Record<string, string> = {}
const irregularSingles: Record<string, string> = {}

/**
 * Sanitize a pluralization rule to a usable regular expression.
 */
function sanitizeRule(rule: RegExp | string): RegExp {
  if (typeof rule === 'string') {
    return new RegExp('^' + rule + '$', 'i')
  }

  return rule
}

/**
 * Pass in a word token to produce a function that can replicate the case on
 * another word.
 */
function restoreCase(word: string, token: string): string {
  // Tokens are an exact match.
  if (word === token) return token

  // Lower cased words. E.g. "hello".
  if (word === word.toLowerCase()) return token.toLowerCase()

  // Upper cased words. E.g. "WHISKY".
  if (word === word.toUpperCase()) return token.toUpperCase()

  // Title cased words. E.g. "Title".
  if (word.charAt(0) === word.charAt(0).toUpperCase()) {
    return token.charAt(0).toUpperCase() + token.substring(1).toLowerCase()
  }

  // Lower cased words. E.g. "test".
  return token.toLowerCase()
}

/**
 * Interpolate a regexp string.
 */
function interpolate(str: string, args: IArguments): string {
  return str.replace(/\$(\d{1,2})/g, function (_match, index) {
    return args[index] || ''
  })
}

/**
 * Replace a word using a rule.
 */
function replace(word: string, rule: Rule): string {
  return word.replace(rule[0], function (match, index) {
    // eslint-disable-next-line prefer-rest-params
    const result = interpolate(rule[1], arguments)

    if (match === '') {
      return restoreCase(word.charAt(index - 1), result)
    }

    return restoreCase(match, result)
  })
}

/**
 * Sanitize a word by passing in the word and sanitization rules.
 */
function sanitizeWord(token: string, word: string, rules: Rule[]): string {
  // Empty string or doesn't need fixing.
  if (!token.length || Object.prototype.hasOwnProperty.call(uncountables, token)) {
    return word
  }

  let len = rules.length

  // Iterate over the sanitization rules and use the first one to match.
  while (len--) {
    const rule = rules[len]!

    if (rule[0].test(word)) return replace(word, rule)
  }

  return word
}

/**
 * Replace a word with the updated word.
 */
function replaceWord(
  replaceMap: Record<string, string>,
  keepMap: Record<string, string>,
  rules: Rule[]
): (word: string) => string {
  return function (word: string): string {
    // Get the correct token and case restoration functions.
    const token = word.toLowerCase()

    // Check against the keep object map.
    if (Object.prototype.hasOwnProperty.call(keepMap, token)) {
      return restoreCase(word, token)
    }

    // Check against the replacement map for a direct word replacement.
    if (Object.prototype.hasOwnProperty.call(replaceMap, token)) {
      return restoreCase(word, replaceMap[token]!)
    }

    // Run all the rules against the word.
    return sanitizeWord(token, word, rules)
  }
}

/**
 * Check if a word is part of the map.
 */
function checkWord(
  replaceMap: Record<string, string>,
  keepMap: Record<string, string>,
  rules: Rule[]
): (word: string) => boolean {
  return function (word: string): boolean {
    const token = word.toLowerCase()

    if (Object.prototype.hasOwnProperty.call(keepMap, token)) return true
    if (Object.prototype.hasOwnProperty.call(replaceMap, token)) return false

    return sanitizeWord(token, token, rules) === token
  }
}

/**
 * Pluralize a word.
 */
const plural = replaceWord(irregularSingles, irregularPlurals, pluralRules)

/**
 * Check if a word is plural.
 */
const isPlural = checkWord(irregularSingles, irregularPlurals, pluralRules)

/**
 * Singularize a word.
 */
const singular = replaceWord(irregularPlurals, irregularSingles, singularRules)

/**
 * Check if a word is singular.
 */
const isSingular = checkWord(irregularPlurals, irregularSingles, singularRules)

/**
 * Pluralize or singularize a word based on the passed in count.
 */
function pluralize(word: string, count?: number, inclusive?: boolean): string {
  const pluralized = count === 1 ? singular(word) : plural(word)

  return (inclusive ? count + ' ' : '') + pluralized
}

function addPluralRule(rule: RegExp | string, replacement: string): void {
  pluralRules.push([sanitizeRule(rule), replacement])
}

function addSingularRule(rule: RegExp | string, replacement: string): void {
  singularRules.push([sanitizeRule(rule), replacement])
}

function addUncountableRule(word: RegExp | string): void {
  if (typeof word === 'string') {
    uncountables[word.toLowerCase()] = true
    return
  }

  // Set singular and plural references for the word.
  addPluralRule(word, '$0')
  addSingularRule(word, '$0')
}

function addIrregularRule(single: string, plural: string): void {
  plural = plural.toLowerCase()
  single = single.toLowerCase()

  irregularSingles[single] = plural
  irregularPlurals[plural] = single
}

/**
 * Irregular rules.
 */
;(
  [
    // Pronouns.
    ['I', 'we'],
    ['me', 'us'],
    ['he', 'they'],
    ['she', 'they'],
    ['them', 'them'],
    ['myself', 'ourselves'],
    ['yourself', 'yourselves'],
    ['itself', 'themselves'],
    ['herself', 'themselves'],
    ['himself', 'themselves'],
    ['themself', 'themselves'],
    ['is', 'are'],
    ['was', 'were'],
    ['has', 'have'],
    ['this', 'these'],
    ['that', 'those'],
    // Words ending in with a consonant and `o`.
    ['echo', 'echoes'],
    ['dingo', 'dingoes'],
    ['volcano', 'volcanoes'],
    ['tornado', 'tornadoes'],
    ['torpedo', 'torpedoes'],
    // Ends with `us`.
    ['genus', 'genera'],
    ['viscus', 'viscera'],
    // Ends with `ma`.
    ['stigma', 'stigmata'],
    ['stoma', 'stomata'],
    ['dogma', 'dogmata'],
    ['lemma', 'lemmata'],
    ['schema', 'schemata'],
    ['anathema', 'anathemata'],
    // Other irregular rules.
    ['ox', 'oxen'],
    ['axe', 'axes'],
    ['die', 'dice'],
    ['yes', 'yeses'],
    ['foot', 'feet'],
    ['eave', 'eaves'],
    ['goose', 'geese'],
    ['tooth', 'teeth'],
    ['quiz', 'quizzes'],
    ['human', 'humans'],
    ['proof', 'proofs'],
    ['carve', 'carves'],
    ['valve', 'valves'],
    ['looey', 'looies'],
    ['thief', 'thieves'],
    ['groove', 'grooves'],
    ['pickaxe', 'pickaxes'],
    ['passerby', 'passersby'],
  ] as Array<[string, string]>
).forEach((rule) => addIrregularRule(rule[0], rule[1]))

/**
 * Pluralization rules.
 */
;(
  [
    [/s?$/i, 's'],
    [/[^\u0000-\u007F]$/i, '$0'],
    [/([^aeiou]ese)$/i, '$1'],
    [/(ax|test)is$/i, '$1es'],
    [/(alias|[^aou]us|t[lm]as|gas|ris)$/i, '$1es'],
    [/(e[mn]u)s?$/i, '$1s'],
    [/([^l]ias|[aeiou]las|[ejzr]as|[iu]am)$/i, '$1'],
    [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1i'],
    [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
    [/(seraph|cherub)(?:im)?$/i, '$1im'],
    [/(her|at|gr)o$/i, '$1oes'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, '$1a'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i, '$1a'],
    [/sis$/i, 'ses'],
    [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
    [/([^aeiouy]|qu)y$/i, '$1ies'],
    [/([^ch][ieo][ln])ey$/i, '$1ies'],
    [/(x|ch|ss|sh|zz)$/i, '$1es'],
    [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
    [/\b((?:tit)?m|l)(?:ice|ouse)$/i, '$1ice'],
    [/(pe)(?:rson|ople)$/i, '$1ople'],
    [/(child)(?:ren)?$/i, '$1ren'],
    [/eaux$/i, '$0'],
    [/m[ae]n$/i, 'men'],
    ['thou', 'you'],
  ] as Array<[RegExp | string, string]>
).forEach((rule) => addPluralRule(rule[0], rule[1]))

/**
 * Singularization rules.
 */
;(
  [
    [/s$/i, ''],
    [/(ss)$/i, '$1'],
    [/(wi|kni|(?:after|half|high|low|mid|non|night|[^\w]|^)li)ves$/i, '$1fe'],
    [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
    [/ies$/i, 'y'],
    [/\b([pl]|zomb|(?:neck|cross)?t|coll|faer|food|gen|goon|group|lass|talk|goal|cut)ies$/i, '$1ie'],
    [/\b(mon|smil)ies$/i, '$1ey'],
    [/\b((?:tit)?m|l)ice$/i, '$1ouse'],
    [/(seraph|cherub)im$/i, '$1'],
    [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|t[lm]as|gas|(?:her|at|gr)o|[aeiou]ris)(?:es)?$/i, '$1'],
    [/(analy|diagno|parenthe|progno|synop|the|empha|cri|ne)(?:sis|ses)$/i, '$1sis'],
    [/(movie|twelve|abuse|e[mn]u)s$/i, '$1'],
    [/(test)(?:is|es)$/i, '$1is'],
    [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1us'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i, '$1um'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i, '$1on'],
    [/(alumn|alg|vertebr)ae$/i, '$1a'],
    [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
    [/(matr|append)ices$/i, '$1ix'],
    [/(pe)(rson|ople)$/i, '$1rson'],
    [/(child)ren$/i, '$1'],
    [/(eau)x?$/i, '$1'],
    [/men$/i, 'man'],
  ] as Array<[RegExp | string, string]>
).forEach((rule) => addSingularRule(rule[0], rule[1]))

/**
 * Uncountable rules.
 */
;(
  [
    // Singular words with no plurals.
    'adulthood',
    'advice',
    'agenda',
    'aid',
    'aircraft',
    'alcohol',
    'ammo',
    'analytics',
    'anime',
    'athletics',
    'audio',
    'bison',
    'blood',
    'bream',
    'buffalo',
    'butter',
    'carp',
    'cash',
    'chassis',
    'chess',
    'clothing',
    'cod',
    'commerce',
    'cooperation',
    'corps',
    'debris',
    'diabetes',
    'digestion',
    'elk',
    'energy',
    'equipment',
    'excretion',
    'expertise',
    'firmware',
    'flounder',
    'fun',
    'gallows',
    'garbage',
    'graffiti',
    'hardware',
    'headquarters',
    'health',
    'herpes',
    'highjinks',
    'homework',
    'housework',
    'information',
    'jeans',
    'justice',
    'kudos',
    'labour',
    'literature',
    'machinery',
    'mackerel',
    'mail',
    'media',
    'mews',
    'moose',
    'music',
    'mud',
    'manga',
    'news',
    'only',
    'personnel',
    'pike',
    'plankton',
    'pliers',
    'police',
    'pollution',
    'premises',
    'rain',
    'research',
    'rice',
    'salmon',
    'scissors',
    'series',
    'sewage',
    'shambles',
    'shrimp',
    'software',
    'species',
    'staff',
    'swine',
    'tennis',
    'traffic',
    'transportation',
    'trout',
    'tuna',
    'wealth',
    'welfare',
    'whiting',
    'wildebeest',
    'wildlife',
    'you',
    /pok[eé]mon$/i,
    // Regexes.
    /[^aeiou]ese$/i, // "chinese", "japanese"
    /deer$/i, // "deer", "reindeer"
    /fish$/i, // "fish", "blowfish", "angelfish"
    /measles$/i,
    /o[iu]s$/i, // "carnivorous"
    /pox$/i, // "chickpox", "smallpox"
    /sheep$/i,
  ] as Array<RegExp | string>
).forEach(addUncountableRule)

pluralize.plural = plural
pluralize.isPlural = isPlural
pluralize.singular = singular
pluralize.isSingular = isSingular
pluralize.addPluralRule = addPluralRule
pluralize.addSingularRule = addSingularRule
pluralize.addUncountableRule = addUncountableRule
pluralize.addIrregularRule = addIrregularRule

export { plural, isPlural, singular, isSingular, addPluralRule, addSingularRule, addUncountableRule, addIrregularRule }
export default pluralize

/**
 * Type declarations for pluralize module
 */
declare module 'pluralize' {
  function pluralize(word: string, count?: number, inclusive?: boolean): string

  namespace pluralize {
    function plural(word: string): string
    function singular(word: string): string
    function isPlural(word: string): boolean
    function isSingular(word: string): boolean
    function addPluralRule(rule: string | RegExp, replacement: string): void
    function addSingularRule(rule: string | RegExp, replacement: string): void
    function addIrregularRule(single: string, plural: string): void
    function addUncountableRule(word: string | RegExp): void
  }

  export = pluralize
}

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettierConfig,
  {
    // Raw widget imports go through the Qd* wrappers (#1391) — importing
    // primevue/button|message anywhere else reopens the exposure the
    // wrappers exist to shrink.
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/components/base/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'primevue/button', message: 'Use QdButton (components/base) — #1391.' },
            { name: 'primevue/message', message: 'Use QdMessage (components/base) — #1391.' },
          ],
        },
      ],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  }
)

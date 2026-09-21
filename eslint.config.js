// eslint.config.js
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const NODE_BUILTIN_PATHS = ['fs', 'fs/promises', 'path', 'child_process', 'crypto', 'os'];
const NODE_GLOBALS = ['process', '__dirname', '__filename', 'require', 'module'];
const BROWSER_GLOBALS = ['document', 'window', 'localStorage', 'sessionStorage', 'customElements'];

export default defineConfig([
  // Cannot use browser (or import from who uses it)
  {
    files: ['src/scripts/node/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/browser/**'] }],
      'no-restricted-globals': ['error', ...BROWSER_GLOBALS],
    },
  },

  // Browser cannot import from Node (or import from who uses it)
  {
    files: ['src/scripts/browser/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': ['error', {
        paths: NODE_BUILTIN_PATHS,
        patterns: ['node:*','**/node/**'],
      }],
      'no-restricted-globals': ['error', ...NODE_GLOBALS],
    },
  },

  // tools, errors cannot use DOM or Node 
  // (or import from who uses them)
  {
    files: [
      'src/tools/**/*.mjs', 
      'src/errors/**/*.mjs'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': ['error', {
        paths: NODE_BUILTIN_PATHS,
        patterns: ['node:*', '**/browser/**', '**/node/**'],
      }],
      'no-restricted-globals': ['error', ...NODE_GLOBALS, ...BROWSER_GLOBALS],
    },
  },

  { // shared can only import types from browser and node folders
  files: ['src/scripts/shared/**/*.ts'],
  languageOptions: { parser: tseslint.parser },
  plugins: { '@typescript-eslint': tsPlugin },
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', {
      patterns: [
        { group: ['**/node/**'], allowTypeImports: true },
        { group: ['**/browser/**'], allowTypeImports: true },
      ],
    }],
    'no-restricted-imports': ['error', {
        paths: NODE_BUILTIN_PATHS,
        patterns: ['node:*'],
      }],
    'no-restricted-globals': ['error', ...NODE_GLOBALS, ...BROWSER_GLOBALS],
  },
},

  // Data cannot import at all; cannot use DOM
  {
    files: ['src/data/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      'no-restricted-imports': ['error', { patterns: ['*', '**/*'] }],
    },
  },
]);
// Import from the official ESLint config helper, NOT typescript-eslint
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores(["dist"]),

  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],

    languageOptions: {
      globals: globals.node,
    },
    rules: {
        '@typescript-eslint/no-empty-object-type': 'off',
    }
  },

  eslintConfigPrettier,
]);

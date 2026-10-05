// Obsidian's own review rules, the same ones it runs on every release.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "node_modules/", ".test-build/", "test-vault/", "old/", "scripts/", "rollup.config.js", "eslint.config.mjs", "target/"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.*"] },
      },
    },
  },
]);

// Lint-Staged configuration for staged files (v16+)
// Mirrors the config previously in package.json's "lint-staged" key.
/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Release version from git tags and commit messages; see scripts/version.mjs. */
const version = execFileSync('node', [fileURLToPath(new URL('./scripts/version.mjs', import.meta.url))]).toString().trim();

/** Short commit of the build: CI's checkout, else the local repo, else unknown (e.g. Docker, which has no .git). */
function buildCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

const commit = buildCommit();

/** Emits dist/version.json so idlemullet.com can read the live deployed game version. */
function versionManifestPlugin(): Plugin {
  const manifest = JSON.stringify({ version: `v${version.replace(/^v/, '')}`, commit });
  return {
    name: 'version-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: manifest });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_URL ?? (process.env.PALLET_BROWSER_TEST === '1' ? '/' : '/idle-distribution/'),
  plugins: [react(), wasm(), topLevelAwait(), versionManifestPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  // Browser tests use a fixed build; cloud-sync file events must not reload mid-gesture.
  server: process.env.PALLET_BROWSER_TEST === '1' ? { watch: null } : undefined,
  // The Playwright server and an open dev preview must not rewrite each other's dependency cache.
  cacheDir: process.env.PALLET_BROWSER_TEST === '1' ? 'node_modules/.vite-browser-tests' : 'node_modules/.vite',
});

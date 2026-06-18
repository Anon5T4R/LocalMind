// Patches dependencies that use Node >=20.10 import-attribute syntax
// (`import x from './y.json' with { type: 'json' }`) so they load under the
// Node 20.9 bundled by Electron 29. Idempotent; safe to run repeatedly.
//
// Runs automatically via the "postinstall" npm script.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const targets = [
  {
    file: 'node_modules/node-llama-cpp/node_modules/cli-spinners/index.js',
    needle: /import\s+spinners\s+from\s+['"]\.\/spinners\.json['"]\s+with\s*\{[^}]*\};?/,
    replacement: `import { readFileSync as __rfs } from 'node:fs';\nimport { fileURLToPath as __f2p } from 'node:url';\nconst spinners = JSON.parse(__rfs(__f2p(new URL('./spinners.json', import.meta.url)), 'utf8'));`
  }
]

let patched = 0
for (const t of targets) {
  const abs = root + t.file
  if (!existsSync(abs)) continue
  const src = readFileSync(abs, 'utf8')
  if (!t.needle.test(src)) continue // already patched or shape changed
  writeFileSync(abs, src.replace(t.needle, t.replacement), 'utf8')
  console.log('[patch-deps] patched', t.file)
  patched++
}
if (patched === 0) console.log('[patch-deps] nothing to patch (already clean)')

import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { projectRoot } from '../lib/project.mjs'

const cli = path.join(path.dirname(realpathSync(path.join(projectRoot, 'node_modules/@slidev/cli/package.json'))), 'bin/slidev.mjs')
const base = process.env.PAGES_BASE_PATH === undefined
  ? './'
  : `${process.env.PAGES_BASE_PATH.replace(/\/$/, '')}/`

function build(entry, outDir, siteBase, env = {}) {
  const result = spawnSync(process.execPath, [cli, 'build', entry, '--out', outDir, '--base', siteBase, '--router-mode', 'hash'], {
    cwd: projectRoot,
    env: { ...process.env, EDUFORUM_DECK: '', VITE_SHARED_ASSET_BASE: '', ...env },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

build('slides.md', 'dist', base)
build('mru.md', 'dist/mru', base === './' ? './' : `${base}mru/`, {
  EDUFORUM_DECK: 'mru',
  VITE_SHARED_ASSET_BASE: base === './' ? '../' : base,
})

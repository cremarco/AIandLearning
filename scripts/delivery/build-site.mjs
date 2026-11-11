import { spawnSync } from 'node:child_process'
import { copyFileSync, realpathSync, rmSync } from 'node:fs'
import path from 'node:path'
import { projectRoot } from '../lib/project.mjs'

const cli = path.join(path.dirname(realpathSync(path.join(projectRoot, 'node_modules/@slidev/cli/package.json'))), 'bin/slidev.mjs')
const base = process.env.PAGES_BASE_PATH === undefined
  ? './'
  : `${process.env.PAGES_BASE_PATH.replace(/\/$/, '')}/`

function build(entry, outDir, siteBase, env = {}, extraArgs = []) {
  const result = spawnSync(process.execPath, [cli, 'build', entry, '--out', outDir, '--base', siteBase, '--router-mode', 'hash', ...extraArgs], {
    cwd: projectRoot,
    env: { ...process.env, EDUFORUM_DECK: '', EDUFORUM_PUBLIC_OUT_DIR: '', VITE_SHARED_ASSET_BASE: '', ...env },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

rmSync(path.join(projectRoot, 'dist'), { recursive: true, force: true })
build('slides.md', 'dist/eduforum', base === './' ? './' : `${base}eduforum/`, {
  EDUFORUM_PUBLIC_OUT_DIR: 'dist',
  VITE_SHARED_ASSET_BASE: base === './' ? '../' : base,
})
build('mru.md', 'dist/mru', base === './' ? './' : `${base}mru/`, {
  EDUFORUM_DECK: 'mru',
  VITE_SHARED_ASSET_BASE: base === './' ? '../' : base,
}, ['--without-notes'])
build('druskininkai.md', 'dist/druskininkai', base === './' ? './' : `${base}druskininkai/`, {
  EDUFORUM_DECK: 'druskininkai',
  VITE_SHARED_ASSET_BASE: base === './' ? '../' : base,
})
copyFileSync(path.join(projectRoot, 'pages/index.html'), path.join(projectRoot, 'dist/index.html'))

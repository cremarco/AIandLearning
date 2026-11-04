import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const publicRoot = path.resolve(import.meta.dirname, '../public')
async function collect(directory) {
  const files = await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(async entry => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'models' ? [] : collect(filename)
    return /\.(html|css)$/.test(filename) ? [filename] : []
  }))
  return files.flat()
}

const missing = []
const files = await collect(publicRoot)
let checked = 0
for (const file of files) {
  const text = await fs.readFile(file, 'utf8')
  const references = file.endsWith('.html')
    ? [...text.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)].map(match => match[1])
    : [...text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(match => match[1])
  for (const reference of references) {
    if (!reference || /^(?:[\w+.-]+:|\/\/|#)/.test(reference)) continue
    const pathname = decodeURIComponent(reference.replaceAll('&amp;', '&')).split(/[?#]/)[0]
    if (!pathname || pathname === '/') continue
    const target = pathname.startsWith('/')
      ? path.resolve(publicRoot, `.${pathname}`)
      : path.resolve(path.dirname(file), pathname)
    const present = await fs.stat(target).then(async stat => stat.isDirectory()
      ? fs.access(path.join(target, 'index.html')).then(() => true, () => false)
      : true, () => false)
    checked++
    if (!present) missing.push({ file: path.relative(publicRoot, file), reference })
  }
}
assert.deepEqual(missing, [], 'Published materials must not contain broken local links')
console.log(`Local links passed: ${checked} references across ${files.length} HTML/CSS files.`)

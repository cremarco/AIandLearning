import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(root, 'public')
const imageExtension = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i
const sourceExtension = /\.(?:css|json|md|mjs|ts|vue)$/i

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
    .catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
  const nested = await Promise.all(entries.filter(entry => !entry.name.startsWith('.')).map(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  }))
  return nested.flat()
}

// Scan authoring inputs, not generated HTML or historical provenance: otherwise
// an obsolete output or generation record can make an unused image look active.
const sourceFiles = (await Promise.all(
  ['components', 'data', 'setup', 'styles', 'utils'].map(name => filesIn(path.join(root, name))),
)).flat().filter(file => sourceExtension.test(file))
const sources = await Promise.all(sourceFiles.map(async file => ({
  file: path.relative(root, file), text: await fs.readFile(file, 'utf8'),
})))
const imageFiles = (await Promise.all(['images', 'icons'].map(name => filesIn(path.join(publicRoot, name)))))
  .flat().filter(file => imageExtension.test(file))
const available = new Set(imageFiles.map(file => path.relative(publicRoot, file)))
const imageFolders = new Set([...available].filter(file => file.startsWith('images/')).map(file => file.split('/')[1]))
const used = new Set()
const missing = new Map()

for (const source of sources) {
  // Includes literal imageUrl('universities/...') calls and asset paths in JSON.
  for (const match of source.text.matchAll(/['"`]((?:\.?\.?\/)?[\w./-]+\.(?:avif|gif|ico|jpe?g|png|svg|webp))['"`]/gi)) {
    let name = match[1].replace(/^\.\//, '')
    if (!name.startsWith('images/') && !name.startsWith('icons/')) {
      if (!imageFolders.has(name.split('/')[0])) continue
      name = `images/${name}`
    }
    if (available.has(name)) used.add(name)
    else missing.set(name, [...(missing.get(name) || []), source.file])
  }
}

const unused = [...available].filter(file => !used.has(file)).sort()
const unusedBytes = (await Promise.all(unused.map(file => fs.stat(path.join(publicRoot, file)))))
  .reduce((sum, stat) => sum + stat.size, 0)
const report = {
  checkedImages: available.size,
  referencedImages: used.size,
  missing: [...missing].map(([file, references]) => ({ file, references })),
  unused,
  unusedBytes,
}
console.log(JSON.stringify(report, null, 2))
if (report.missing.length || unused.length) process.exitCode = 1

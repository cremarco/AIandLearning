import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { projectPath, projectRoot, readJson } from '../lib/project.mjs'

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === '__pycache__') return []
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  })
}

const sourceFiles = ['components', 'composables', 'utils', 'setup', 'scripts', 'tests', 'booklet-genai/scripts']
  .flatMap(directory => filesIn(projectPath(directory)))
  .filter(file => /\.(vue|ts|mjs)$/.test(file))
sourceFiles.push(projectPath('vite.config.ts'))
const unresolved = []
const referenced = new Set()
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8')
  const imports = [
    ...text.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g),
    ...text.matchAll(/<style\s+src=['"](\.[^'"]+)['"]/g),
  ]
  for (const [, specifier] of imports) {
    const target = path.resolve(path.dirname(file), specifier)
    const resolved = [target, ...['.ts', '.vue', '.mjs', '.js', '.json', '/index.ts'].map(ext => target + ext)]
      .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    if (resolved) referenced.add(resolved)
    else unresolved.push({ file: path.relative(projectRoot, file), specifier })
  }
}
assert.deepEqual(unresolved, [], 'Local imports must resolve after reorganizing source files')
// Slidev also resolves components used directly in Markdown without imports.
const markdown = fs.readFileSync(projectPath('slides.md'), 'utf8')
for (const file of sourceFiles.filter(file => file.endsWith('.vue'))) {
  if (markdown.includes(`<${path.basename(file, '.vue')}`)) referenced.add(file)
}
const unused = sourceFiles.filter(file => file.endsWith('.vue') && !referenced.has(file))
assert.deepEqual(unused, [], 'Remove components that are not referenced by the presentation')

const opening = readJson('data/content/opening-slides.json')
const workshop = readJson('data/content/workshop-slides.json')
const ids = new Set([...opening, ...workshop].map(slide => slide.id))
for (const name of ['media', 'editorial-overrides', 'highlights']) {
  const orphans = Object.keys(readJson(`data/content/${name}.json`)).filter(id => !ids.has(id))
  assert.deepEqual(orphans, [], `${name}: remove entries for slides no longer in the deck`)
}
for (const slide of workshop) {
  for (const field of ['number', 'output', 'guardrails']) {
    assert(!Object.hasOwn(slide, field), `${slide.id}: ${field} is obsolete authoring metadata`)
  }
}
for (const command of Object.values(readJson('package.json').scripts)) {
  for (const [, filename] of command.matchAll(/\bnode\s+([^\s]+\.mjs)/g)) {
    assert(fs.existsSync(projectPath(filename)), `Missing script entry point: ${filename}`)
  }
}
console.log(`Structure checks passed: ${sourceFiles.length} source files, resolved imports, referenced components and ${ids.size} authored slides.`)

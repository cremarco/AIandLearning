import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
export const projectPath = (...segments) => path.resolve(projectRoot, ...segments)

export function readJson(filename, fallback) {
  const target = projectPath(filename)
  if (arguments.length > 1 && !fs.existsSync(target)) return fallback
  return JSON.parse(fs.readFileSync(target, 'utf8'))
}

export function writeJson(filename, value) {
  const target = projectPath(filename)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

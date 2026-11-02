import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-chromium'

// Prefer Playwright's matching revision. Local checks can also reuse an
// installed Chromium when the package was updated without its browser download.
function cachedChromium() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'darwin'
    ? join(homedir(), 'Library/Caches/ms-playwright')
    : process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA || homedir(), 'ms-playwright')
      : join(homedir(), '.cache/ms-playwright'))
  if (!existsSync(cache)) return undefined
  const versions = readdirSync(cache)
    .filter(name => /^chromium(?:_headless_shell)?-\d+$/.test(name))
    .sort((a, b) => Number(b.match(/\d+$/)[0]) - Number(a.match(/\d+$/)[0])
      || Number(b.startsWith('chromium_headless_shell')) - Number(a.startsWith('chromium_headless_shell')))
  for (const version of versions) {
    const candidates = [
      'chrome-headless-shell-mac-arm64/chrome-headless-shell',
      'chrome-headless-shell-mac-x64/chrome-headless-shell',
      'chrome-headless-shell-linux64/chrome-headless-shell',
      'chrome-headless-shell-win64/chrome-headless-shell.exe',
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      'chrome-linux/chrome',
      'chrome-linux64/chrome',
      'chrome-win/chrome.exe',
      'chrome-win64/chrome.exe',
    ]
    for (const candidate of candidates) {
      const executable = join(cache, version, candidate)
      if (existsSync(executable)) return executable
    }
  }
}

export function browserExecutable() {
  return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync(chromium.executablePath()) ? chromium.executablePath() : cachedChromium())
}

export function launchBrowser(options = {}) {
  const executablePath = options.executablePath || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || (!existsSync(chromium.executablePath()) ? cachedChromium() : undefined)
  return chromium.launch({ ...options, ...(executablePath ? { executablePath } : {}) })
}

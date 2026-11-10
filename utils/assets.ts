/** Resolve public assets and material links in both local and relative-base builds. */
export function assetUrl(path: string): string
export function assetUrl(path: string | undefined): string | undefined
export function assetUrl(path: string | undefined) {
  if (path === undefined) return undefined
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) return path
  return `${import.meta.env.VITE_SHARED_ASSET_BASE || import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`
}

export const imageUrl = (name: string) => assetUrl(`images/${name}`)

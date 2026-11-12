// Translate presentation text while preserving original recordings, prompts,
// citations, command names and technical metadata.
const originalFields = new Set([
  'id', 'sourceId', 'type', 'kind', 'section', 'tool', 'audience', 'sources', 'skillIds',
  'command', 'commandCategory', 'videoLayout', 'fit', 'key', 'tone', 'primary', 'secondary',
  'lang', 'status', 'executionStatus', 'reviewStatus', 'recordingMode', 'refreshReleaseId',
  'url', 'src', 'poster', 'captions', 'transcript', 'transcriptFile', 'sha256', 'sourceSha256',
  'provenance', 'source', 'icon', 'mediaType', 'prompt', 'instruction', 'instructionExcerpt',
  'citation', 'notebookOutput', 'stepsLayout', 'cardBackground', 'cover', 'front', 'back',
  'happy', 'worried',
])

export function translateContent(value, dictionary, field = '') {
  if (originalFields.has(field)) return value
  if (typeof value === 'string') return dictionary[value] || value
  if (Array.isArray(value)) return value.map(item => translateContent(item, dictionary, field))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, translateContent(item, dictionary, key)]))
  return value
}

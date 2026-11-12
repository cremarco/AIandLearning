/** Remove presenter-only Markdown while keeping spoken words and proper names. */
export function plainSpeakerNotes(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('Note del relatore mancanti.')
  const plain = source.replace(/\*\*/g, '').replace(/\[click\]\s*/g, '')
    .replace(/\\(?=\r?\n)/g, '').trim()
  if (/[\[\]]/.test(plain)) throw new Error('Tag del relatore non riconosciuto.')
  return plain
}

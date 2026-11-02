import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Keep spoken words separate from source checks and stage directions.
export function loadSpeakerNotes(slides) {
  const slideIds = new Set(slides.map(slide => slide.id))
  const notes = Object.fromEntries(Object.entries(JSON.parse(readFileSync(new URL('../data/speaker-notes.json', import.meta.url), 'utf8')))
    .filter(([id]) => slideIds.has(id)))
  assert.deepEqual(Object.keys(notes).sort(), slides.map(slide => slide.id).sort(), 'Every slide needs one bilingual script')
  for (const [id, note] of Object.entries(notes)) {
    for (const language of ['it']) {
      assert.equal(typeof note[language], 'string', `${id}: missing ${language} script`)
      assert.ok(note[language].trim().length > 60, `${id}: the script must contain actual spoken words`)
      assert.ok(Array.isArray(note.cues?.[language]), `${id}: missing ${language} stage directions`)
      assert.ok(note.cues[language].every(cue => typeof cue === 'string' && cue.trim()), `${id}: empty stage direction`)
      if (note.forum_extra) assert.ok(typeof note.forum_extra[language] === 'string' && note.forum_extra[language].trim(), `${id}: incomplete Forum addition`)
    }
  }
  return notes
}

export function scriptSections(note, language, { includeForumExtra = true, route } = {}) {
  if (route && note.route_scripts?.[route]) {
    const variant = note.route_scripts[route]
    note = { ...note, it:variant.it, cues:{it:variant.cues}, forum_extra:undefined }
  }
  const it = language === 'it'
  const lines = []
  if (note.cues[language].length) {
    lines.push(it ? '### Azioni del relatore — non leggere ad alta voce' : '### Presenter actions — do not read aloud', '')
    lines.push(...note.cues[language].map(cue => `- ${cue}`), '')
  }
  lines.push(it ? '### Copione — parole da pronunciare' : '### Script — words to say', '', note[language].trim(), '')
  if (includeForumExtra && note.forum_extra) {
    lines.push(it ? '### Solo Forum — aggiunta facoltativa da pronunciare' : '### Forum only — optional extra words to say', '', note.forum_extra[language].trim(), '')
  }
  return lines
}

export function bilingualScript(note) {
  return [
    '## Italiano', '', ...scriptSections(note, 'it'),
  ].join('\n')
}

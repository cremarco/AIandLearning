import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { projectRoot as root, readJson } from '../lib/project.mjs'
import { translateContent } from '../../utils/translate-content.mjs'
import { plainSpeakerNotes } from '../../utils/narration-text.mjs'
import { buildNarrationReveals } from '../../utils/narration-reveals.mjs'
const deck = process.argv[2] || 'eduforum'
if (!['eduforum', 'druskininkai'].includes(deck)) throw new Error(`Unknown deck: ${deck}`)
const isDruskininkai = deck === 'druskininkai'
const deckLabel = isDruskininkai ? 'Druskininkai' : 'EduForum'
const notesFile = isDruskininkai ? 'data/druskininkai/speaker-notes.json' : 'data/content/speaker-notes.json'
const sourceSlides = readJson(isDruskininkai ? 'data/druskininkai/slides.json' : 'data/generated/slides.json')
const originalNotes = readJson(notesFile)
const lithuanianNotes = isDruskininkai ? readJson('data/druskininkai/speaker-notes.lt.json') : {}
const lithuanian = isDruskininkai ? readJson('data/druskininkai/lt.json') : {}
const slides = isDruskininkai ? sourceSlides.flatMap(slide => [
  { ...slide, sourceId: slide.id, lang: 'en' },
  { ...translateContent(slide, lithuanian), id: `${slide.id}LT`, sourceId: slide.id, lang: 'lt' },
]).map((slide, index) => ({ ...slide, number: index + 1 })) : sourceSlides
const speakerNotes = Object.fromEntries(slides.map(slide => [slide.id,
  (slide.lang === 'lt' ? lithuanianNotes : originalNotes)[slide.sourceId || slide.id],
]))
if (isDruskininkai) {
  const recordings = readJson('public/audio/druskininkai/manifest.json', { clips: [] })
  const captions = readJson('data/druskininkai/narration/captions/manifest.json', { clips: {} })
  for (const slide of slides.filter(slide => slide.lang === 'lt')) {
    const currentText = plainSpeakerNotes(speakerNotes[slide.id])
    const clip = recordings.clips.findLast(clip => clip.alias === slide.id.toLowerCase()
      && clip.settings.languageCode === slide.lang && clip.plainText === currentText)
    if (clip && clip.file.startsWith('public/audio/druskininkai/') && existsSync(path.join(root, clip.file))) {
      slide.narrationAudio = { src: clip.file.slice('public/'.length), lang: slide.lang }
      const caption = captions.clips[clip.alias]
      if (caption?.audioSha256 === clip.audioSha256 && caption.textSha256 === clip.plainTextSha256
        && existsSync(path.join(root, 'public', caption.web))) {
        slide.narrationAudio.captions = caption.web
        if (slide.clicks) {
          const alignment = readJson(caption.wordsSource)
          slide.narrationAudio.reveals = buildNarrationReveals(speakerNotes[slide.id], alignment.words, slide.clicks)
        }
      }
    }
  }
  writeFileSync(path.join(root, 'data/druskininkai/slides-runtime.json'), `${JSON.stringify(slides, null, 2)}\n`)
  const highlights = readJson('data/druskininkai/highlights.json')
  const bilingualHighlights = Object.fromEntries(slides.map(slide => [slide.id,
    slide.lang === 'lt' ? translateContent(highlights[slide.sourceId] || [], lithuanian) : highlights[slide.sourceId] || [],
  ]))
  writeFileSync(path.join(root, 'data/druskininkai/highlights-runtime.json'), `${JSON.stringify(bilingualHighlights, null, 2)}\n`)
}
const yaml = value => JSON.stringify(value)

const headmatter = `---
theme: apple-basic
layout: default
title: ${yaml(slides[0].title + (isDruskininkai ? ' · Druskininkai' : ''))}
author: Marco Cremaschi
info: ${yaml(slides[0].message)}
favicon: /favicon.ico
seoMeta:
  ogTitle: "Beyond prompting · ${deckLabel}"
  ogDescription: ${yaml(slides[0].message)}
  ogImage: https://cremarco.github.io/AIandLearning/social-preview.png
  ogUrl: https://cremarco.github.io/AIandLearning/${deck}/
  twitterCard: summary_large_image
  twitterTitle: "Beyond prompting · ${deckLabel}"
  twitterDescription: ${yaml(slides[0].message)}
  twitterImage: https://cremarco.github.io/AIandLearning/social-preview.png
canvasWidth: 1280
aspectRatio: 16/9
colorSchema: dark
wakeLock: false
fonts:
  sans: SF Pro Display, SF Pro Text, Helvetica Neue, sans-serif
  provider: none
transition: fade
drawings:
  persist: false
mdc: true
preload: false
---
`

const slideBlocks = slides.map((slide, index) => {
  const frontmatter = index ? [
    '---',
    'layout: default',
    `routeAlias: ${slide.id.toLowerCase()}`,
    `title: ${yaml(slide.title)}`,
    ...(slide.hide ? ['hide: true'] : []),
    ...(slide.clicks ? [`clicks: ${slide.clicks}`] : []),
    '---',
    '',
    '',
  ].join('\n') : ''

  const notes = speakerNotes[slide.id]?.trim()
  if (!notes) throw new Error(`${slide.id}: missing ${slide.lang || 'en'} speaker notes`)
  // Slidev renders this Markdown in presenter mode, outside the audience canvas.
  return `${frontmatter}<DeckSlide id="${slide.id}" />\n\n<!--\n${notes}\n-->\n`
})

writeFileSync(path.join(root, isDruskininkai ? 'druskininkai.md' : 'slides.md'), `${headmatter}\n${slideBlocks.join('\n')}`)
const readingCopy = ['# Speaker notes · Beyond prompting',
  `Concise spoken scripts in simple English for rehearsal. Bold text marks the key words; [click] markers follow the slide reveals. Edit \`${notesFile}\`, then run \`pnpm generate\` to update this copy and Slidev presenter mode.`,
  ...slides.filter(slide => slide.lang !== 'lt').map(slide => `## ${slide.number}. ${slide.title}\n\n${speakerNotes[slide.id]}`),
].join('\n\n')
writeFileSync(path.join(root, isDruskininkai ? 'docs/speaker-notes.druskininkai.en.md' : 'docs/speaker-notes.en.md'), `${readingCopy}\n`)
if (isDruskininkai) {
  const lithuanianCopy = ['# Pranešėjo pastabos · Beyond prompting',
    'Pastabos lituaniškoms skaidrėms. Paryškinti žodžiai žymi pagrindines mintis, o [click] – paspaudimus. Redaguokite `data/druskininkai/speaker-notes.lt.json` ir paleiskite `pnpm generate`.',
    ...slides.filter(slide => slide.lang === 'lt').map(slide => `## ${slide.number}. ${slide.title}\n\n${speakerNotes[slide.id]}`),
  ].join('\n\n')
  writeFileSync(path.join(root, 'docs/speaker-notes.druskininkai.lt.md'), `${lithuanianCopy}\n`)
}
console.log(`Generated ${slides.length} ${deckLabel} slides with ${isDruskininkai ? 'English/Lithuanian' : 'English'} presenter notes and rehearsal copies`)

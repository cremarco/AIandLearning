import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { projectRoot as root, readJson } from '../lib/project.mjs'
const deck = process.argv[2] || 'eduforum'
if (!['eduforum', 'druskininkai'].includes(deck)) throw new Error(`Unknown deck: ${deck}`)
const isDruskininkai = deck === 'druskininkai'
const deckLabel = isDruskininkai ? 'Druskininkai' : 'EduForum'
const notesFile = isDruskininkai ? 'data/druskininkai/speaker-notes.json' : 'data/content/speaker-notes.json'
const slides = readJson(isDruskininkai ? 'data/druskininkai/slides.json' : 'data/generated/slides.json')
const speakerNotes = readJson(notesFile)
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
  if (!notes) throw new Error(`${slide.id}: missing English speaker notes`)
  // Slidev renders this Markdown in presenter mode, outside the audience canvas.
  return `${frontmatter}<DeckSlide id="${slide.id}" />\n\n<!--\n${notes}\n-->\n`
})

writeFileSync(path.join(root, isDruskininkai ? 'druskininkai.md' : 'slides.md'), `${headmatter}\n${slideBlocks.join('\n')}`)
const readingCopy = ['# Speaker notes · Beyond prompting',
  `Concise spoken scripts in simple English for rehearsal. Bold text marks the key words; [click] markers follow the slide reveals. Edit \`${notesFile}\`, then run \`pnpm generate\` to update this copy and Slidev presenter mode.`,
  ...slides.map(slide => `## ${slide.number}. ${slide.title}\n\n${speakerNotes[slide.id]}`),
].join('\n\n')
writeFileSync(path.join(root, isDruskininkai ? 'docs/speaker-notes.druskininkai.en.md' : 'docs/speaker-notes.en.md'), `${readingCopy}\n`)
console.log(`Generated ${slides.length} ${deckLabel} slides with English presenter notes and a rehearsal copy`)

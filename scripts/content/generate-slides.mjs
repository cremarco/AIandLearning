import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { projectRoot as root, readJson } from '../lib/project.mjs'
const slides = readJson('data/generated/slides.json')
const speakerNotes = readJson('data/content/speaker-notes.json')
const yaml = value => JSON.stringify(value)

const headmatter = `---
theme: apple-basic
layout: default
title: ${yaml(slides[0].title)}
author: Marco Cremaschi
info: ${yaml(slides[0].message)}
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

writeFileSync(path.join(root, 'slides.md'), `${headmatter}\n${slideBlocks.join('\n')}`)
const readingCopy = ['# Speaker notes · Beyond prompting',
  'Short English notes for rehearsal. Bold text marks the key words. Edit `data/content/speaker-notes.json`, then run `pnpm generate` to update this copy and Slidev presenter mode.',
  ...slides.map(slide => `## ${slide.number}. ${slide.title}\n\n${speakerNotes[slide.id]}`),
].join('\n\n')
writeFileSync(path.join(root, 'docs/speaker-notes.en.md'), `${readingCopy}\n`)
console.log(`Generated ${slides.length} slides with English presenter notes and a rehearsal copy`)

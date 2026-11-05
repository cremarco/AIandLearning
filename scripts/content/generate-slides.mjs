import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { projectRoot as root, readJson } from '../lib/project.mjs'
const slides = readJson('data/generated/slides.json')
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

  // Slidev treats HTML comments as presenter notes: keep this output content-only.
  return `${frontmatter}<DeckSlide id="${slide.id}" />\n`
})

writeFileSync(path.join(root, 'slides.md'), `${headmatter}\n${slideBlocks.join('\n')}`)
console.log(`Generated ${slides.length} slides without presenter notes`)

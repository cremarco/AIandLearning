import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const slides = read('data/slides.json')
const sources = read('data/sources.json')
const destination = path.join(root, 'public/materials')
const uiDirectory = path.join(destination, 'ui')
fs.mkdirSync(uiDirectory, { recursive: true })

// Vendor CSS and the authored daisyUI theme are copied; reader.css/js are authored in ui/.
for (const [source, name] of [
  ['node_modules/daisyui/daisyui.css', 'daisyui.css'],
  ['node_modules/daisyui/LICENSE', 'daisyui.LICENSE'],
  ['styles/reading-ui.css', 'theme.css'],
]) {
  fs.copyFileSync(path.join(root, source), path.join(uiDirectory, name))
}

function write(name, value) {
  const output = Array.isArray(value)
    ? `${value.filter(item => item !== undefined).join('\n').trim()}\n`
    : value
  fs.writeFileSync(path.join(destination, name), output)
}

const h = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
const relative = url => /^https?:/.test(url) ? url : url
  .replace(/^\.?\/?materials\//, '')
  .replace(/^\.?\/?images\//, '../images/')

function references(slide) {
  return slide.sources.flatMap(id => sources[id] ? [
    `[${id}] ${sources[id].citation || sources[id].title}`,
    sources[id].url || '',
    sources[id].limitations || '',
  ] : [])
}

function textContent(slide) {
  return [
    slide.message,
    ...slide.body,
    ...(slide.commands || []).map(row => `${row.command}: ${row.description}`),
    ...(slide.cards || []).flatMap(card => [card.title, card.body]),
    ...(slide.steps || []).flatMap((step, index) => [`${index + 1}. ${step.title}`, step.text]),
    ...(slide.comparison || []).flatMap(item => [item.label, item.text]),
    slide.formula ? 'p_i = exp(z_i/T) / sum_j exp(z_j/T), T > 0. Read: exponentiate each score divided by temperature, then divide by the sum over all candidates.' : '',
    slide.prompt ? `${slide.promptLabel || 'Prompt / excerpt'}: ${slide.prompt}` : '',
    slide.result ? `Result: ${slide.result}` : '',
    slide.decision || '',
    ...(slide.references || []).flatMap(item => [item.label, item.citation, item.url]),
    ...(slide.links || []).map(link => `${link.label}: ${link.url}`),
    ...(slide.media ? [slide.media.alt, slide.media.caption, slide.media.transcript || ''] : []),
  ].filter(Boolean)
}

const introduction = [
  'BEYOND PROMPTING — STUDY, UNDERSTAND, ASSESS',
  'Marco Cremaschi · November 2026',
  `${slides.length} slides in one complete sequence. Participants observe the method; Andrea is a fictional student in a teaching scenario.`,
  'Public materials in English.',
  '',
]
write('Accessible_Deck_EN.txt', [
  ...introduction,
  ...slides.flatMap(slide => [
    `SLIDE ${slide.id} — ${slide.title}`,
    `Page ${slide.number} / ${slides.length}`,
    ...textContent(slide),
    ...references(slide),
    '',
  ]),
])
write('Prompt_Bank_EN.txt', [
  ...introduction,
  ...slides.filter(slide => slide.prompt && slide.id !== 'S55')
    .flatMap(slide => [`${slide.id} · ${slide.title}`, slide.prompt, '']),
])
const csvCell = value => `"${String(value || '').replaceAll('"', '""')}"`
write('source_index.csv', [
  'id,title,url,limitations,verified',
  ...Object.entries(sources)
    .filter(([id]) => id !== 'BIO02')
    .map(([id, source]) => [
      id, source.title, source.url, source.limitations, source.publication_status || '2026-11-01',
    ].map(csvCell).join(',')),
])

// Remove retired outputs as well, so regeneration cannot leave stale script downloads.
const retiredFiles = new Set(['facilitator-guide-it.txt', 'Accessible_Deck_IT.txt', 'Prompt_Bank_IT.txt'])
for (const name of fs.readdirSync(destination)) {
  if (name.startsWith('Presenter_Notes') || retiredFiles.has(name)) {
    fs.rmSync(path.join(destination, name))
  }
}

const controls = [
  '<div class="controls" role="group" aria-label="Reading preferences">',
  '<button class="btn" id="smaller" aria-label="Reduce text size">Text −</button>',
  '<button class="btn" id="larger" aria-label="Increase text size">Text +</button>',
  '<button class="btn" id="spacing" aria-pressed="false">Spacing</button>',
  '<button class="btn" id="theme" aria-pressed="false">Dark theme</button>',
  '</div>',
].join('')

function head(title, language = 'en') {
  return [
    `<!doctype html><html lang="${language}"><head>`,
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${h(title)}</title>`,
    '<link rel="stylesheet" href="ui/daisyui.css">',
    '<link rel="stylesheet" href="ui/theme.css">',
    '<link rel="stylesheet" href="ui/reader.css">',
    '<script src="ui/reader.js" defer></script>',
    '</head><body><a class="btn skip" href="#content">Skip to content</a>',
  ].join('')
}

function writePage(name, title, sections) {
  write(name, `${head(title)}${sections.join('')}</body></html>`)
}

const links = slide => (slide.links || []).map(link =>
  `<p><a class="link link-primary" href="${h(relative(link.url))}">${h(link.label)}</a></p>`,
).join('')

const formulaMarkup='<math display="block" aria-label="p sub i equals exponential of z sub i over T, divided by the sum over all j of exponential of z sub j over T; T positive"><msub><mi>p</mi><mi>i</mi></msub><mo>=</mo><mfrac><mrow><mi>exp</mi><mo>(</mo><msub><mi>z</mi><mi>i</mi></msub><mo>/</mo><mi>T</mi><mo>)</mo></mrow><mrow><munder><mo>∑</mo><mi>j</mi></munder><mi>exp</mi><mo>(</mo><msub><mi>z</mi><mi>j</mi></msub><mo>/</mo><mi>T</mi><mo>)</mo></mrow></mfrac><mo>,</mo><mi>T</mi><mo>&gt;</mo><mn>0</mn></math><p>Exponentiate each score divided by temperature, then divide by the sum over all candidates.</p>'

function commandTable(slide) {
  if (!slide.commands?.length) return ''
  return [
    '<div class="command-catalogue overflow-x-auto" lang="en"><table class="table">',
    '<thead><tr><th scope="col">Command</th><th scope="col">What you can ask for</th></tr></thead><tbody>',
    ...slide.commands.map(row => `<tr><th scope="row"><code>${h(row.command)}</code></th><td>${h(row.description)}</td></tr>`),
    '</tbody></table></div>',
  ].join('')
}

function mediaMarkup(media) {
  if (!media) return ''
  const content = media.type === 'video' ? [
    `<video controls preload="none" poster="${h(relative(media.poster))}">`,
    `<source src="${h(relative(media.src))}" type="${media.src.endsWith('webm') ? 'video/webm' : 'video/mp4'}">`,
    `<track kind="captions" srclang="en" label="English" src="${h(relative(media.captions))}" default>`,
    '</video>',
  ].join('') : `<img src="${h(relative(media.src))}" alt="${h(media.alt)}">`
  return `<figure>${content}<figcaption>${h(media.caption)}</figcaption></figure>`
}

function transcriptMarkup(media) {
  if (!media?.transcript) return ''
  return [
    '<details class="collapse collapse-arrow"><summary class="collapse-title">Video transcript</summary>',
    `<div class="collapse-content"><p>${h(media.transcript)}</p></div></details>`,
  ].join('')
}

function inner(slide) {
  return [
    `<p>${h(slide.message)}</p>`,
    commandTable(slide),
    slide.formula ? formulaMarkup : '',
    mediaMarkup(slide.media),
    slide.prompt ? `<blockquote><strong>${h(slide.promptLabel || 'Prompt / excerpt')}</strong><p>${h(slide.prompt)}</p></blockquote>` : '',
    ...(slide.body || []).map(text => `<p>${h(text)}</p>`),
    slide.steps?.length ? `<ol>${slide.steps.map(step => `<li><strong>${h(step.title)}</strong><p>${h(step.text)}</p></li>`).join('')}</ol>` : '',
    ...(slide.cards || []).map(card => `<h3>${h(card.title)}</h3><p>${h(card.body)}</p>`),
    ...(slide.comparison || []).map(item => `<h3>${h(item.label)}</h3><p>${h(item.text)}</p>`),
    slide.result ? `<h3>Result</h3><p>${h(slide.result)}</p>` : '',
    slide.decision ? `<p class="decision">${h(slide.decision)}</p>` : '',
    ...(slide.references || []).map(item => `<p><strong>${h(item.label)}</strong> ${h(item.citation)} <a class="link link-primary" href="${h(item.url)}">Source</a></p>`),
    links(slide),
    transcriptMarkup(slide.media),
  ].join('')
}

function sourceList(slide) {
  const rows = slide.sources.filter(id => sources[id]?.url).map(id => {
    const source = sources[id]
    const limitation = source.limitations ? ` — ${h(source.limitations)}` : ''
    return `<p><a class="link link-primary" href="${h(source.url)}">${h(source.citation || source.title)}</a>${limitation}</p>`
  })
  return `<div class="refs">${rows.join('')}</div>`
}

writePage('lettura.html', 'Beyond prompting · reading guide', [
  '<header><h1>Beyond prompting</h1>',
  '<p>Study, understand and assess with tools. Follow Andrea’s learning path, the teacher’s assessment and choices of access support.</p>',
  `<p class="meta">Marco Cremaschi · November 2026 · ${slides.length} slides</p>`,
  controls,
  '<p><a class="link link-primary" href="kit.html">Materials</a></p>',
  '<nav aria-label="Slide index"><ul>',
  ...slides.map(slide => `<li><a class="link link-primary" href="#${slide.id}">${slide.number}. ${h(slide.title)}</a></li>`),
  '</ul></nav></header><main id="content">',
  ...slides.map(slide => [
    `<section class="slide" id="${slide.id}" lang="${slide.lang || 'en'}">`,
    `<h2>${h(slide.title)}</h2>`,
    `<p class="meta">Slide ${slide.number} · ${h(slide.stage || slide.section)}</p>`,
    inner(slide),
    sourceList(slide),
    '</section>',
  ].join('')),
  '</main><footer><a class="link link-primary" href="#">Back to top</a></footer>',
])

writePage('kit.html', 'Workshop materials', [
  '<header><h1>Workshop materials</h1>',
  '<p>Andrea is a fictional teaching case. The textbook is fictional; its technical references and the cited research are real.</p>',
  controls,
  '</header><main id="content"><h2>Study and understand</h2><ul>',
  '<li><a class="link link-primary" href="lettura.html">All slides in reading format</a></li>',
  '<li><a class="link link-primary" href="booklet-genai/Fondamenti_GenAI_Cremaschi.pdf">Textbook chapter PDF</a> · <a class="link link-primary" href="booklet-genai/lettura.html">Chapter reading HTML</a></li>',
  '<li><a class="link link-primary" href="demo-genai/index.html">Real-model application</a></li>',
  '<li><a class="link link-primary" href="Prompt_Bank_EN.txt">Prompts and requests</a></li>',
  '<li><a class="link link-primary" href="map-initial.excalidraw">Initial map</a> · <a class="link link-primary" href="map-revised.excalidraw">Revised map</a> (open in Excalidraw)</li>',
  '<li><a class="link link-primary" href="activities.html">Participant activity sheets</a></li>',
  '<li><a class="link link-primary" href="formula-desmos.txt">Desmos expressions and numerical example</a></li>',
  '<li><a class="link link-primary" href="verifica.html">Assessment, expected answers and rubric</a></li>',
  '</ul><h2>References</h2><ul><li><a class="link link-primary" href="source_index.csv">Source index</a></li></ul>',
  '<h2>Access support</h2>',
  '<p>Open the HTML chapter in Edge for Read Aloud. Adjust text size and spacing to suit the reader. System dictation offers an alternative to typing; review its transcript. Choose and check supports with the person using them.</p>',
  '<p>The main path uses free features. Account requirements and usage limits may change. The final slide catalogues distinguish premium alternatives and trials.</p>',
  '</main>',
])

const assessment = slides.filter(slide => {
  const number = parseInt(slide.id.slice(1))
  return number >= 82 && number <= 89
})
writePage('verifica.html', 'Knowledge assessment · Andrea case', [
  '<header><h1>Knowledge assessment</h1>',
  '<p>Tasks, criteria and example responses for Andrea’s case. Class responses are simulated for a discussion of feedback.</p>',
  controls,
  '</header><main id="content">',
  ...assessment.map(slide => `<section class="slide"><h2>${h(slide.title)}</h2>${inner(slide)}</section>`),
  '</main>',
])

writePage('activities.html', 'Participant activity sheets', [
  '<header><h1>Participant activities</h1>',
  '<p>Work on learning support and assessment choices; no computer science knowledge is required.</p>',
  controls,
  '</header><main id="content">',
  ...slides.filter(slide => slide.kind === 'activity')
    .map(slide => `<section class="slide"><h2>${h(slide.title)}</h2>${inner(slide)}</section>`),
  '</main>',
])

console.log(`Generated public materials for ${slides.length} slides`)

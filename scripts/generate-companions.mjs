import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const slides = read('data/slides.json')
const sources = read('data/sources.json')
const skillResearch = read('data/skills-research.json')
const catalogue = slide => (slide.skillIds || []).map(id => skillResearch.skills.find(skill => skill.id === id))
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
    ...(slide.commands || []).flatMap(row => [
      `${row.command}: ${row.description}`,
      ...(row.result ? [row.result.label, row.result.instruction, row.result.text || '', row.result.media.alt, row.result.media.caption] : []),
    ]),
    ...(slide.cards || []).flatMap(card => [card.title, card.body]),
    ...catalogue(slide).flatMap(skill => [skill.name, `${skill.publisher} · ${skill.origin}`, skill.platform, skill.summary,
      `Example request · not executed: ${skill.prompt}`, `Expected deliverable: ${skill.expected}`, skill.caveat,
      `Requirements: ${skill.requirements}`, `Terminal installation for coding agents: ${skill.installCommand}`, skill.sourceUrl]),
    ...(slide.steps || []).flatMap((step, index) => [`${index + 1}. ${step.title}`, step.text]),
    ...(slide.comparison || []).flatMap(item => [item.label, item.text]),
    slide.formula ? 'p_i = exp(z_i/T) / sum_j exp(z_j/T), T > 0. Read: exponentiate each score divided by temperature, then divide by the sum over all candidates.' : '',
    slide.prompt ? `${slide.promptLabel || 'Prompt / excerpt'}: ${slide.prompt}` : '',
    slide.result ? `${slide.resultLabel || 'Result'}: ${slide.result}` : '',
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
  'SKILL EXAMPLE REQUESTS — NOT EXECUTED',
  ...skillResearch.skills.flatMap(skill => [`${skill.name} · ${skill.publisher} · ${skill.platform}`, skill.prompt, `Expected deliverable: ${skill.expected}`, '']),
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
  const formal = slide.commandCategory?.startsWith('formal-')
  const column = slide.commandCategory === 'formal-web' ? 'Menu action' : formal ? 'Official command' : 'Informal shortcut'
  const label = row => slide.commandCategory === 'formal-web' ? h(row.command) : `<code>${h(row.command)}</code>`
  return [
    '<div class="command-catalogue overflow-x-auto" lang="en"><table class="table">',
    `<thead><tr><th scope="col">${column}</th><th scope="col">${formal ? 'What it does' : 'What you can ask for'}</th></tr></thead><tbody>`,
    ...slide.commands.map(row => `<tr><th scope="row">${label(row)}</th><td>${h(row.description)}</td></tr>`),
    '</tbody></table></div>',
    ...slide.commands.filter(row => row.result).map(row => {
      const result = row.result
      return `<article class="command-result"><h3>${h(row.command)} · ${h(result.label)}</h3>${row.command === 'Study' ? promptMarkup(result.instruction, 'Prompt after selecting Study') : `<p>${h(result.instruction)}</p>`}${result.text ? `<p class="command-response">${h(result.text)}</p>` : ''}${mediaMarkup(result.media)}${result.inputCapture ? `<p><a class="link link-primary" href="${h(relative(result.inputCapture))}">Study selection and prompt</a></p>` : ''}</article>`
    }),
  ].join('')
}

function promptMarkup(text, label = 'Prompt to copy', prefix = '>') {
  return `<div class="prompt-block"><p class="meta">${h(label)}</p><div class="mockup-code prompt-terminal"><pre data-prefix="${h(prefix)}"><code>${h(text)}</code></pre></div></div>`
}

function skillMarkup(skill, installation = false) {
  return [
    `<article class="skill-entry" id="${h(skill.id)}"><h3>${h(skill.name)}</h3>`,
    `<p class="meta">${h(skill.publisher)} · ${h(skill.origin)} · ${h(skill.platform)}</p>`,
    `<p>${h(skill.summary)}</p>`,
    promptMarkup(skill.prompt, 'Example request · not executed'),
    `<p><strong>Expected deliverable:</strong> ${h(skill.expected)}</p>`,
    `<p>${h(skill.caveat)}</p>`,
    `<p><strong>Requirements:</strong> ${h(skill.requirements)} <strong>License:</strong> ${h(skill.license)}.</p>`,
    installation ? promptMarkup(skill.installCommand, 'Terminal installation · coding agents, not a ChatGPT message', '$') : '',
    `<p><a class="link link-primary" href="${h(skill.sourceUrl)}">Publisher’s skill and current instructions</a></p>`,
    installation ? `<p class="meta">Discovery snapshot · ${h(skill.verified)}: ${h(skill.popularity.installs)} directory installs; ${h(skill.popularity.repositoryStars)} repository stars. Counts are approximate, change over time and do not measure effectiveness. ${skill.popularity.installs !== 'Not recorded' ? `<a class="link link-primary" href="${h(skill.popularity.url)}">Directory entry</a>` : ''}</p>` : '',
    '</article>',
  ].join('')
}

function mediaMarkup(media) {
  if (!media) return ''
  const content = media.type === 'video' ? [
    `<video controls preload="none" poster="${h(relative(media.poster))}">`,
    `<source src="${h(relative(media.src))}" type="${media.src.endsWith('webm') ? 'video/webm' : 'video/mp4'}">`,
    `<track kind="captions" srclang="en" label="English" src="${h(relative(media.captions))}"${media.captionsDefault === false ? '' : ' default'}>`,
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
    ...catalogue(slide).map(skill => skillMarkup(skill)),
    slide.formula ? formulaMarkup : '',
    mediaMarkup(slide.media),
    slide.prompt ? promptMarkup(slide.prompt, slide.promptLabel || 'Prompt / excerpt') : '',
    ...(slide.body || []).map(text => `<p>${h(text)}</p>`),
    slide.steps?.length ? `<ol>${slide.steps.map(step => `<li><strong>${h(step.title)}</strong><p>${h(step.text)}</p></li>`).join('')}</ol>` : '',
    ...(slide.cards || []).map(card => `<h3>${h(card.title)}</h3><p>${h(card.body)}</p>`),
    ...(slide.comparison || []).map(item => `<h3>${h(item.label)}</h3><p>${h(item.text)}</p>`),
    slide.result ? `<h3>${h(slide.resultLabel || 'Result')}</h3><p>${h(slide.result)}</p>` : '',
    slide.decision ? `<p class="decision">${h(slide.decision)}</p>` : '',
    ...(slide.references || []).map(item => `<p><strong>${h(item.label)}</strong> ${h(item.citation)} <a class="link link-primary" href="${h(relative(item.url))}">Source</a></p>`),
    links(slide),
    transcriptMarkup(slide.media),
  ].join('')
}

function sourceList(slide) {
  const rows = slide.sources.filter(id => sources[id]?.url).map(id => {
    const source = sources[id]
    const limitation = source.limitations ? ` — ${h(source.limitations)}` : ''
    return `<p><a class="link link-primary" href="${h(relative(source.url))}">${h(source.citation || source.title)}</a>${limitation}</p>`
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
  '<li><a class="link link-primary" href="skills-guide.html">Agent Skills: annotated catalogue and installation guide</a></li>',
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

writePage('skills-guide.html', 'Agent Skills · research and teaching catalogue', [
  '<header><h1>Agent Skills for study, research and teaching</h1>',
  `<p class="meta">12 skills · sources checked ${h(skillResearch.verified)}</p>`,
  `<p>${h(skillResearch.scope)}</p>`, controls,
  '<p><a class="link link-primary" href="kit.html">Workshop materials</a> · <a class="link link-primary" href="lettura.html#S53SKILLS">Skills slides in reading format</a></p>',
  '<nav aria-label="Skill index"><ul>',
  ...skillResearch.skills.map(skill => `<li><a class="link link-primary" href="#${h(skill.id)}">${h(skill.name)} · ${h(skill.publisher)}</a></li>`),
  '</ul></nav></header><main id="content">',
  '<section class="slide"><h2>What is a skill?</h2><p>An Agent Skill is a folder with a SKILL.md file containing metadata and workflow instructions, plus optional references, scripts and assets. A product command invokes a feature; an informal shortcut labels a request. Skills require a host that can discover them and supply the necessary tools.</p>',
  '<p><a class="link link-primary" href="https://agentskills.io/specification">Agent Skills specification</a> · <a class="link link-primary" href="https://developers.openai.com/plugins/concepts/skills">OpenAI skill and plugin concepts</a></p></section>',
  '<section class="slide"><h2>Installation depends on the host</h2><p>Eligible ChatGPT Business, Enterprise, Healthcare and Edu users can open Plugins → Skills, install shared skills or use Create to build or upload a package. Availability and workspace settings apply. The terminal commands below are for compatible coding agents; they are not ChatGPT slash commands.</p>',
  '<p>For coding agents, review the publisher’s files, dependencies and license before installing. The Skills CLI asks which skills and agents to install for; installation is project-scoped by default. Installing the instructions does not install their Python, Node or external service dependencies. A portable format does not guarantee identical behaviour across hosts.</p>',
  '<p>The old openai/skills repository is deprecated; use current OpenAI plugin documentation and openai/plugins examples.</p>',
  '<p><a class="link link-primary" href="https://help.openai.com/en/articles/20001066-skills-in-chatgpt">Skills in ChatGPT</a> · <a class="link link-primary" href="https://github.com/vercel-labs/skills">Skills CLI documentation</a> · <a class="link link-primary" href="https://github.com/openai/skills">Retired OpenAI catalogue notice</a> · <a class="link link-primary" href="https://github.com/openai/plugins">Current OpenAI examples</a></p></section>',
  ...skillResearch.skills.map(skill => `<section class="slide">${skillMarkup(skill, true)}</section>`),
  '<section class="slide" id="evidence"><h2>Evidence of effectiveness</h2>',
  '<p>SkillsBench v4 evaluates 87 tasks across 8 domains under matched conditions for 18 model–harness configurations. Average pass rate rises from 33.9% to 50.5%, an increase of 16.6 percentage points. Focused bundles performed better than larger, exhaustive ones. <a class="link link-primary" href="https://arxiv.org/abs/2602.12670v4">Li et al. · SkillsBench v4</a>.</p>',
  '<p>SWE-Skills-Bench v2 evaluates 98 software-engineering skills across four agent–model configurations. It finds no statistically significant effect for 92 skills; the average pass ratio changes from 76.6% to 76.9% (+0.3 percentage points). <a class="link link-primary" href="https://arxiv.org/abs/2603.15401v2">Han et al. · SWE-Skills-Bench v2</a>.</p>',
  `<p>${h(skillResearch.limitations)} Both are preprints. Older search snippets report earlier versions with different task counts and results; the figures above are pinned to the linked versions.</p>`,
  '<p>A separate analysis of 307 selected failure cases describes how excessive procedure and templates can cause errors or wasted effort. This is a failure taxonomy, not a population-wide failure rate. <a class="link link-primary" href="https://arxiv.org/abs/2608.11888v1">Dong et al. · Agent Skills Can Be Harmful</a>.</p></section>',
  '<section class="slide"><h2>How to choose</h2><p>The following is a practical inference from the sources, not a measured ranking of these packages: prefer a narrow recurring task with a clear input, output and check. For one representative task, compare factual errors, missing requirements, file usability and effort with and without the skill. For teaching, also assess what the learner can explain without assistance.</p>',
  '<h3>Research method</h3><ol>', ...skillResearch.method.map(text => `<li>${h(text)}</li>`),
  '</ol><h3>Sources</h3>',
  ...Object.entries(sources).filter(([id]) => id.startsWith('SKILL_')).map(([, source]) => `<p><a class="link link-primary" href="${h(source.url)}">${h(source.citation)}</a> ${h(source.limitations)}</p>`),
  '</section></main><footer><a class="link link-primary" href="#">Back to top</a></footer>',
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

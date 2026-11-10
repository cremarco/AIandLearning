import fs from 'node:fs'
import path from 'node:path'

import { projectRoot as root, readJson as read } from '../lib/project.mjs'
const slides = read('data/generated/slides.json')
const notebookOutputs = read('data/content/notebook-outputs.json')
const notebookUrl = slides.find(slide => slide.tool === 'notebook' && slide.media?.source)?.media.source
const sources = read('data/generated/sources.json')
const shortcutVideos = new Map(read('data/demos/chatgpt-videos.json').clips.map(clip => [clip.command.toLowerCase(), clip]))
const skillResearch = read('data/catalogues/skills-research.json')
const skillDemos = new Map(read('data/demos/skill-demos.json').map(demo => [demo.key, demo]))
const presentationSlideCount = slides.findIndex(slide => slide.kind === 'thanks') + 1 || slides.length
const teacherRecordings = read('public/materials/teacher-tools/provenance.json', { clips: [] })
const catalogue = slide => (slide.skillIds || []).map(id => skillResearch.skills.find(skill => skill.id === id))
const studyFocus = focus => focus ? `Study phase: ${focus.primary.toUpperCase()}${focus.secondary?.length ? ` · Secondary: ${focus.secondary[0].toUpperCase()}` : ''}` : ''
const destination = path.join(root, 'public/materials')
const uiDirectory = path.join(destination, 'ui')
fs.mkdirSync(uiDirectory, { recursive: true })

// Vendor CSS and the authored daisyUI theme are copied; reader.css/js are authored in ui/.
for (const [source, name] of [
  ['node_modules/daisyui/daisyui.css', 'daisyui.css'],
  ['node_modules/daisyui/LICENSE', 'daisyui.LICENSE'],
  ['styles/reading-ui.css', 'theme.css'],
  ['styles/browser-video.css', 'browser-video.css'],
]) {
  fs.copyFileSync(path.join(root, source), path.join(uiDirectory, name))
}

fs.copyFileSync(path.join(root, 'data/references/bibliography.bib'), path.join(destination, 'references.bib'))

function write(name, value) {
  const output = Array.isArray(value)
    ? `${value.filter(item => item !== undefined).join('\n').trim()}\n`
    : value
  fs.writeFileSync(path.join(destination, name), output.replace(/[ \t]+$/gm, ''))
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
    studyFocus(slide.studyPhases),
    slide.activityTimer ? `${slide.activityTimer.minutes}-minute practice` : '',
    ...slide.body,
    ...(slide.shortcutLabels || []).map(item => item.command),
    ...(slide.commands || []).flatMap(row => [
      `${row.command}: ${row.description}`,
      ...(row.result ? [row.result.label, row.result.instruction, row.result.text || '', row.result.media.alt, row.result.media.caption, row.result.media.transcript || '', ...resultText(row.result.media.result)] : []),
    ]),
    ...(slide.cards || []).flatMap(card => [card.title, card.body]),
    ...(slide.screenshots || []).flatMap(item => [item.label, item.format, item.alt, item.caption, `Original prompt: ${item.prompt}`, `Screenshot: ${item.src}`]),
    ...(slide.toolTable?.rows || []).map(row => `${row.tool} — ${row.purpose} — ${row.access} ${row.url}`),
    ...catalogue(slide).flatMap(skill => [skill.name, `${skill.publisher} · ${skill.origin}`, skill.platform, skill.summary, skill.capabilities, studyFocus(skill.studyPhases),
      `${skill.executionStatus === 'executed' ? 'Tested request' : 'Example request · not executed'}: ${skill.prompt}`, `${skill.executionStatus === 'executed' ? 'Observed result' : 'Expected deliverable'}: ${skill.expected}`, skill.caveat,
      `Requirements: ${skill.requirements}`, `Terminal installation for coding agents: ${skill.installCommand}`, skill.sourceUrl]),
    ...(slide.steps || []).flatMap((step, index) => [`${index + 1}. ${step.title}`, step.text]),
    ...(slide.comparison || []).flatMap(item => [item.label, item.text]),
    slide.prompt ? `${slide.promptLabel || 'Prompt / excerpt'}: ${slide.prompt}` : '',
    slide.result ? `${slide.resultLabel || 'Result'}: ${slide.result}` : '',
    slide.decision || '',
    ...(slide.references || []).flatMap(item => [item.label, item.citation, item.url]),
    ...(slide.links || []).map(link => `${link.label}: ${link.url}`),
    slide.tool === 'notebook' && slide.media?.source ? `Open notebook: ${slide.media.source}` : '',
    ...(slide.notebookOutput ? outputText(notebookOutputs[slide.notebookOutput]) : slide.media ? [slide.media.alt, slide.media.caption, slide.media.transcript || '', ...resultText(slide.media.result)] : []),
  ].filter(Boolean)
}

const introduction = [
  'BEYOND PROMPTING — STUDY, UNDERSTAND, ASSESS',
  'Marco Cremaschi · November 2026',
  `${presentationSlideCount} presentation slides, followed by ${slides.length - presentationSlideCount} reference appendices. Participants observe the method; Andrea is a fictional student in a teaching scenario.`,
  'Public materials in English.',
  notebookUrl ? `NotebookLM workshop notebook: ${notebookUrl}` : '',
  '',
]
write('Accessible_Deck_EN.txt', [
  ...introduction,
  ...slides.flatMap(slide => [
    `SLIDE ${slide.id} — ${slide.title}`,
    slide.number <= presentationSlideCount ? `Page ${slide.number} / ${presentationSlideCount}` : 'Reference appendix',
    ...textContent(slide),
    ...references(slide),
    '',
  ]),
])
write('Prompt_Bank_EN.txt', [
  ...introduction,
  ...slides.filter(slide => slide.prompt)
    .flatMap(slide => [`${slide.id} · ${slide.title}`, slide.prompt, '']),
  'AGENT SKILL REQUESTS — EXECUTION STATUS SHOWN PER ENTRY',
  ...skillResearch.skills.flatMap(skill => [`${skill.name} · ${skill.publisher} · ${skill.platform}`, skill.executionStatus === 'executed' ? 'Tested in ChatGPT web, Work mode, using the original workshop book.' : 'Proposed example · not executed.', skill.prompt, `${skill.executionStatus === 'executed' ? 'Observed result' : 'Expected deliverable'}: ${skill.expected}`, '']),
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

// Remove retired outputs as well, so regeneration cannot leave stale materials.
const retiredFiles = new Set(['lettura.html', 'facilitator-guide-it.txt', 'Accessible_Deck_IT.txt', 'Prompt_Bank_IT.txt', 'map-initial.excalidraw', 'map-revised.excalidraw'])
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
    '<link rel="stylesheet" href="ui/browser-video.css">',
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


function commandTable(slide) {
  if (!slide.commands?.length) return ''
  const formal = slide.commandCategory?.startsWith('formal-')
  const column = slide.commandCategory === 'formal-web' ? 'Menu action' : formal ? 'Official command' : 'Tested prompt label'
  const label = row => slide.commandCategory === 'formal-web' ? h(row.command) : `<code>${h(row.command)}</code>`
  return [
    '<div class="command-catalogue overflow-x-auto" lang="en"><table class="table">',
    `<thead><tr><th scope="col">${column}</th><th scope="col">${formal ? 'What it does' : 'Observed interactive output'}</th></tr></thead><tbody>`,
    ...slide.commands.map(row => {
      const clip = shortcutVideos.get(row.command.toLowerCase())
      const videoLink = clip ? ` <a class="link link-primary" href="${h(relative(clip.src))}">Watch video</a>` : ''
      return `<tr><th scope="row">${label(row)}${videoLink}</th><td>${h(row.description)}</td></tr>`
    }),
    '</tbody></table></div>',
    ...slide.commands.filter(row => row.result).map(row => {
      const result = row.result
      return `<article class="command-result"><h3>${h(row.command)} · ${h(result.label)}</h3>${row.command === 'Study' ? promptMarkup(result.instruction, 'Prompt after selecting Study') : `<p>${h(result.instruction)}</p>`}${result.text ? `<p class="command-response">${h(result.text)}</p>` : ''}${mediaMarkup(result.media)}${transcriptMarkup(result.media)}</article>`
    }),
  ].join('')
}

function promptMarkup(text, label = 'Prompt to copy', prefix = '>', style = 'chat') {
  if (style === 'chat') {
    const content = h(text).replace(/^(\/[a-z][a-z0-9_-]*)(?=\s)/i, '<span class="prompt-command">$1</span>')
    return `<div class="prompt-block"><p class="meta">${h(label)}</p><div class="chat chat-end prompt-chat"><div class="chat-bubble">${content}</div></div></div>`
  }
  return `<div class="prompt-block"><p class="meta">${h(label)}</p><div class="mockup-code prompt-terminal"><pre data-prefix="${h(prefix)}"><code>${h(text)}</code></pre></div></div>`
}

function skillMarkup(skill, installation = false) {
  const demo = skillDemos.get(skill.id)
  const media = slides.find(slide => slide.id === demo?.slideId)?.media
  const request = demo?.recordedPrompt || media?.prompt || skill.prompt
  return [
    `<article class="skill-entry" id="${h(skill.id)}"><h3>${h(skill.name)}</h3>`,
    `<p class="meta">${h(skill.publisher)} · ${h(skill.origin)} · ${h(skill.platform)}</p>`,
    `<p>${h(skill.summary)}</p>`,
    skill.capabilities ? `<p>${h(skill.capabilities)}</p>` : '',
    skill.studyPhases ? `<p class="meta">${h(studyFocus(skill.studyPhases))}</p>` : '',
    promptMarkup(request, skill.executionStatus === 'executed' ? 'Tested request · original workshop book' : 'Example request · not executed'),
    `<p><strong>${skill.executionStatus === 'executed' ? 'Observed result' : 'Expected deliverable'}:</strong> ${h(skill.expected)}</p>`,
    `<p>${h(skill.caveat)}</p>`,
    skill.executionStatus === 'executed' && media ? `<p>Recorded in ChatGPT web, Work mode, using the original workshop book.</p>${mediaMarkup(media)}${transcriptMarkup(media)}` : '',
    skill.webInstall ? `<p><strong>Web installation used:</strong> ${h(skill.webInstall)}</p>` : '',
    skill.sourceCommit ? `<p><strong>Tested package revision:</strong> <a class="link link-primary" href="https://github.com/${h(skill.repo)}/commit/${h(skill.sourceCommit)}">${h(skill.sourceCommit.slice(0, 12))}</a>. Full test records: <a class="link link-primary" href="skills/provenance.json">recording provenance</a>.</p>` : '',
    ...(!media?.result ? (skill.artifacts || []) : []).map(file => `<p><a class="link link-primary" href="${h(relative(file.url))}">${h(file.label)}</a></p>`),
    `<p><strong>Requirements:</strong> ${h(skill.requirements)} <strong>License:</strong> ${h(skill.license)}.</p>`,
    installation ? promptMarkup(skill.installCommand, 'Terminal installation · coding agents, not a ChatGPT message', '$', 'terminal') : '',
    `<p><a class="link link-primary" href="${h(skill.sourceUrl)}">Publisher’s skill and current instructions</a></p>`,
    installation ? `<p class="meta">Discovery snapshot · ${h(skill.verified)}: ${h(skill.popularity.installs)} directory installs; ${h(skill.popularity.repositoryStars)} repository stars. Counts are approximate, change over time and do not measure effectiveness. ${skill.popularity.installs !== 'Not recorded' ? `<a class="link link-primary" href="${h(skill.popularity.url)}">Directory entry</a>` : ''}</p>` : '',
    '</article>',
  ].join('')
}

function resultText(result) {
  if (!result) return []
  return [result, ...(result.supplemental || [])].map(link => `${link.label}: ${link.url}`).concat(result.qualification || [])
}

function resultMarkup(result) {
  if (!result) return ''
  const anchors = [result, ...(result.supplemental || [])].map(link =>
    `<a class="link link-primary" href="${h(relative(link.url))}"${link.download ? ' download' : ' target="_blank" rel="noopener"'}>${h(link.label)}</a>`,
  ).join(' ')
  return `<div class="recording-result-links" aria-label="Recorded result">${anchors}${result.qualification ? `<p class="meta">${h(result.qualification)}</p>` : ''}</div>`
}

function outputText(output) {
  return [
    `Created with NotebookLM: ${output.feature}`, `Original output: ${output.src}`,
    ...(output.cards || []).flatMap(card => [card.question, card.answer]),
    ...(output.questions || []).flatMap(q => [q.question, ...q.options, `Hint: ${q.hint}`, `Correct answer: ${String.fromCharCode(65 + q.correctIndex)}`, ...q.explanations]),
    ...(output.rows || []).map(row => row.map((cell, i) => `${output.headers[i]}: ${cell}`).join(' · ')),
  ]
}

function outputMarkup(output) {
  const url = h(relative(output.src))
  let content = ''
  if (output.type === 'audio') content = `<audio controls preload="none" src="${url}"></audio>`
  if (output.type === 'video') content = `<video controls preload="none" poster="${h(relative(output.poster))}" src="${url}"><track kind="captions" srclang="en" label="English" src="${h(relative(output.captions))}"></video>`
  if (output.type === 'pdf') content = output.pages.map((page, i) => `<figure><img loading="lazy" src="${h(relative(page))}" alt="${h(output.feature)} page ${i + 1}"><figcaption>Page ${i + 1} of ${output.pages.length}</figcaption></figure>`).join('')
  if (output.type === 'image') content = `<a class="link" href="${url}"><img loading="lazy" src="${url}" alt="${h(output.feature)} generated from the chapter"></a>`
  if (output.type === 'flashcards') content = output.cards.map(card => `<details><summary>${h(card.question)}</summary><p>${h(card.answer)}</p></details>`).join('')
  if (output.type === 'quiz') content = output.questions.map(q => `<section><h3>${h(q.question)}</h3><ol type="A">${q.options.map(option => `<li>${h(option)}</li>`).join('')}</ol><details><summary>Show answer</summary><p>Correct answer: ${String.fromCharCode(65 + q.correctIndex)}</p><p>${h(q.explanations[q.correctIndex])}</p></details></section>`).join('')
  if (output.type === 'table') content = `<div class="overflow-x-auto"><table class="table"><thead><tr>${output.headers.map(header => `<th scope="col">${h(header)}</th>`).join('')}</tr></thead><tbody>${output.rows.map(row => `<tr>${row.map(cell => `<td>${h(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  return `<section class="notebook-output"><h3>${h(output.feature)}</h3><p>Created in NotebookLM${['quiz', 'flashcards', 'table'].includes(output.type) ? ' · local viewer with original content' : ''}</p>${content}<p><a class="link" href="${url}">Open original output</a></p></section>`
}

function mediaMarkup(media) {
  if (!media) return ''
  const content = media.type === 'video' ? [
    `<video controls preload="none"${media.browserFrame ? ' width="1440" height="900"' : ''} aria-label="${h(media.alt)}" poster="${h(relative(media.poster))}">`,
    `<source src="${h(relative(media.src))}" type="${media.src.endsWith('webm') ? 'video/webm' : 'video/mp4'}">`,
    `<track kind="captions" srclang="en" label="English" src="${h(relative(media.captions))}"${media.captionsDefault === false ? '' : ' default'}>`,
    '</video>',
  ].join('') : media.src.endsWith('.gif') && media.poster
    ? `<picture><source media="print, (prefers-reduced-motion: reduce)" srcset="${h(relative(media.poster))}"><img src="${h(relative(media.src))}" alt="${h(media.alt)}"></picture>`
    : `<img src="${h(relative(media.src))}" alt="${h(media.alt)}">`
  const framed = media.browserFrame
    ? `<div class="mockup-browser browser-video${media.darkFrame ? ' browser-video-dark' : ''}"><div class="mockup-browser-toolbar"><div class="input browser-video-address">${h(media.source?.replace(/^https?:\/\//, ''))}</div></div><div class="browser-video-page">${content}<img class="video-print-poster" src="${h(relative(media.poster))}" alt="${h(media.alt)}"></div></div>`
    : content
  return `<figure>${framed}<figcaption>${h(media.caption)}${resultMarkup(media.result)}</figcaption></figure>`
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
    slide.studyPhases ? `<p class="meta">${h(studyFocus(slide.studyPhases))}</p>` : '',
    slide.activityTimer ? `<p class="meta">${slide.activityTimer.minutes}-minute practice</p>` : '',
    commandTable(slide),
    slide.toolTable ? `<div class="tool-resource-catalogue overflow-x-auto"><table class="table" aria-label="${h(slide.title)}"><thead><tr>${slide.toolTable.headers.map(header => `<th scope="col">${h(header)}</th>`).join('')}</tr></thead><tbody>${slide.toolTable.rows.map(row => `<tr><th scope="row"><a class="link" href="${h(relative(row.url))}">${h(row.tool)}</a></th><td>${h(row.purpose)}</td><td>${h(row.access)}</td></tr>`).join('')}</tbody></table></div>` : '',
    slide.shortcutLabels?.length ? `<ul class="shortcut-index">${slide.shortcutLabels.map(item => `<li><code>${h(item.command)}</code></li>`).join('')}</ul>` : '',
    ...catalogue(slide).map(skill => skillMarkup(skill)),
    slide.notebookOutput ? outputMarkup(notebookOutputs[slide.notebookOutput]) : mediaMarkup(slide.media),
    ...(slide.screenshots || []).map(item => `<figure><h3>${h(item.label)} · ${h(item.format)}</h3><a class="link" href="${h(relative(item.src))}"><img src="${h(relative(item.src))}" alt="${h(item.alt)}" style="max-width:100%;height:auto"></a><figcaption>${h(item.caption)}</figcaption></figure>${promptMarkup(item.prompt, 'Original slide prompt · tested unchanged in Claude')}`),
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

writePage('kit.html', 'Workshop materials', [
  '<header><h1>Workshop materials</h1>',
  '<p>Andrea is a fictional teaching case. The textbook is fictional; its technical references and the cited research are real.</p>',
  controls,
  '</header><main id="content"><h2>Study and understand</h2><ul>',
  '<li><a class="link link-primary" href="booklet-genai/Fondamenti_GenAI_Cremaschi.pdf">Textbook chapter PDF</a> · <a class="link link-primary" href="booklet-genai/lettura.html">Chapter reading HTML</a></li>',
  '<li><a class="link link-primary" href="demo-genai/index.html">Real-model application</a></li>',
  ...(notebookUrl ? [`<li><a class="link link-primary" href="${h(notebookUrl)}" target="_blank" rel="noopener">NotebookLM: Foundations of Generative Artificial Intelligence · EduForum</a></li>`] : []),
  '<li><a class="link link-primary" href="Prompt_Bank_EN.txt">Prompts and requests</a></li>',
  '<li><a class="link link-primary" href="skills-guide.html">Agent Skills: annotated catalogue and installation guide</a></li>',
  '<li><a class="link link-primary" href="teacher-tools.html">MagicSchool and Formative: recorded demonstrations</a></li>',
  '<li><a class="link link-primary" href="activities.html">Participant activity sheets</a></li>',
  '<li><a class="link link-primary" href="formula-desmos.txt">Desmos expressions and numerical example</a></li>',
  '<li><a class="link link-primary" href="verifica.html">Assessment, expected answers and rubric</a></li>',
  '</ul><h2>References</h2><ul><li><a class="link link-primary" href="source_index.csv">Source index</a></li><li><a class="link link-primary" href="references.bib" download>Verified bibliography (BibTeX / BibLaTeX)</a></li></ul>',
  '<h2>Access support</h2>',
  '<p>Open the HTML chapter in Edge for Read Aloud. Adjust text size and spacing to suit the reader. System dictation offers an alternative to typing; review its transcript. Choose and check supports with the person using them.</p>',
  '<p>The main path uses free features. Account requirements and usage limits may change. The final slide catalogues distinguish premium alternatives and trials.</p>',
  '</main>',
])

writePage('skills-guide.html', 'Agent Skills · research and teaching catalogue', [
  '<header><h1>Agent Skills for study, research and teaching</h1>',
  `<p class="meta">${skillResearch.skills.length} skills · ${skillResearch.skills.filter(skill => skill.executionStatus === 'executed').length} tested on the workshop book · sources checked ${h(skillResearch.verified)}</p>`,
  `<p>${h(skillResearch.scope)}</p>`, controls,
  '<p><a class="link link-primary" href="kit.html">Workshop materials</a></p>',
  '<nav aria-label="Skill index"><ul>',
  ...skillResearch.skills.map(skill => `<li><a class="link link-primary" href="#${h(skill.id)}">${h(skill.name)} · ${h(skill.publisher)}</a></li>`),
  '</ul></nav></header><main id="content">',
  '<section class="slide"><h2>What is a skill?</h2><p>An Agent Skill is a folder with a SKILL.md file containing metadata and workflow instructions, plus optional references, scripts and assets. A product command invokes a feature; an informal shortcut labels a request. Skills require a host that can discover them and supply the necessary tools.</p>',
  '<p><a class="link link-primary" href="https://agentskills.io/specification">Agent Skills specification</a> · <a class="link link-primary" href="https://developers.openai.com/plugins/concepts/skills">OpenAI skill and plugin concepts</a></p></section>',
  '<section class="slide"><h2>Installation depends on the host</h2><p>In the recorded account, ChatGPT web offered Plugins → Skills → Add skill → Upload from computer. The four reviewed packages were uploaded and selected in Work mode. Availability depends on the account and workspace. The terminal commands below are for compatible coding agents; they are not ChatGPT slash commands.</p>',
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
  ...Object.entries(sources).filter(([id]) => id.startsWith('SKILL_')).map(([, source]) => `<p><a class="link link-primary" href="${h(relative(source.url))}">${h(source.citation)}</a> ${h(source.limitations)}</p>`),
  '</section></main><footer><a class="link link-primary" href="#">Back to top</a></footer>',
])

const teacherOrder = ['magicschool-rubric', 'magicschool-questions', 'magicschool-lesson', 'formative-assessment', 'formative-responses', 'formative-feedback']
const teacherClips = [...teacherRecordings.clips].sort((a, b) => teacherOrder.indexOf(a.key) - teacherOrder.indexOf(b.key))
writePage('teacher-tools.html', 'MagicSchool and Formative · recorded demonstrations', [
  '<header><h1>MagicSchool and Formative</h1>',
  `<p>${teacherClips.length} real browser recordings: planning, assessment design, response review and feedback.</p>`,
  '<p>The workshop chapter and all learner responses are teaching examples. No real students were assessed or contacted. Formative was recorded in an automatically enabled Paid Teacher trial; this recording does not establish availability of every feature on the free plan.</p>',
  controls,
  links({ links: [{ label: 'Workshop materials', url: 'kit.html' }, { label: 'Original workshop chapter', url: 'booklet-genai/lettura.html' }] }),
  '</header><main id="content">',
  ...teacherClips.map(clip => {
    const media = { ...clip, alt: `${clip.service}: ${clip.name}`, caption: `${clip.recordedOn} · ${Math.round(clip.durationSeconds)} s · silent recording with optional English captions` }
    return `<section class="slide" id="${h(clip.key)}"><h2>${h(clip.service)} · ${h(clip.name)}</h2>${mediaMarkup({ ...media, type: 'video', source: clip.sourceUrl })}<p>${h(clip.observed)}</p><p>${h(clip.scope)}</p>${links({ links: [{ label: 'Open video', url: clip.src }, { label: 'Download transcript', url: clip.transcriptFile }] })}<details><summary>Recorded task</summary><p>${h(clip.prompt)}</p></details></section>`
  }),
  '<section class="slide"><h2>Recorded outputs</h2>',
  links({ links: [
    { label: 'Generated lesson plan · text', url: 'teacher-tools/magicschool-lesson-output.txt' },
    { label: 'Recording provenance', url: 'teacher-tools/provenance.json' },
  ] }),
  '</section></main>',
])

// Extended examples stay in the handout when the live tool section is shortened.
const assessment = read('data/content/assessment-examples.json').slides
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

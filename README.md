# Beyond prompting

An English presentation by Marco Cremaschi for three November 2026 events in Lithuania. **One complete path of 84 slides** follows Luca, a fictional computer science student, from a chapter about generative AI to an independent explanation and a teacher’s assessment. Presenter scripts are **Italian only**.

The audience observes how tools support learning; no programming knowledge is required. The main path uses free features. Final catalogues also include premium alternatives, with plan conditions and official links.

## Open the materials

- `exports/EduForum-2026.pdf`: complete static deck with references and semantic tags.
- `booklet-genai/build/Fondamenti_GenAI_Cremaschi.pdf`: 20-page English fictional textbook chapter with an illustrated cover and linked contents.
- `public/materials/kit.html`: material index, chapter, prompts, maps, assessment and app.
- `public/materials/lettura.html`: reflow reading version of all slides, with text preferences.
- `public/materials/Presenter_Notes_IT.txt`: full Italian script.

HTML materials and the model app should be served over HTTP. The PDF’s local material links are relative to the project folder; retain the `exports/` and `public/` directories together.

## Run locally

Requires Node.js 24.12 or newer, pnpm and installed dependencies. For a fresh checkout:

```sh
pnpm install
pnpm generate
pnpm dev
```

The development server uses `http://localhost:3047/` to avoid the other local projects’ ports. Use keyboard arrows to move through every slide in order, or presenter mode (`p`) for the full Italian script. The cover has no event selector, and the custom navigation buttons have been removed. The reading guide and kit are linked from the final materials slide.

The same commands can be run directly with Node in an already prepared workspace:

```sh
node scripts/generate-maps.mjs
node scripts/integrate-workshop.mjs
node scripts/generate-slides.mjs
node scripts/generate-companions.mjs
node node_modules/@slidev/cli/bin/slidev.mjs --port 3047
```

## One complete path

All 84 slides appear once in source order, including the three event briefs, participant activities, assessment, accessibility and final resources. Event selection and shorter paths are not part of the current presentation. Tool links and teaching interactions remain available.

The generated kit provides the single full Italian script. Earlier event-specific speech variants remain only in the source metadata and are not published as separate scripts. The presentation has no global countdown timer.

The university’s full event is 12:30–14:10 on 10 November, with two speakers. That interval is not Marco’s individual duration. All programme times are local to Vilnius.

Delivery time depends on how long the presenter spends on demonstrations, activities and discussion. The deck does not automatically change its content for an event.

## Real model exercise

`public/materials/demo-genai/` contains an English app using the actual quantised Qwen2.5-0.5B-Instruct model through Transformers.js. It shows input token IDs, five next-token probabilities and remaining vocabulary mass, temperature, short generation, comparison, stop and reset. CPU/WASM was tested offline. WebGPU remains optional and unverified.

The prepared project includes the model weights, approximately 786 MB. The lightweight distribution omits them; its pinned downloader and SHA-256 checks restore the model before an offline presentation. See the app’s `README.html` and `prepare-model.mjs`.

The real recording includes English captions and a transcript. Recorded results are stored in `captures/verified-results.json`. The three-score softmax example in the book and Desmos is illustrative and is explicitly separate from the real model measurements.

The distributed application was implemented with **Codex**. The Claude slide contains a reproducible assignment prompt; it does not present a fabricated Claude conversation or attribute the distributed code to Claude.

## Sources and screenshots

The slide catalogues and bibliography distinguish empirical learning studies, educational frameworks, technical research and product documentation. Product screenshots identify vendor examples. Learner maps, teacher responses and rubric examples are constructed teaching materials unless explicitly labelled as real recorded execution.

Goblin.tools, Gemini Notebook and Desmos have recorded executions for this scenario. The Notebook recording uses the earlier 19-page, two-column English chapter; the downloadable edition now has 20 pages and a single-column layout. The recorded citation example shows an extraction issue with that earlier PDF; the workshop checks the original paragraph in the reading edition. The recorded account has Plus access, while the demonstrated features are selected from Standard; no higher quota is presented as a free allowance.

## Authoring and verification

`data/workshop-slides.json`, `workshop-notes.json` and `workshop-sources.json` contain the workshop content. `data/opening-slides.json` preserves the introduction. Editorial media and refinements are in `data/media.json`, `editorial-overrides.json` and `editorial-notes.json`. Integration generates the final slide, source, note and single-path catalogues. `slides.md` and public companion materials are generated files.

```sh
pnpm generate
pnpm build
pnpm export
DECK_URL=http://localhost:3047/ pnpm check
```

The PDF exporter starts its own temporary local server, exports the complete static route and closes its own browser and server. It checks page count, retains semantic tags and rewrites local material links.

The booklet has a separate reproducible Typst build documented in `booklet-genai/README.md`. Book and HTML share the same English text. Font licences, figure descriptions, screenshot provenance and compiler/browser checks are included.

`output/review/` contains rendered review images and check results. Automatic checks are combined with visual inspection. The authorised VoiceOver attempt did not expose reliable speech/caption output through the computer-control surface; reading order, table and formula announcements remain unverified. VoiceOver was observed off at the end, matching its initial state. PDF/UA-1 compiler export checks for the booklet do not establish independent certification; veraPDF/PAC and NVDA were not run.

## Portable kit

`exports/EduForum-2026-kit.zip` contains the compiled presentation, editable source, Typst booklet source, PDFs, prompts, Italian scripts, maps, assessment, runtime, real recording and licences. It excludes the model weights. Extract the complete folder, follow `KIT_START_HERE.md`, and start its local server. The included manifest records SHA-256 hashes. To regenerate the archive after a final build, run `node scripts/package-kit.mjs --build`.

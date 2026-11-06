# Project structure

The Slidev entry point remains `slides.md`. The 198-slide sequence is generated from the authoring data. Public material URLs stay under `public/materials/`.

| Folder | Responsibility |
| --- | --- |
| `components/DeckSlide.vue`, `components/PrintDeck.vue` | Slidev entry points and shared static print rendering |
| `components/slides/` | Content layouts: workshop, skills, commands and shortcut detail |
| `components/shared/` | Text, logos, source lines, tables and reusable controls |
| `components/media/` | Players, overlays, animated book, cover and character |
| `composables/` | Slide lifecycle, document visibility, playback and selection motion |
| `utils/` | Typed slide data, assets, text parsing and other presentation helpers |
| `data/content/` | Editable slide content, media assignments, highlights and overrides |
| `data/references/` | Source records and bibliography |
| `data/catalogues/` | Tools, skills and shortcut descriptions |
| `data/demos/` | Recorded execution metadata and provenance inputs |
| `data/generated/` | Generated slides, sources and complete sequence; regenerate rather than edit |
| `scripts/content/` | Content integration, Slidev Markdown and companion generation |
| `scripts/checks/` | Structural, content, asset, link and browser checks |
| `scripts/delivery/` | PDF export and portable source/website kit |
| `scripts/recordings/` | Deliberate capture publication and video rendering |
| `scripts/lib/` | Project-root, JSON and browser helpers shared by command-line tools |
| `tests/demo-genai/` | Mathematics, inference and UI checks for the standalone lab |
| `booklet-genai/` | Canonical textbook content, Typst sources and reader build |
| `assets/` | Original illustrations and source provenance, excluded from the website |
| `public/` | Published files and the standalone model lab |
| `output/` | Ignored captures, diagnostics and archived local work; not delivered |

Run `pnpm generate`, then `pnpm check` and `pnpm build`. The structure check detects unresolved local imports, unreferenced Vue components, obsolete slide overlays and missing command entry points. Browser checks remain available through `pnpm check:browser`.

There is one document visibility listener shared by mounted presentation components. Slidev navigation remains the authority for active slides; playback and motion pause when their slide or browser tab is left. Print uses the same slide catalogue with static media.

The model lab has one server: `pnpm demo:dev`. Tests use that server at port 4176; set `GENAI_URL` to target another local instance. Inference and UI checks write to `output/review/demo-genai/`. `scripts/recordings/record-model-demo.mjs` intentionally publishes new captures and a recording; it is separate from validation.

Renderers under `scripts/recordings/` keep their original capture formats. `render-chatgpt-videos.py` reproduces the older result-only recordings; `render-chatgpt-build-videos.py` produces the retained prompt-to-widget demonstrations. Keep raw captures and original assets when cleaning generated outputs.

The portable kit includes composables, docs, tests, Python renderers, editable `.drawio` / `.excalidraw` files and TSV cards. It excludes local diagnostics and downloaded model weights.

Dedicated research slides display the original first PDF page without an added frame. Use `scripts/content/render-paper-page.py` to render and trim exterior blank margins; keep per-paper provenance under `assets/illustrations/papers/`. The [AI study evidence note](research/ai-study-evidence.md) records the selected sources and their limits.

Tool blocks open with a `tool-divider` slide that reuses the shared brand catalogue and prominent `ToolLogos` treatment. Only name and original logo appear on these dividers; comparison-only resources stay in the summary tables.

# Beyond prompting

Slidev presentation by Marco Cremaschi for the November 2026 workshops in Lithuania. The presentation follows Andrea, a fictional student, from an assigned GenAI textbook to independent explanation and assessment.

## Run

Requires Node.js 24.12 or newer and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm generate
pnpm dev
```

Open http://localhost:3047/. Arrow keys navigate. The Slidev toolbar provides presenter mode, an overview and keyboard controls.

### Videos from presenter mode

Keep the audience presentation and `/presenter` open in separate windows of the same browser and deck. Use the native video or audio controls in the presenter's **Current** slide: Play, Pause, seeking and playback speed are sent to the audience window. Shortcut video dialogs also open and close there. The presenter preview is muted; sound comes from the audience window. **Next**, overview and print previews remain static.

If the browser blocks remote playback, both windows show a message. Click **Enable playback** in the audience window once, then continue controlling the videos from the presenter. Keep the audience window visible on the projector: media pause when their slide or browser tab is hidden. Synchronization works between same-origin windows on the same device, including the static build; EduForum and MRU use separate channels.

## Edit

| Source | Responsibility |
| --- | --- |
| `data/content/opening-slides.json`, `workshop-slides.json` | Content and order |
| `data/content/media.json` | One media assignment per slide |
| `data/content/speaker-notes.json` | English notes keyed by stable slide ID |
| `data/content/shortcut-selection.json` | The 15 selected shortcuts |
| `data/catalogues/` | Tools and skill descriptions |
| `data/references/` | Bibliography and sources |
| `components/`, `composables/`, `utils/`, `styles/` | Vue interface, behavior and theme |
| `booklet-genai/` | Canonical textbook and reading edition |

Run `pnpm generate` after editing the sources. It rebuilds the Slidev entry, full reader data, lean runtime indexes, speaker notes and companion materials. Do not hand-edit `data/generated/`, `slides.md`, the generated notes or companion HTML/text files.

Write speaker notes as concise scripts in simple English, ready to say aloud. Use natural transitions and preserve the `[click]` markers.

### Gemini Notebook outputs

EduForum presents six Studio outputs directly, with the generating feature named beside each result. Quiz and Flashcards keep their recorded demonstrations. `data/content/notebook-outputs.json` identifies the original files and supplies the local output viewers. The recordings remain available to MRU. PDF previews preserve the original pages; rebuild the previews and extracted content with `python3 scripts/content/prepare-notebook-outputs.py` (requires Poppler, cwebp and ffmpeg), then run `pnpm generate`.

### MRU copy

`mru.md` and `data/mru/slides.json` are an independent copy of the slide order and displayed content. MRU has no speaker notes, and its production build excludes them. Edit these files directly for MRU; `data/mru/highlights.json` holds its text emphasis. `pnpm generate` only updates the original presentation.

MRU opens with flat English and Ukrainian flag buttons; the Ukrainian flag includes a small heart. `data/mru/uk.json` translates the slide text and controls. The choice persists for MRU and can be shared with `?lang=en` or `?lang=uk`. Recorded prompts, native command names, screenshots, videos and downloads retain their original language. Hidden event slides and timed practice slides are excluded from MRU; EduForum retains its original content and speaker notes.

`pnpm build` publishes a presentation selector at `/`, the EduForum deck at `/eduforum/`, the MRU copy at `/mru/` and Druskininkai at `/druskininkai/`. On GitHub Pages:

- Home: https://cremarco.github.io/AIandLearning/
- EduForum: https://cremarco.github.io/AIandLearning/eduforum/
- MRU: https://cremarco.github.io/AIandLearning/mru/
- Druskininkai: https://cremarco.github.io/AIandLearning/druskininkai/

### Druskininkai copy

`data/druskininkai/slides.json`, `speaker-notes.json` and `highlights.json` are an independent copy for 13 November 2026. The cover uses **Beyond prompting**, has no logos or practical-activity notice, and shows the new date. Whattadata, My learning route, Feelings and confidence, the 11 November event, Goblin.tools, Agent Skills, the formal Study action, Five risks, Why the learning design matters, the Reports study guide and four audience exercises are excluded. The 13 November event is active, and the remaining prompt labels are introduced simply as shortcuts. Each of the 59 source slides appears first in English and then in Lithuanian: 116 numbered slides through Thank you, followed by the two bibliography slides.

Edit the English source JSON and the Lithuanian dictionary `data/druskininkai/lt.json`, then run `pnpm generate` to rebuild the paired runtime indexes, `druskininkai.md` and the English and Lithuanian rehearsal copies in `docs/`. Generation preserves the independent content. Lithuanian routes end in `lt` (for example, `/s50lt`). Text and controls are localized per slide, including simultaneous presenter and print previews. Original recordings, screenshots, downloadable outputs, commands and recorded prompts retain their original language; prompt labels identify English text with `EN`. Presenter notes follow each slide’s language: English in `speaker-notes.json` and Lithuanian in `speaker-notes.lt.json`. Both versions preserve click markers and emphasis. Proper names, institutional names and product/feature names retain their original spelling. Use `pnpm dev:druskininkai` to open it locally on port 3048. All presentations share the existing components and public assets; the Druskininkai QR points to its own GitHub Pages route.

ElevenLabs narration reuses the CVeDI scripts in `scripts/audio/` and the same pinned SDK version, voice Cremarco, `eleven_v4`, stability 0.90, similarity 0.90 and MP3 44.1 kHz / 128 kbps. `data/druskininkai/narration/settings.json` changes only the language to `lt`; `provenance.json` records the imported sources. The speech copy is derived from the Lithuanian notes, removes presenter click and Markdown markers, and adds CVeDI's neutral delivery and paragraph pauses. The presenter notes remain intact. Slide numbers refer to the current bilingual deck: slide 4 is the Lithuanian Marco Cremaschi slide. Every Lithuanian slide from the cover through the “/flashcard” demonstration has narration and word-synchronized captions; authored click reveals follow the aligned speech.

Use an existing `ELEVENLABS_API_KEY` in the environment or the ignored `.env.local` file. No credential is copied from CVeDI or bundled into the website. Preview a selection without API calls, then generate explicitly:

```sh
pnpm audio:druskininkai --slides 4
pnpm audio:druskininkai --slides 4 --generate
```

The scripts save MP3s and receipts with text, settings and SHA-256 hashes in `public/audio/druskininkai/`. Matching recordings are reused; `--regenerate` explicitly requests a new take while preserving earlier files. Successful generation validates the MP3 and updates its captions and slide links. `pnpm generate` also connects recordings whose text and language match the current notes. Each narrated slide has CVeDI-style vertical Play, Pause, Restart and CC controls on its right edge, with localized labels. Playback stops on navigation or when the tab is hidden; previews and printed slides have no player. The build never calls ElevenLabs. `pnpm elevenlabs:voices` lists the account's voices without exposing the API key.

Lithuanian captions reuse CVeDI's local Whisper medium / stable-ts alignment and word highlighting. The exact spoken script, proper names, audio hash and language `lt` are verified together. WebVTT captions and word tracks are published under `public/captions/druskininkai/`; raw alignments and provenance stay in `data/druskininkai/narration/captions/`. CC is enabled by default and remembers the viewer's preference. A reserved band above the footer prevents captions from covering slide content. The site build verifies these files without running inference or downloading models.

On Lithuanian slides with click animations, narration also drives Slidev's native reveals. Generation maps each `[click]` note marker to the next aligned spoken word. Play from the beginning and Restart reset the reveals; playback advances them at those words, including with CC disabled. Pause holds the current state. Manual advances remain available, and seeking backwards restores the corresponding animation state. Synchronization stays on the current slide and is excluded from previews, printing and the English copies. New Lithuanian recordings receive the same timing map automatically.

The Lithuanian book preview also follows the narration clock: opening, page turns and closing span the audio, Pause freezes both, and Restart rewinds both. It uses the audio controls at the right. English book previews keep their independent controls and animation.

Prepare `.venv-captions` with Python 3.11 and `scripts/audio/whisper-requirements.txt`, using the existing local `~/.cache/whisper/medium.pt` checkpoint. Set `CAPTION_PYTHON` to reuse another compatible environment. To align existing recordings without regenerating audio:

```sh
pnpm captions:druskininkai --slides 4,6
```

Both presentations share the existing components, styles, catalogues and public assets. Images, videos, fonts and downloadable materials are stored once, in the site's root directories.

The EduForum presentation has 85 numbered slides through Thank you, followed by an unnumbered bibliography appendix. Accessibility tools have their own table. After Gemini Notebook, each tool has at most two slides.

## Check and build

```sh
pnpm check          # Content, assets, links, maths and player behavior
pnpm videos:verify  # Published videos, hashes, result files and slide assignments
pnpm build          # Static website in dist/
pnpm export         # Tagged PDF in exports/EduForum-2026.pdf
pnpm kit            # Portable source and website archive
```

Browser checks (`pnpm check:browser`) and PDF export require compatible Playwright Chromium. When working through an agent with browser controls, use the browser’s supported interface for rendered checks. The static checks and build require neither private recordings nor browser account sessions.

## Videos and results

Forty reviewed recordings use 1440 × 900 delivery frames at 60 fps. Setup runs at 3×, generation at 4×, and meaningful use retains normal speed. Each player has English captions and an adjacent result link. Labels identify static PNG/PDF/CSV results, shared widgets and downloadable files. The Learning Skill shared chat shows readable code; its original HTML kit is provided separately.

`data/demos/video-release.json` points to the current immutable release manifest under `public/materials/video-refresh/`. The manifest identifies every delivered file by size and SHA-256 hash. The current release preserves the previous Gemini Notebook Video Overview and the eight demonstrations excluded from the refresh. An available recording does not imply that its service is free or that it improves learning.

The capture, review and release workflow is documented in [docs/recordings.md](docs/recordings.md). Obsolete capture/render scripts, historical recordings and older review files have been archived outside the project with verified recovery manifests. Rebuildable caches, old builds, booklet previews and temporary PDF experiments have been removed. Archive recovery pointers are described in that document.

## Materials and model lab

- `public/materials/kit.html`: textbook, prompts, activities, assessment and guides.
- `public/materials/teacher-tools.html`: teacher demonstrations and results.
- `public/materials/booklet-genai/`: the textbook PDF and equivalent HTML.
- `public/materials/demo-genai/`: canonical real-model application.

The lab runs actual Qwen inference through bundled Transformers.js and ONNX Runtime. Use `pnpm demo:dev`; prepare its pinned model with `node public/materials/demo-genai/prepare-model.mjs`. Downloaded weights stay in one ignored directory and are excluded from normal builds and portable ZIPs. Set `INCLUDE_MODEL_WEIGHTS=1` when intentionally building a complete offline website. See the [lab README](public/materials/demo-genai/README.md).

See [project architecture](docs/architecture.md) for module boundaries and [the workshop brief](docs/workshop-brief.md) for the events and audience.

# Beyond prompting

Slidev presentation by Marco Cremaschi for the November 2026 workshops in Lithuania. The presentation follows Andrea, a fictional student, from an assigned GenAI chapter to independent explanation and assessment.

## Run

Requires Node.js 24.12 or newer and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm generate
pnpm dev
```

Open http://localhost:3047/. Arrow keys navigate. The Slidev toolbar provides presenter mode, an overview and keyboard controls.

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
| `booklet-genai/` | Canonical chapter and reading edition |

Run `pnpm generate` after editing the sources. It rebuilds the Slidev entry, full reader data, lean runtime indexes, speaker notes and companion materials. Do not hand-edit `data/generated/`, `slides.md`, the generated notes or companion HTML/text files.

The presentation has 98 numbered slides through Thank you, followed by two unnumbered reference appendices. Accessibility tools have their own table. After NotebookLM, each tool has at most two slides.

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

`data/demos/video-release.json` points to the current immutable release manifest under `public/materials/video-refresh/`. The manifest identifies every delivered file by size and SHA-256 hash. The current release preserves the previous NotebookLM Video Overview and the eight demonstrations excluded from the refresh. An available recording does not imply that its service is free or that it improves learning.

The capture, review and release workflow is documented in [docs/recordings.md](docs/recordings.md). Nine obsolete capture/render scripts and unique historical recordings have been archived outside the project. Rebuildable encode caches, old builds and old delivery archives have been removed. Archive recovery pointers are described in that document.

## Materials and model lab

- `public/materials/kit.html`: chapter, prompts, activities, assessment and guides.
- `public/materials/skills-guide.html`: skill demonstrations and requirements.
- `public/materials/teacher-tools.html`: teacher demonstrations and results.
- `public/materials/booklet-genai/`: the chapter PDF and equivalent HTML.
- `public/materials/demo-genai/`: canonical real-model application.

The lab runs actual Qwen inference through bundled Transformers.js and ONNX Runtime. Use `pnpm demo:dev`; prepare its pinned model with `node public/materials/demo-genai/prepare-model.mjs`. Downloaded weights stay in one ignored directory and are excluded from normal builds and portable ZIPs. Set `INCLUDE_MODEL_WEIGHTS=1` when intentionally building a complete offline website. See the [lab README](public/materials/demo-genai/README.md).

See [project architecture](docs/architecture.md) for module boundaries and [the workshop brief](docs/workshop-brief.md) for the events and audience.

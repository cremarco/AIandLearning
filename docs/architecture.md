# Project architecture

The editable sources are separate from presentation runtime data and published media. `pnpm generate` is the only content-generation entry point.

## Content and runtime

1. `scripts/content/integrate-workshop.mjs` combines authoring JSON, references and the canonical media map.
2. `generate-slides.mjs` writes `slides.md` and the English rehearsal notes.
3. `generate-companions.mjs` writes accessible materials using full transcripts and original prompts.

`data/generated/slides.json` retains complete reader content. `slides-runtime.json` and `shortcut-videos.json` omit inline transcripts. The Vue application imports only these lean indexes; the video dialog loads a transcript file when the reader opens its disclosure. The indexes are generated together so they cannot drift.

`components/DeckSlide.vue` and `PrintDeck.vue` share slide rendering. `components/slides/` contains content layouts, `components/shared/` reusable content and result links, and `components/media/` players and visual media. `RecordingResultLinks.vue` renders the same typed primary result and optional downloads across players. `assetUrl` resolves local material URLs for both development and relative-base builds.

`useSlideVideo` stops playback on navigation, hidden tabs and disposal. Dialog players also cancel outstanding transcript requests and ignore late responses after closing or switching clips. A shared document-visibility listener avoids one listener per slide.

Numbering uses the position of Thank you. Reference appendices remain navigable and printable, without a page counter or progress bar on their canvases. Stable slide IDs retain their notes when order changes.

## Published recordings

`data/demos/video-release.json` selects a versioned release manifest. The public packet includes videos, posters, captions, transcripts, verified result files and concise provenance. It contains no private screenshots or local review paths. Individual registries and `data/content/media.json` assign those files to slides.

`check-recordings.mjs` independently verifies published file hashes, sizes, result destinations and slide assignments. It uses only project/public files. Capture validation is a separate operation requiring private sources; ordinary generation and builds do not execute modules from ignored output directories.

The active workflow uses `video-refresh.mjs`, `render-staged-video.py`, the native-source validators and `publish-accepted-videos.mjs`. The publisher prepares a complete packet, checks it, installs assets with an atomic rename, and updates registries with a transaction journal. Current release data never converts an unapproved clip into an approved one. Superseded legacy renderers and their exclusive metadata are archived outside the project; see `docs/recordings.md` for recovery before rebuilding a historical recording.

## Other boundaries

- `booklet-genai/` owns the canonical textbook source and PDF.
- `public/materials/demo-genai/` owns the model lab, server, runtime and model preparation.
- `tests/demo-genai/` checks lab behavior; `tests/media-playback.test.mjs` checks player lifecycle and transcript loading.
- `assets/` holds illustration originals and provenance; `public/images/` and `public/icons/` hold referenced presentation assets.
- `output/`, `dist/` and `exports/` are ignored working or delivery directories. Keep useful original evidence; delete reproducible caches.

The portable kit includes editable source, compiled slides, chapter and materials, licences and a SHA-256 manifest. It excludes diagnostics, original private captures and model weights.

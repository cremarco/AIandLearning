# Recording maintenance

## Published packet

The current pointer is `data/demos/video-release.json`. Its manifest lists the exact public files, reviewed clip identities, verified results and explicitly skipped items. Run:

```sh
pnpm videos:verify
pnpm generate
pnpm check
pnpm build
```

These operations work without private capture directories. Edit teaching prose in the authoring data, not the immutable packet. Updating a recording requires a new reviewed packet and matching registry entries.

The 9 November flashcard retake uses the request `/flashcard Help me study the attached chapter.` with the chapter PDF attached. It demonstrates ChatGPT's native cards, answer reveal and recall ratings. Its result link downloads the original ten-card CSV exported from that same chat. The new release manifest preserves the other recordings and the previous packet.

The Video Overview slide uses the original MP4 generated on 8 November, installed under `public/materials/notebook/video-overview-2026-11-08/`. It preserves the full 6:56 video and original English audio. Its separate native-export provenance records the notebook, source book, original-file hash, poster and locally generated English captions. `videos:verify` checks those assets as well as the recorded interface demonstrations. The earlier silent interface video remains historical evidence.

## Capture and release

Use the supported browser interface for authentic recording. Keep separate tabs and folders for parallel producers. Finish or suspend every capture before returning control. Preserve source pixels, action clocks and the distinction between pointer coordinates and verified accessibility activations.

`render-staged-video.py` renders reviewed captures with normal-speed meaningful use, 3× setup, 4× generation, a two-second complete-prompt hold, transformed click markers and English captions. Removing an encode cache requires a complete render next time; an overlay-only operation cannot reuse a deleted cache.

`video-refresh.mjs` provides inventory, source/QA audits and release preparation. For example, with a real reviewed run and the actual user-instruction authorization file:

```sh
node scripts/recordings/video-refresh.mjs status RUN_ID
node scripts/recordings/video-refresh.mjs release-prepare RUN_ID --authorization AUTHORIZATION_JSON
node scripts/recordings/video-refresh.mjs release-apply RUN_ID
node scripts/recordings/video-refresh.mjs release-verify RUN_ID --installed
```

An authorized accepted subset is explicit. The remaining clip stays unapproved, and its previous asset is preserved. Result labels distinguish public interactive controls from static exports and readable code. Failed downloads, inaccessible native shares and policy denials are retained as limits, not reported as successful exports.

## Working files and recovery

Current private source captures and review receipts remain under `output/review/video-refresh/2026-11-07/`. They are useful original evidence and are excluded from the website and kit.

Unique historical captures and obsolete recording tools were moved, with SHA-256 verification, to `/Users/marco/Archives/EduForum/review-archive-2026-11-08/`. `output/review/ARCHIVED-2026-11-08.json` identifies the moved review roots. The archive’s `obsolete-recording-tools-manifest.json` records the former script paths, hashes and recovery instructions. Restore an original path before running a legacy renderer that refers to it. This archive is local working evidence, not a distribution dependency.

The 9 November cleanup additionally archived 4,320 older review files (925 MB) in `/Users/marco/Archives/EduForum/project-cleanup-2026-11-09/`. This includes `teacher-tool-captures`, `quiz-temporary-capture`, obsolete previews, logs and earlier cleanup reports. The archive's `manifest.json` records each original relative path, byte count and SHA-256; all moved files were verified after relocation. `output/review/ARCHIVED-2026-11-09.json` points to that manifest. To recover a legacy recording input, move its archived directory back to the same relative path in the project without overwriting a newer directory.

Active `video-refresh` captures, recent `full-prompts` work and registry-linked `shortcut-recheck-2026-11-07` evidence remain in the project. The cleanup removed 287 MB of reproducible files: the obsolete website build, derived PDF experiments, booklet page previews and Python/design caches. The canonical chapter PDF, published releases, model weights and dependencies remain available.

A second reference audit on 9 November moved ten more unused files (135 kB) to `/Users/marco/Archives/EduForum/unused-files-pass2-2026-11-09/`: four superseded Goblin/Notebook/study-tool/teacher-tool renderers, the exclusive `goblin-demos.json` and `study-tool-demos.json` inputs, the historical `chatgpt-shortcut-runs.json` record and three obsolete ChatGPT screenshots. No active code imports or reads these files. The archive's `manifest.json` records verified hashes and original paths; restore the scripts, their data and the corresponding historical captures together if needed. Current media registries, published release files and recording tests remain in the project.

Generated encode frames, Python caches, old `dist/` builds and old `exports/` archives are safe to recreate. Never substitute a final video for the source and interaction proofs needed to review a new capture.

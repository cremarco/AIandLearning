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

Generated encode frames, Python caches, old `dist/` builds and old `exports/` archives are safe to recreate. Never substitute a final video for the source and interaction proofs needed to review a new capture.

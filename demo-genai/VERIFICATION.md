# GenAI lab verification

Verified on 1 November 2026. This record describes checks actually executed, rather than intended behavior.

## Real model and mathematics

The local ONNX Qwen2.5-0.5B-Instruct q4 model loaded and ran in Chromium using single-threaded CPU/WASM. The direct completion input was `The capital of Italy is`; its five input token IDs were 785, 6722, 315, 15344, 374. Logits covered 151,936 vocabulary entries.

- At temperature 0.8, ` Rome` had probability 0.44863134074761896. Top-five remaining mass was 0.26510488995709247; entropy was 3.4968716703343294 bits.
- At temperature 1.5, the same logit vector gave ` Rome` probability 0.08057262035830588. The top rank was unchanged; remaining mass was 0.7996116083330878 and entropy 9.823421515598325 bits.
- Changing context to `The capital of France is` at temperature 0.8 executed another inference and gave ` Paris` probability 0.9123463258205815.
- One-token and short-continuation sampling executed on real logits. Stop prevented further steps; the final recording stopped after five total generated tokens. Reset preserved the loaded model and cleared results.
- Full probability sums were within 3 × 10^-14 of one. Separate numerical checks covered full-vocabulary normalization, stable softmax under a constant logit shift, ranking, entropy, sampling boundaries and invalid temperatures.

The model was loaded from the project files, not an inference API. During the offline UI check, any non-local request was blocked; no external request was attempted. A separate test of the standalone kit server also loaded the model and produced the same distribution. Measured loading was about 4–6 seconds on this computer; short inference was about 0.55–0.7 seconds. These are observations on this setup, not performance guarantees.

## Usability and accessibility checks

- Keyboard: skip link focused first; the temperature slider changed with arrow keys.
- No horizontal page overflow at 390 px width or at 720 px, representing a desktop reflow width at high zoom.
- `prefers-reduced-motion` removed the probability-bar transition.
- Empty input produced a specific recovery message.
- JSON export downloaded and contained the saved real run.
- Rendered desktop and narrow screenshots were inspected. Token spaces use a visible middle dot with an explicit legend.
- Video: genuine screen capture, English VTT and text transcript. MP4 is H.264, 1440 × 1100, 29.8 seconds; WebM is also included. No narration or music was added.

These checks do not establish full WCAG conformance. Manual screen-reader testing and WebGPU execution were not performed. CPU/WASM execution is verified; WebGPU is an available preferred path with a CPU fallback.

## Reproduction

```sh
node demo-genai/tests/math.test.mjs
node demo-genai/serve.mjs
node demo-genai/tests/browser.mjs
node demo-genai/tests/full-browser.mjs
node demo-genai/tests/ui-check.mjs
```

For the standalone public folder, start `node public/materials/demo-genai/serve.mjs`, then run `node demo-genai/tests/browser.mjs 'http://127.0.0.1:4176/?device=wasm'`. Stop the existing server before starting another on port 4176.

Evidence is stored in `demo-genai/captures/` and the stable public `materials/demo-genai/captures/` folder. The recording scripts create genuine new runs, so sampled continuations can differ.

## Design hook triage

The gradient-text detector flagged the two HTML files even though their source and stylesheet contain no gradient text or text background clipping. The false positives were scoped to those exact files with `ignore-value gradient-text=*`; no global rule was disabled. All text colors remain solid.

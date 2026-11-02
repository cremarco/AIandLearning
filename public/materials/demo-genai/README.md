# One token at a time

Real Qwen2.5-0.5B-Instruct q4 inference in the browser. English learning lab by Marco Cremaschi; implementation generated and revised with Codex. No API key, account or paid service is required.

## Start

Requires a recent Node.js (22 or later) and a modern desktop Chromium browser. From this folder:

```sh
node prepare-model.mjs
node serve.mjs
```

Open http://127.0.0.1:4176/ and choose **Load the model**. The preparation command downloads missing model files from a pinned public Hugging Face revision and verifies their sizes and SHA-256 hashes. It skips files that already match. The initial model download is about 757 MiB including the tokenizer. The large model weights may be omitted from a lightweight kit; the preparation command restores them without a paid API.

After preparation, both the app and model run from local files and need no internet. Always start the local server; opening the HTML with `file://` is unsupported. Keep the browser tab loaded before the workshop. The app can also run under the EduForum/Slidev local server at `materials/demo-genai/`.

WebGPU is tried when a compatible adapter is available. CPU/WASM is the fallback and was verified with actual inference. Add `?device=wasm` to force it. Performance and memory use depend on the computer; the model file alone is 749 MiB. The input text and outputs stay within the browser. The app makes no inference API requests.

Read `README.html` for the activity, controls, accessibility and limits. `prompt-esercizio.md` contains the reusable student assignment; `provenienza.md` describes the implementation and revisions. Do not attribute this code to a Claude conversation that has not taken place.

## Included material

- `index.html`, `app.js`, `math.js`, `style.css`: editable source.
- `vendor/`: local runtime, CSS, font and licenses.
- `model-manifest.json`: exact revision, sizes and hashes.
- `prepare-model.mjs`, `serve.mjs`: model preparation and local serving.
- `demo-reale.webm`, English VTT and transcript: an actual browser recording, with no simulated logits or probabilities.
- `captures/`: genuine screenshots and measured results.

The app performs a full-vocabulary softmax after dividing logits by positive temperature. The top five plus remaining mass are displayed; sampling uses the whole distribution. There is no top-k/top-p filter. Each generation step recomputes the context rather than using a KV cache, so this is a learning tool, not an optimal performance benchmark. A small model can produce false or incomplete text; high probability is not a truth score.

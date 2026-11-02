# Demo provenance

Learning material by Marco Cremaschi. Implementation generated and revised with Codex on 1 November 2026. No output is attributed to Claude: the included prompt can be reused with Claude Free or another assistant.

## Initial solution and revisions

1. Defined requirements: a real model, tokenizer and logits, full-vocabulary softmax, sampling without top-k/top-p, comparison and accessibility.
2. Generated an HTML/JavaScript solution with local libraries. Downloaded the actual model from Hugging Face, without a remote inference service.
3. The first browser run loaded the model and computed logits, but result composition attempted to decode an empty token array. Fix: explicitly handle an empty continuation as an empty string.
4. Added a check requiring a usable result as well as probability normalization: numerical inference alone must not make the test pass when the interface reports an error.
5. Added an event-loop yield between generation steps so that Stop can be handled while CPU/WASM is used.
6. Converted interface, examples, activity guide and recording to English, as requested. Speaker scripts belong to the presentation.

## Dependencies

- Transformers.js 3.8.1, Apache-2.0.
- ONNX Runtime Web 1.22.0-dev.20250409-89f8206ba4, MIT.
- Qwen2.5-0.5B-Instruct, ONNX conversion by `onnx-community`, Apache-2.0.
- daisyUI 5.7.50, MIT.
- Public Sans font from the EduForum project, SIL OFL.

The q4 file takes 786,156,820 bytes (about 749 MiB). Model availability in the kit does not guarantee a device's performance. Measured results on this computer are recorded separately and are not a performance promise for other computers.

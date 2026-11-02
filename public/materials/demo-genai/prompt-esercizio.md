# Student exercise

Build an English web page that helps someone understand a generative language model. You may use an AI assistant to obtain a complete solution. You must then be able to explain, check and modify it.

Use a real browser model without paid APIs: Transformers.js 3.8.1 and `onnx-community/Qwen2.5-0.5B-Instruct`, q4 quantization. Include:

1. Starting text and the tokenizer's actual tokens, with IDs.
2. Five most likely next tokens and the remaining probability mass.
3. Softmax over the full vocabulary, with adjustable positive temperature.
4. Sampling one token and a short continuation, with at most 24 new tokens.
5. Two-run comparison, reset and stop.
6. Clear loading and error states, keyboard use and readable layout.

Probabilities must come from model logits, not example values. Continue the starting text directly; explicitly state that no chat template is applied. Do not present a conceptual diagram as access to the model's internal thoughts. Preserve source code and list dependencies, licenses and limits.

## What to demonstrate after obtaining the solution

- Identify where text becomes tokens and where scores become probabilities.
- Before changing temperature, predict which results will change and which will stay the same.
- Compare “The capital of Italy is” with “The capital of France is”, keeping temperature constant.
- Explain why high probability does not guarantee a true answer.
- Correct this statement: “Increasing temperature teaches the model new information.”
- Explain why obtaining the same sentence in two runs does not show that temperature has no effect.

This is a reproducible prompt. The solution included in the kit was generated and revised with Codex; it is not a transcript of a Claude run.

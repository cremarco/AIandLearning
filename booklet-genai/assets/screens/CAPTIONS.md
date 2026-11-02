# Authentic app screenshot crops

Use the following as native English captions at 9–10 pt; preserve the distinction between probability and factual truth.

## tokens-strip.png

Actual tokenizer output for “The capital of Italy is”: five tokens, IDs 785, 6722, 315, 15344 and 374. The middle dot marks a preceding space.

At 137 mm: token text approximately 17.75 pt, ID text approximately 11.10 pt. No resampling.

## next-token-distribution.png

Actual Qwen2.5-0.5B-Instruct q4 next-token distribution for “The capital of Italy is”, temperature 0.8: “ Rome” 44.86%, “ located” 10.35%, “ __” 7.68%, “ a” 5.70%, “ the” 4.89%. All other tokens together: 26.51%. Probabilities are normalized over 151,936 vocabulary entries; they are not truth scores.

At 137 mm: main token labels approximately 11.98 pt, main percentages approximately 10.89 pt. Secondary context/rank/remaining text is below 9 pt; repeat those facts in a native caption at 9–10 pt. No resampling.

## temperature-run-b.png

Same context and logits, temperature 1.5: “ Rome” has probability 8.06% rather than 44.86% at 0.8. Token ranking is unchanged. Probability outside the top five rises from 26.51% to 79.96%; entropy rises from 3.50 to 9.82 bits.

At 137 mm: title approximately 11.63 pt, relevant body/probability line approximately 9.30 pt. Lower small metadata deliberately excluded. No resampling.

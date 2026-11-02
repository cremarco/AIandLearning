/** Probability utilities. Full vocabulary normalization; no top-k truncation. */
export function distribution(logits, temperature = 1) {
  if (!Number.isFinite(temperature) || temperature <= 0) throw new RangeError('Temperature must be positive.');
  if (!logits.length) throw new RangeError('Empty vocabulary.');
  let maximum = -Infinity;
  for (const value of logits) {
    if (!Number.isFinite(value)) throw new RangeError('Non-finite logit.');
    maximum = Math.max(maximum, value / temperature);
  }
  const probabilities = new Float64Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) sum += probabilities[i] = Math.exp(logits[i] / temperature - maximum);
  for (let i = 0; i < logits.length; i++) probabilities[i] /= sum;
  return probabilities;
}

export function ranked(probabilities, count = 5) {
  return Array.from(probabilities, (probability, id) => ({ id, probability }))
    .sort((a, b) => b.probability - a.probability || a.id - b.id).slice(0, count);
}

export function sample(probabilities, random = Math.random()) {
  if (random < 0 || random >= 1) throw new RangeError('Random value out of range.');
  let sum = 0;
  for (let id = 0; id < probabilities.length; id++) {
    sum += probabilities[id];
    if (random < sum) return id;
  }
  return probabilities.length - 1;
}

export function entropy(probabilities) {
  let bits = 0;
  for (const p of probabilities) if (p > 0) bits -= p * Math.log2(p);
  return bits;
}

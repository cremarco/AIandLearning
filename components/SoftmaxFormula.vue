<template>
  <div class="softmax-formula">
    <math display="block" aria-label="Probability p sub i equals exponential of score z sub i divided by temperature T, divided by the sum over all j of exponential of z sub j divided by T; T is positive.">
      <msub><mi>p</mi><mi>i</mi></msub><mo>=</mo>
      <mfrac>
        <mrow><mi mathvariant="normal">exp</mi><mo>(</mo><mfrac><msub><mi>z</mi><mi>i</mi></msub><mi>T</mi></mfrac><mo>)</mo></mrow>
        <mrow><munder><mo>∑</mo><mi>j</mi></munder><mi mathvariant="normal">exp</mi><mo>(</mo><mfrac><msub><mi>z</mi><mi>j</mi></msub><mi>T</mi></mfrac><mo>)</mo></mrow>
      </mfrac>
      <mspace width="1em"/><mi>T</mi><mo>&gt;</mo><mn>0</mn>
    </math>
    <p>Rescale the scores, exponentiate, then divide by the total.</p>
  </div>
</template>

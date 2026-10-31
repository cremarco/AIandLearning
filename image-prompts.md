# Image prompts e provenienza

Data: 31 ottobre 2026. Generazione con il tool integrato `image_gen` (non CLI/API). Le immagini sono illustrazioni sintetiche destinate alle slide; non sono fotografie documentarie, dati scientifici o ritratti di Marco. Tutti gli asset finali sono stati ispezionati visivamente: nessuna scritta o logo visibile; soggetti coerenti con la richiesta. La copertina è stata affinata una volta per seguire il riferimento AIPP verificato. Le altre cinque immagini sono state accettate alla prima generazione. Nessuna modifica raster successiva alla generazione.

## Riferimento autentico AIPP

- Progetto: `../AIPP/`.
- Copertina osservata: `../AIPP/public/images/aipp-cover-bg.png`.
- Fonte palette: `../AIPP/styles/tokens.css:22–25`; bordeaux `#a50036`, arancio `#ff6900`, ciano `#00b8db`.
- Uso del riferimento nella copertina finale: guida visiva a fondo avorio, forme 3D a lamelle e spazio negativo; non fonte scientifica.
- Le cinque scene tematiche sono scure, pensate per card bento con scrim del layout. Il contrasto del testo sovrapposto va verificato nel layout finale.

## hero-learning.png

- File finale: `public/images/hero-learning.png`.
- Output originale conservato: `$CODEX_HOME/generated_images/01a19275-6121-7152-b80a-ce7e02b45173/exec-3d55af7d-e1cf-40eb-9ef5-fc74d5e78e32.png`.
- Descrizione alternativa proposta: Percorso astratto in vetro e lamelle rosso/arancio/ciano a destra su fondo avorio, con ampio spazio libero a sinistra.
- Verifica: immagine generata e ispezionata, nessun test di accessibilità dell’intera slide implicato.

### Prompt completo

```text
Use case: style-transfer / stylized-concept. Asset type: premium university presentation cover background, wide landscape 16:9. Image 1 is the previous generated glass-pathway draft to revise; image 2 is the authentic AIPP cover visual used ONLY as the art-direction reference. Create the final learning-path cover with the following targeted changes: replace the entire dark background with a perfectly clean warm ivory background approximately #fbf7ef; compress the decorative sculpture into the rightmost 42 percent, leaving the entire left 58 percent clean, nearly uniform ivory negative space for a dark slide title. In the right area, create a sculptural folded learning pathway of translucent burgundy #a50036 glass with fine stacked lamellar ridges, controlled orange #ff6900 rim details and a few cyan #00b8db inner reflections, aesthetically close to the richly ridged organic forms of image 2, not a literal road. A coherent physically plausible 3D form with tactile fine grooves, dimensional bends and soft natural shadows. It can extend beyond the right and bottom edges, but must not cross into the left text area. Calm restrained premium 3D editorial rendering. Preserve the palette and educational abstract concept of image1; do not retain its dark studio setting. No text, logos, symbols, watermarks, robot, brain, people, UI or diagrams. Output only the new wide background artwork.
```

### Variante scura: hero-dark.png

File attivo nel tema scuro: `public/images/hero-dark.png`, usato in copertina e come grafica decorativa nella presentazione del relatore. È la prima variante già generata, riutilizzata senza modifiche raster. La versione avorio sopra rimane come asset di riferimento.

Output: `$CODEX_HOME/generated_images/01a19275-6121-7152-b80a-ce7e02b45173/exec-1e2a02f4-edd7-4865-a284-64cbbc2cb14f.png`.

```text
Use case: stylized-concept / productivity-visual. Asset type: reusable image background for a polished university learning presentation, wide landscape 16:9. Shared art direction: sophisticated restrained premium photographic/3D editorial style, deep near-black charcoal background, burgundy #a50036, controlled burnt-orange #ff6900 and cyan #00b8db accents, realistic matte and glass materials, tactile detail, soft cinematic side light, no excessive glow. Design for bento crops: one clear subject with separation, uncluttered margins, safe framing so the subject survives a centered crop; restrained dark negative space for slide overlays. No lettering, no numbers, no text, no logos, no watermarks, no interface screenshots. Not a diagram, no claims, no robots, no alarm imagery. Primary request: a sculptural translucent glass learning pathway: a single elegant folded rising ribbon, composed of subtly layered glass and fine lamellar ridges, with three softly lit turning points suggesting reflection, evidence and growth. Freestanding abstract physical sculpture on a dark studio background, not a road scene. Composition: sculpture occupies the right two-thirds; left third is clean dark negative space for a slide title. Materials have rich wine-red depth, a few warm orange edges and a subtle cyan inner reflection. Calm, intellectually inviting, exquisite realistic 3D rendering, clear silhouette. Do not depict literal brains or human figures.
```

Input dell’iterazione finale: bozza sopra e copertina AIPP autentica, entrambe ispezionate. Correzione richiesta: sostituzione del fondo scuro con avorio caldo e spostamento delle forme a destra.

## learning.png

- File finale: `public/images/learning.png`.
- Output originale conservato: `$CODEX_HOME/generated_images/01a19275-6121-7152-b80a-ce7e02b45173/exec-9248b2ef-ed49-4c0f-92d0-48f4c4bc03e6.png`.
- Descrizione alternativa proposta: Quaderno aperto senza scritte, matita e cartoncini su una scrivania scura con fili ciano.
- Verifica: immagine generata e ispezionata, nessun test di accessibilità dell’intera slide implicato.

### Prompt completo

```text
Use case: stylized-concept / productivity-visual. Asset type: reusable image background for a polished university learning presentation, wide landscape 16:9. Shared art direction: sophisticated restrained premium photographic/3D editorial style, deep near-black charcoal background, burgundy #a50036, controlled burnt-orange #ff6900 and cyan #00b8db accents, realistic matte and glass materials, tactile detail, soft cinematic side light, no excessive glow. Design for bento crops: one clear subject with separation, uncluttered margins, safe framing so the subject survives a centered crop; restrained dark negative space for slide overlays. No lettering, no numbers, no text, no logos, no watermarks, no interface screenshots. Not a diagram, no claims, no robots, no alarm imagery. Use case: photorealistic-natural. Primary request: an intimate high-angle editorial still life of a self-directed learner's desk. Open blank cream notebook with unruled pages and a pencil; a few blank small index cards, a translucent burgundy sheet and understated cyan thread-like curved connections physically lying across the desk, suggesting linking ideas. Human-scale, tactile real paper and graphite, comfortable lamp-lit study setting in deep charcoal. Keep the open notebook as clear central subject with generous space and no clutter. All paper entirely blank: absolutely no letters, symbols or handwriting. No screens, no people.
```

## evidence.png

- File finale: `public/images/evidence.png`.
- Output originale conservato: `$CODEX_HOME/generated_images/01a19275-6121-7152-b80a-ce7e02b45173/exec-938e624d-36ef-41e7-841a-4732232048f8.png`.
- Descrizione alternativa proposta: Lente d’ingrandimento su fogli bianchi con due linguette colorate, su tavolo scuro.
- Verifica: immagine generata e ispezionata, nessun test di accessibilità dell’intera slide implicato.

### Prompt completo

```text
Use case: stylized-concept / productivity-visual. Asset type: reusable image background for a polished university learning presentation, wide landscape 16:9. Shared art direction: sophisticated restrained premium photographic/3D editorial style, deep near-black charcoal background, burgundy #a50036, controlled burnt-orange #ff6900 and cyan #00b8db accents, realistic matte and glass materials, tactile detail, soft cinematic side light, no excessive glow. Design for bento crops: one clear subject with separation, uncluttered margins, safe framing so the subject survives a centered crop; restrained dark negative space for slide overlays. No lettering, no numbers, no text, no logos, no watermarks, no interface screenshots. Not a diagram, no claims, no robots, no alarm imagery. Use case: photorealistic-natural. Primary request: editorial research still life: one high-quality optical magnifying lens placed over a small fan of blank off-white research-paper sheets, with two blank colored source tabs, burgundy and muted cyan. Through the lens, paper fibers appear sharper: a visual metaphor for examining sources, not medical equipment. Dark desk, precise soft directional light, realistic lens refraction and soft shadows, tactile paper, subtle orange reflected rim. Composition clean, lens and pages grouped toward center-right and readable in bento crop. Entirely blank paper, no marks, no text, no charts, no numbers.
```

## visual-maps.png

- File finale: `public/images/visual-maps.png`.
- Output originale conservato: `$CODEX_HOME/generated_images/01a19275-6121-7152-b80a-ce7e02b45173/exec-39f61c23-e4d8-4aa1-ad3a-f743c0edc34d.png`.
- Descrizione alternativa proposta: Sei cartoncini bianchi collegati da fili rossi, arancio e ciano su fondo scuro.
- Verifica: immagine generata e ispezionata, nessun test di accessibilità dell’intera slide implicato.

### Prompt completo

```text
Use case: stylized-concept / productivity-visual. Asset type: reusable image background for a polished university learning presentation, wide landscape 16:9. Shared art direction: sophisticated restrained premium photographic/3D editorial style, deep near-black charcoal background, burgundy #a50036, controlled burnt-orange #ff6900 and cyan #00b8db accents, realistic matte and glass materials, tactile detail, soft cinematic side light, no excessive glow. Design for bento crops: one clear subject with separation, uncluttered margins, safe framing so the subject survives a centered crop; restrained dark negative space for slide overlays. No lettering, no numbers, no text, no logos, no watermarks, no interface screenshots. Not a diagram, no claims, no robots, no alarm imagery. Use case: photorealistic-natural. Primary request: a beautifully arranged physical concept map made from six blank small rounded paper cards on a dark charcoal table, linked by thin physical burgundy, orange and cyan threads in a simple meaningful branching arrangement, with one central cream card and smaller surrounding cards. All cards completely blank, no text, no symbols, no handwritten lines. High-angle studio photograph with subtle depth, soft shadows, tactile cotton card stock and neat orderly spacing. Connections visible at small size; central cluster fits bento crop. Calm rather than messy, no pinboard cliché, no screen.
```

## inclusion.png

- File finale: `public/images/inclusion.png`.
- Output originale conservato: `$CODEX_HOME/generated_images/01a19275-6121-7152-b80a-ce7e02b45173/exec-22acbdd7-8fc5-4dc2-9c92-e828d072ecfe.png`.
- Descrizione alternativa proposta: Quattro adulti fittizi collaborano con cartoncini e quaderni; una persona usa una carrozzina e un’altra indossa cuffie.
- Verifica: immagine generata e ispezionata, nessun test di accessibilità dell’intera slide implicato.

### Prompt completo

```text
Use case: stylized-concept / productivity-visual. Asset type: reusable image background for a polished university learning presentation, wide landscape 16:9. Shared art direction: sophisticated restrained premium photographic/3D editorial style, deep near-black charcoal background, burgundy #a50036, controlled burnt-orange #ff6900 and cyan #00b8db accents, realistic matte and glass materials, tactile detail, soft cinematic side light, no excessive glow. Design for bento crops: one clear subject with separation, uncluttered margins, safe framing so the subject survives a centered crop; restrained dark negative space for slide overlays. No lettering, no numbers, no text, no logos, no watermarks, no interface screenshots. Not a diagram, no claims, no robots, no alarm imagery. Use case: photorealistic-natural. Primary request: a respectful natural editorial photograph of four adult university collaborators at a shared accessible table, diverse skin tones and ages, casual contemporary clothing, working together over blank paper cards and an open blank notebook. One participant is a wheelchair user naturally seated at the same table height and actively arranging cards; another uses comfortable over-ear listening headphones; accessible equipment feels ordinary, not the subject of the scene. Equal participation, relaxed authentic gestures, nobody posed as helper or patient, no staged charity imagery. Burgundy, charcoal and muted cyan accents in clothing or objects; low-key but faces and hands clearly visible, realistic anatomy. Medium-wide framing, all faces and hands safely within central crop, uncluttered background. No text or logos anywhere, no projected content. These are fictional adults, not any named person.
```

## responsibility.png

- File finale: `public/images/responsibility.png`.
- Output originale conservato: `$CODEX_HOME/generated_images/01a19275-6121-7152-b80a-ce7e02b45173/exec-f2cc4b0e-2dd5-4ca7-84da-445d34fe1487.png`.
- Descrizione alternativa proposta: Trave orizzontale in equilibrio su fulcro di vetro, con sfera bordeaux e due dischi arancio e ciano.
- Verifica: immagine generata e ispezionata, nessun test di accessibilità dell’intera slide implicato.

### Prompt completo

```text
Use case: stylized-concept / productivity-visual. Asset type: reusable image background for a polished university learning presentation, wide landscape 16:9. Shared art direction: sophisticated restrained premium photographic/3D editorial style, deep near-black charcoal background, burgundy #a50036, controlled burnt-orange #ff6900 and cyan #00b8db accents, realistic matte and glass materials, tactile detail, soft cinematic side light, no excessive glow. Design for bento crops: one clear subject with separation, uncluttered margins, safe framing so the subject survives a centered crop; restrained dark negative space for slide overlays. No lettering, no numbers, no text, no logos, no watermarks, no interface screenshots. Not a diagram, no claims, no robots, no alarm imagery. Primary request: a quiet sculptural metaphor for responsible choices: a finely balanced dark metal horizontal beam supported on a central translucent glass fulcrum, with a matte burgundy sphere at one side and a small stacked pair of warm-orange and muted-cyan glass discs on the other. The beam is level and physically plausible, precise and calm. High-end museum-object photograph/realistic 3D still life on charcoal background, soft grazing light revealing material textures and stable balance. Single centered subject, cropped safely with room around it, elegant restraint. No justice-scale icon, no courtroom, no robot, no warning signs, no padlocks, no text, no human figure.
```

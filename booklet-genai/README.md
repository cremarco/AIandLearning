# Foundations of Generative Artificial Intelligence

An original teaching chapter by Marco Cremaschi, presented as an explicitly fictional book for the **Beyond prompting** workshop. The chapter, examples, exercises and reading interface are in English. The scientific publications and technical documentation are real.

The standalone project uses a 170 × 240 mm format, mirrored margins, a 130 mm single-column measure, Sora headings, DM Sans 10.5/14 pt body, and restrained teal and cyan accents. Running heads, mirrored folios, a linked contents page and consistent figure, table and checkpoint styles support navigation. It does not modify or depend on the CVeDI repository at build time.

The cover combines an original illustration generated with the built-in imagegen tool and native, selectable Typst typography. Its artwork and complete generation prompt are in `assets/cover/`; `generation.json` records the tool and date. The illustration is a decorative page background, while the title, subtitle and author remain document text.

## Files

- `contenuti.mjs`: the shared English text for both editions.
- `main.typ`, `capitolo-genai.typ`, `template/`: editable Typst sources.
- `bibliografia/riferimenti.bib`: native author–date citations and APA references.
- `assets/fonts/`: Sora and DM Sans with their SIL Open Font Licenses.
- `assets/cover/`: generated cover artwork and generation provenance.
- `build/Fondamenti_GenAI_Cremaschi.pdf`: print edition.
- `lettura.html`, `lettura.css`, `lettura.js`: equivalent reflow reading edition, using locally bundled daisyUI and fonts.
- `build/reading-check.json`: browser test results for reflow and reader controls.

## Build

Install Typst 0.15.1 and the parent project’s Node dependencies. From the EduForum project:

```sh
node booklet-genai/scripts/build.mjs
```

If Typst is not on the executable search path, set `BOOKLET_TYPST` to its executable path. The build generates the chapter and HTML from the same text, compiles with `--pdf-standard ua-1`, and copies the reading edition and PDF into `public/materials/booklet-genai/`. An unexpected compiler warning fails the build.

## Reading edition

Serve the project over HTTP, then open `/materials/booklet-genai/lettura.html`. Text size, line spacing, letter spacing and light/dark theme controls preserve the content. The edition is suitable for browser or system text-to-speech tools. No paid voice service or account is required by the page.

## Verification scope

The current 20-page PDF is tagged, declares `en-GB`, and passes Typst’s PDF/UA-1 export checks without warnings. Its tables have native header cells, conceptual figures have full text alternatives, and all five displayed formulas have spoken-language alternatives. All rendered physical pages were inspected for page fit, headings and continuation. The layout review also checked the 13 contents links, 111 chapter and study-resource content blocks against the shared source, and text bounds on every interior page. The HTML reading edition and shared chapter text were preserved.

The visual material comprises five native diagrams (including a causal mask and a probability comparison), three authentic screenshot crops with provenance and English captions, and the worked softmax example. The Notebook/Desmos procedure connects formula explanation to an independent numerical and graphical check. The three-token example is explicitly illustrative; recorded Qwen measurements are identified separately.

The reading edition was exercised in Chromium at widths of 1280, 390 and 320 CSS pixels, including maximum text size (32 px), maximum line spacing (2.3), letter spacing, theme and reset. These tests found and corrected narrow-table overflow and overlapping controls at large text sizes.

On 2 November 2026, a temporary VoiceOver test was attempted with the user’s explicit consent. VoiceOver was enabled in System Settings and heading navigation and caption output were attempted on the English reading edition. The computer-control surface did not expose reliable spoken or caption output, so reading order, tables and formulas were **not verified with a screen reader**. VoiceOver was observed off again in System Settings after the attempt. The [attempt record](./voiceover-attempt.json) documents the result.

The compiler, structure and browser checks do not establish independent PDF/UA certification or a passed VoiceOver/NVDA reading test. Independent veraPDF/PAC validation was not performed.

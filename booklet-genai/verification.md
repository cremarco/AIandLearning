# Booklet verification record

Final language: English. Workshop title: Beyond prompting. Author: Marco Cremaschi. Technical content was checked against the linked original papers and official documentation on 1 November 2026.

The initial render exposed overly tight font metrics, isolated footnote markers, and a nearly empty continuation page. Explicit font metrics, attached note references and a concise final access paragraph corrected them. The final reading-edition checks also corrected a table’s minimum-width overflow and button overlap when text was enlarged.

The final PDF uses 19 physical pages: cover 1, objectives and contents 2, chapter 3–16, glossary 17, assessment 18, references 19. Its format is 170 × 240 mm. Five diagrams, tables, text, headings and references remain native Typst content. Three raster figures are authentic app screenshot crops, with original paths, crop coordinates and hashes in `assets/screens/manifest.json`.

Verified by compiler and PDF inspection: PDF/UA-1 export succeeds without warnings; PDF is tagged; language en-GB; metadata title/author; native heading hierarchy, lists, three tables with header cells, footnotes, links and references; alternative descriptions for figures and all five displayed formulas. The worked example uses logits (2, 1, 0) at temperatures 0.5, 1 and 2, calculated independently in JavaScript. Captioned real-model results are checked against `verified-results.json`.

Verified in Chromium: reflow at 1280/390/320 px; maximum text size and line/letter spacing; mouse and keyboard theme/reset behaviour; internal links; all three screenshot resources and alternatives; no JavaScript errors. See `build/reading-check.json` and the accessibility-tree snapshot.

Manual screen-reader status: attempted, not verified. On 2 November 2026, after explicit user consent, VoiceOver was enabled through System Settings and heading navigation and caption output were attempted on the English reading HTML. The computer-control surface did not expose reliable spoken or caption output; its native VoiceOver target timed out. This does not establish a pass for reading order, tables or formulas. System Settings showed VoiceOver off again at the end. Evidence: `../output/review/voiceover-attempt.json`.

Independent veraPDF/PAC validation and a manual NVDA reading session were not performed. Do not report those checks or a VoiceOver reading test as passed.

The final 19-page edition includes the requested worked formula, Notebook/Desmos procedure, diagrams and authentic app images. The canonical PDF, public reading-kit copy and `exports/Foundations_of_Generative_AI.pdf` have identical SHA-256 hashes. The downloadable PDF and HTML are generated from the same current text; no book content or PDF was rebuilt during this final documentation audit.

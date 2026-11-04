# Booklet verification record

Final language: English. Workshop title: Beyond prompting. Author: Marco Cremaschi. Technical content was checked against the linked original papers and official documentation on 1 November 2026.

The 4 November 2026 layout revision introduces an original imagegen cover with native title typography, a single-column reading measure, running heads, mirrored folios, a linked contents page, and coordinated tables, figures and checkpoints. Text is left aligned without automatic word hyphenation. The diagram flow was checked at larger resolution and its column widths adjusted to keep labels clear of arrows.

The current PDF uses 20 physical pages: cover 1, chapter opening and objectives 2, linked contents 3, chapter 4–17, glossary 18, assessment 19, references 20. Its format is 170 × 240 mm. Five diagrams, tables, text, headings and references remain native Typst content. Three raster figures are authentic app screenshot crops, with original paths, crop coordinates and hashes in `assets/screens/manifest.json`. The decorative cover artwork and full prompt are recorded in `assets/cover/generation.json`.

Verified for this revision by compiler, PDF inspection and rendering: PDF/UA-1 export succeeds without warnings; PDF is tagged; language en-GB; metadata title/author; native heading hierarchy, lists, three tables with header cells, footnotes, links and references; all five displayed formulas retain their alternatives. All 20 pages were visually reviewed. All 13 contents links resolve to the displayed pages; 111 paragraph, list, table, screenshot-caption, glossary and assessment blocks match the shared source after normalising whitespace and typography. No interior text falls outside the checked page bounds. The underlying technical content, illustrative calculations and recorded model measurements were preserved.

Previously verified in Chromium: reflow at 1280/390/320 px; maximum text size and line/letter spacing; mouse and keyboard theme/reset behaviour; internal links; all three screenshot resources and alternatives; no JavaScript errors. See `build/reading-check.json` and the accessibility-tree snapshot. The HTML reading edition was unchanged by this PDF layout revision; browser and screen-reader tests were not repeated.

Manual screen-reader status: attempted, not verified. On 2 November 2026, after explicit user consent, VoiceOver was enabled through System Settings and heading navigation and caption output were attempted on the English reading HTML. The computer-control surface did not expose reliable spoken or caption output; its native VoiceOver target timed out. This does not establish a pass for reading order, tables or formulas. System Settings showed VoiceOver off again at the end. Evidence: `../output/review/voiceover-attempt.json`.

Independent veraPDF/PAC validation and a manual NVDA reading session were not performed. Do not report those checks or a VoiceOver reading test as passed.

The rebuilt canonical PDF and the public copy at `../public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf` have identical SHA-256 hashes. The file served at the requested localhost URL was downloaded and its hash matched the canonical PDF. Current structure counts, content checks and hashes are recorded in `build/pdf-check.json`.

# Evidence for AI-supported study

Targeted selection for the workshop, checked on 6 November 2026 with the ARS-Codex quick workflow. AI assisted source discovery, verification and wording; this is not a systematic review or a formal risk-of-bias assessment.

The teaching examples remain about the assigned GenAI chapter. They are workshop design choices, not tasks evaluated by these studies.

| Slide | Study and design | Supported message | Boundary |
| --- | --- | --- | --- |
| S52EKESTIN | [Kestin et al. (2025), Scientific Reports](https://doi.org/10.1038/s41598-025-97652-6). Randomized crossover experiment. | A structured AI tutor produced better immediate physics test results than the active-learning comparison. | 194 eligible students, one Harvard course, two lessons; not evidence of durable gains from a generic chatbot. |
| S52EDENG | [Deng et al. (2025), Computers & Education](https://doi.org/10.1016/j.compedu.2024.105224). Review of 69 studies; 62 meta-analysed. | Positive average academic and motivation-related outcomes. | Heterogeneity, publication bias, and assessment validity limit generalisation; assisted output and independent learning differ. |
| S52E | [Bastani et al. (2025), PNAS](https://doi.org/10.1073/pnas.2422633122). Randomized classroom field experiment. | GPT Base: practice scores +48%, subsequent unassisted scores −17%, relative to control. Safeguards largely removed the penalty without demonstrating an independent-test benefit. | One Turkish high school, mathematics, four sessions and short-term outcomes. |

## Search and verification scope

The question was which published research can illustrate both benefits and risks of generative AI for student learning. Searches covered experimental evidence and research syntheses, prioritising publisher records and original research papers available by 6 November 2026. Search strings included:

- `AI tutoring outperforms in-class active learning Kestin 2025 randomized controlled trial`
- `generative AI tutor study randomized controlled trial college students learning outcomes`
- `Does ChatGPT enhance student learning Deng 2025`
- `Generative AI without guardrails can harm learning Bastani PNAS correction`

Full published PDFs were obtained for all three selected papers. Read scope: Kestin abstract, Results, relevant Discussion subsections, Methods and declarations; Deng abstract, methods for study counts, Results/Table 7, discussion and declarations; Bastani publisher HTML abstract, design, main results/Table 1, limitations and declarations, plus the original PDF's first page for rendering. All three declare no competing interests; this is an author declaration, not an independent conflict investigation. Dedicated predatory-journal database checks were not performed.

The [Wang and Fan meta-analysis](https://doi.org/10.1057/s41599-025-04787-y) was excluded: its [22 April 2026 retraction notice](https://doi.org/10.1057/s41599-026-07310-z) reports concerns undermining confidence in the analysis and conclusions. Bastani has a linked correction notice; the selected numeric claims were checked against the publisher's displayed article, rather than inferred from the notice.

## First-page images

Every dedicated evidence slide displays the original PDF's first page. Only blank exterior margins are trimmed; article content, publisher marks and the existing correction notice are retained. The slide image has no added background, border, rounding or padding. Attribution and a DOI link remain outside the image.

`assets/illustrations/papers/*.source.json` records the PDF hash, page number, crop rectangle, image hash, download location where applicable, licence and structural read-preflight result. Kestin and Deng passed the PDF structural check. The existing Bastani PDF returned `UNAVAILABLE` because of an unreachable xref object; this advisory is retained, not presented as a pass. Its first page was visually inspected and its findings independently checked in the publisher HTML.

Render another paper with Poppler and Pillow:

```sh
python3 scripts/content/render-paper-page.py /path/to/original.pdf public/images/papers/author-year-first-page.png
```

The command always renders page 1 and prints provenance measurements. Keep the original PDF and its read-preflight report in ignored local review storage. Then update the media/source records and run `pnpm generate`, `pnpm check` and `pnpm build`.

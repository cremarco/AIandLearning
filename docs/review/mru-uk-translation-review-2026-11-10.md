# MRU Ukrainian translation review · 10 November 2026

Codex reviewed the 684 existing dictionary entries against their English source, checked rendered MRU content and compared terminology with Ukrainian academic sources. The review revised 42 formulations and added 14 translations: eight interface labels, three authored examples and three image descriptions.

| Area | Decision |
| --- | --- |
| Self-directed learning | Use **самоспрямоване навчання** for the SDL concept; keep **самостійне навчання** for independent learning and **саморегульоване навчання** for self-regulated learning. |
| Informal shortcuts | Use **мітки запитів** or **короткі запити** according to context. The earlier **скорочення** could suggest abbreviations. Built-in actions remain distinct from informal prompt labels. |
| Evidence of understanding | Restore **свідчення розуміння** where the earlier wording referred more broadly to evidence of learning. |
| Academic role | Use **асистент-професор (tenure-track)**, retaining the contract-track term rather than assuming a Ukrainian rank or permanent contract. |
| Idiom | Improve phrases about working through a chapter, transferable skills, retaining material, assessment rubrics and observed results. |
| Interface | Translate source-link labels, table-part labels, video-action labels and shortcut accessibility descriptions. |
| Authored examples | Translate Andrea's two illustrative statements, the authored study-environment outcome and image descriptions. Preserve actual recorded outputs and prompts in their original language. |

The Ukrainian terminology for SDL varies across publications. This deck adopts **самоспрямоване навчання**, used in [Ukrainian pedagogical research that explicitly distinguishes SDL and SRL](https://lib.iitta.gov.ua/id/eprint/723157/1/1609350110887050-24-42.pdf). The role label **асистент-професор** is also used in [a Ukrainian university's bilingual academic announcement](https://dpu.edu.ua/novyny-mizhnarodnoi-diialnosti-sef/19022026-o-1100-vidbulasia-hostova-lektsiia-monika-maria-zuchowska-grzywacz-phd-assistant-professor-casimir-pulaski-university-of-radom-faculty-of-law-and-administration-department-of-public-economic-law-and-financial-law).

The implementation review found that translating the value `informal` also changed the internal `commandCategory` of four slides. Technical categories and presentation-layout values are now preserved, with a regression check across the complete MRU deck. Recorded prompts, quoted outputs, native command names, URLs, asset paths and citation text retain their source values.

Validation: all 15 language and media-player tests passed; the MRU production build passed. The browser review covered all 84 rendered pages (83 presentation slides plus the bibliography): no text outside slide bounds and no overcrowded content stages. Authored visible prose has a translation; remaining English names, source citations and recorded examples are intentional.

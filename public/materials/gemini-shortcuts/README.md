# Gemini shortcut tests

9 November 2026 · Thinking · separate temporary chats · English UI and content.

**15 tested: 2 native interactive outputs, 5 exported interactive apps, 4 static responses, 4 generation errors.**

The five code-only responses were regenerated with Canvas. Because its preview stayed blank in the capture browser, the unmodified exports were opened and tested locally. No application code was repaired by hand. All screenshots are 1280 × 720.

| Shortcut | Observed outcome | Evidence |
|---|---|---|
| /quiz | Native quiz: hint, correct and incorrect answers, explanatory feedback, 2/3 score and review verified. | [Screenshot](screenshots/quiz.jpg) |
| /matchinggame | Canvas generation returned errors on both versions. No working output verified. | [Screenshot](screenshots/matchinggame.jpg) |
| /fillintheblanks | Regenerated in Canvas. Unmodified exported HTML verified locally: wrong answer, 2/3 then 3/3, explanations and progress. | [Screenshot](screenshots/fillintheblanks.jpg) · [Original app](apps/fillintheblanks.html) |
| /flashcard | Native 25-card set after retry: answer flip, Next and Previous verified. | [Screenshot](screenshots/flashcard.jpg) |
| /sortinggame | Regenerated in Canvas. Unmodified exported HTML verified locally: three classifications, 3/3 score and explanatory feedback. | [Screenshot](screenshots/sortinggame.jpg) · [Original app](apps/sortinggame.html) |
| /oral | Canvas generation returned an error, including after retry. No working output verified. | [Screenshot](screenshots/oral.jpg) |
| /studyplan | Textual plan; no working in-chat checkboxes, progress or reset observed. | [Screenshot](screenshots/studyplan.jpg) |
| /conceptmap | Regenerated in Canvas; the first export was incomplete. Complete unmodified replacement verified locally: Training, Inference and RAG branches, three checked answers and feedback. | [Screenshot](screenshots/conceptmap.jpg) · [Original app](apps/conceptmap.html) |
| /mistakelog | Textual dashboard and corrections; no working in-chat review controls observed. | [Screenshot](screenshots/mistakelog.jpg) |
| /caseStudy | Textual case study; no working answer fields or reveal controls observed. | [Screenshot](screenshots/caseStudy.jpg) |
| /lessonplan | Regenerated in Canvas. Unmodified exported HTML verified locally: Explain/Apply/Assess stages, three scenario checks, written response and answer reveal. | [Screenshot](screenshots/lessonplan.jpg) · [Original app](apps/lessonplan.html) |
| /differentiate | Generation returned errors, including after retry. No working output verified. | [Screenshot](screenshots/differentiate.jpg) |
| /peerassessment | Regenerated in Canvas after errors. Unmodified exported HTML verified locally: 0/1/2 selections update total to 0/1/2 out of 12; evidence reveal and written feedback work. | [Screenshot](screenshots/peerassessment.jpg) · [Original app](apps/peerassessment.html) |
| /worksheet | Generation returned an error. No working output verified. | [Screenshot](screenshots/worksheet.jpg) |
| /learningstations | Textual stations after retry; no working station tabs, answer fields or progress controls observed. | [Screenshot](screenshots/learningstations.jpg) |

Original prompts and rendering follow-ups are recorded in [provenance.json](provenance.json).

Results describe this session and do not establish that a prompt label always produces a particular interface.

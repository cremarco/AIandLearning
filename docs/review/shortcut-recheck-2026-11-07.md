# Shortcut recheck · 7 November 2026

All 49 previously static candidates were executed again in ChatGPT web, Medium, each in a fresh temporary chat. The original chapter PDF was uploaded first; the second message used the exact original probe. Each retained result was tested with a content-level action.

**Result: 41 now interactive; 8 still static.** Together with the 30 existing video examples, this identifies 71 technically eligible shortcut labels and excludes 8 static outcomes. A subsequent [editorial selection](shortcut-editorial-selection-2026-11-07.md) retains 15 complementary examples for the presentation. The earlier review remains historical evidence.

The new checks are summaries of live interactions, not new video recordings. Output formats varied between the historical and new executions. The results describe these executions, not guaranteed shortcut behaviour.

Static: `/summary`, `/sketchnote`, `/flowchart`, `/venn`, `/analogy`, `/cyclediagram`, `/learningobjectives`, `/slides`.

[Structured test record](../../data/demos/chatgpt-widget-recheck.json). Private screenshots and UI snapshots are in `output/review/shortcut-recheck-2026-11-07/`; temporary chats cannot be reopened after their tabs are closed.

| Prompt label | New result | Tested action and observation |
| --- | --- | --- |
| /mindmap | Interactive | Selected the context answer, then clicked Check answer. The response displayed Correct! and explained that context changes do not update parameters. |
| /eli5 | Interactive | Selected the context answer. Selecting the answer immediately displayed Correct! and explained that context changes do not update parameters. |
| /summary | Static | Inspected the complete response. Written summary, comparison table and visible expected answer; no content-level controls. |
| /blueprint | Interactive | Clicked the first Reveal expected answer control. The expected answer appeared and the control changed to Hide expected answer. |
| /whiteboard | Interactive | Selected Training, Inference and RAG for the three scenarios, then clicked Check answers. Criterion explanations and Score: 3/3 appeared. |
| /sketchnote | Static | Inspected the completed response. Static visual study content with visible answer and no content-level controls. |
| /flowchart | Static | Inspected the completed Mermaid diagram and response. Diagram options and Expand diagram only affect viewing; no learning controls or answer feedback. |
| /infographic | Interactive | Selected the context answer. The selection displayed correct-answer feedback about unchanged model parameters. |
| /timeline | Interactive | Selected the context-use answer. Correct! appeared with an explanation and chapter reference. |
| /venn | Static | Inspected the completed comparison and questions. The comparison and review questions have no answer fields or learning controls. |
| /analogy | Static | Inspected the completed response and its controls. Static analogy and question; only unrelated source-card and favorites controls appeared. |
| /comic | Interactive | Selected the context answer and clicked Check answer. Correct! appeared with an explanation distinguishing context from parameter changes. |
| /feynman | Interactive | Clicked Reveal explanation. The explanation became visible and the button changed to Hide explanation. |
| /glossary | Interactive | Clicked Reveal explanation. The hidden explanation appeared and the button changed to Hide explanation. |
| /conceptmap | Interactive | Selected The available context changes. Correct! and explanatory feedback appeared. |
| /fishbone | Interactive | Clicked Reveal expected answer. The expected answer appeared and the button changed to Hide expected answer. |
| /iceberg | Interactive | Selected the current-context answer. Correct and explanatory feedback appeared. |
| /pyramid | Interactive | Clicked the first Reveal answer control. The training versus inference answer appeared and the button changed to Hide answer. |
| /tree | Interactive | Selected Parameters, Available context and Information supplied as context. Feedback appeared for each selection and the score changed to Correct: 3/3. |
| /anatomydiagram | Interactive | Selected The information available in the context. Correct and explanatory feedback appeared. |
| /cyclediagram | Static | Inspected the completed diagram, distinctions and review question. No content-level controls or answer fields were present. |
| /explodedview | Interactive | Selected The model used information from its context. Correct! and explanatory feedback appeared. |
| /handwritten | Interactive | Entered an answer in the first answer field and clicked Reveal answer. The field retained the written answer; the model answer appeared and the button changed to Hide answer. |
| /onepager | Interactive | Selected the correct option for each of the three questions. Per-question feedback appeared and the score became 3/3. |
| /labeleddiagram | Interactive | Selected The information available in context. Correct! and explanatory feedback appeared. |
| /mnemonic | Interactive | Selected The information available during inference. Correct! and explanatory feedback appeared. |
| /memorypalaceimage | Interactive | Selected Room 2 — Inference and clicked Check answer. Correct! appeared with an explanation about context and unchanged parameters. |
| /memoryhooks | Interactive | Used the Reveal answer controls. The three expected answers became visible and all three controls changed to Hide answer. |
| /mnemonicart | Interactive | Selected The available context and clicked Check answer. Correct! appeared with a chapter-based explanation. |
| /visualvocab | Interactive | Selected The information available in context. Correct and explanatory feedback appeared. |
| /emojisummary | Interactive | Selected the available-context option. Correct! and explanatory feedback appeared. |
| /picturemnemonics | Interactive | Selected the context answer and clicked Check answer. Correct! and explanatory feedback appeared. |
| /cheatsheet | Interactive | Selected the correct answer for all three questions. Individual feedback appeared and the score changed to 3/3 correct. |
| /deepdive | Interactive | Selected the correct answer for three conceptual challenges. Explanatory feedback appeared and Score changed to 3/3. |
| /stepbystep | Interactive | Selected the context answer, then clicked Check answer. Correct! and the expected explanation appeared. |
| /twinexample | Interactive | Selected the context answer, then clicked Check answer. Correct! and the expected explanation appeared. |
| /workedexample | Interactive | Selected the context answer, then clicked Check answer. Correct! and the expected explanation appeared. |
| /socraticmode | Interactive | Entered a written answer, used Compare answer, then Next question. An expected answer appeared, the reviewed counter increased to 1, and the widget advanced from question 1 to question 2. This is comparison with expected reasoning, not automatic grading. |
| /commonwrong | Interactive | Selected The definition influenced inference through context. Correct! appeared with an explanation and chapter reference. |
| /realworld | Interactive | Selected The available inference context has changed. Correct! appeared with an explanation and chapter reference. |
| /connectit | Interactive | Selected the three corresponding interventions and clicked Check connections. Three explanations and Score: 3/3 appeared. |
| /lessonplan | Interactive | Clicked Reveal answers. The answer-key table and assessment answer appeared, and the button changed to Hide answers. |
| /sourceanalysis | Interactive | Selected the context interpretation and clicked Check interpretation. Correct interpretation and a chapter-based explanation appeared. |
| /learningobjectives | Static | Inspected the complete learning-objectives response. Written objectives and success criterion only; no content-level controls. |
| /rubric | Interactive | Selected the two-point rating for each of the three criteria. The running total changed from 0/6 to 6/6 and displayed Strong understanding. Scores are chosen by the reviewer, not automatically graded. |
| /bloomquestions | Interactive | Clicked the first Reveal expected answer control. The expected answer appeared and the button changed to Hide expected answer. |
| /flippedclassroom | Interactive | Clicked Reveal. The expected-answer list appeared and the button changed to Hide. |
| /differentiate | Interactive | Clicked Reveal answers. Answers for the three levels appeared and the button changed to Hide answers. |
| /slides | Static | Inspected the completed response, attached PowerPoint and its viewer controls. The result is a downloadable three-slide PowerPoint. Preview, presentation navigation and download are document-viewer controls; the generated learning content has no answer fields, reveal controls or feedback. |

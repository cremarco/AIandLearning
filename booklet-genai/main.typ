#import "template/layout.typ": *
#show: booklet

#set page(fill: accent, footer: none, columns: 1)
#set par(justify: false)
#text(font: "Sora", size: 33pt, weight: 700, hyphenate: false)[Foundations of\ Generative\ Artificial\ Intelligence]
#v(12pt)
#text(size: 15pt)[Marco Cremaschi]
#v(1fr)
#text(font: "Sora", size: 145pt, weight: 700)[AI]
#v(1fr)
#text(size: 15pt, weight: 600)[Language Models\ and Basic Architecture]
#v(16pt)
#text(size: 9pt)[Fictional book · Original teaching material\ Beyond prompting workshop · November 2026]
#pagebreak()
#set page(fill: white, footer: folio(), columns: 1)
#set par(justify: true)

#include "capitolo-genai.typ"

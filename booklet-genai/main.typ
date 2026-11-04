#import "template/layout.typ": *
#show: booklet

// The generated art is decorative; every word on the cover stays native text.
#set page(
  margin: 0pt, header: none, footer: none, fill: rgb("03151D"),
  background: image("assets/cover/language-emergence.png", width: 100%, height: 100%, fit: "cover"),
)
#set text(fill: white, hyphenate: false)
#set par(justify: false)
#place(top + left, dx: 18mm, dy: 15mm)[
  #text(size: 8pt, weight: 700, tracking: 1.4pt, fill: accent)[BEYOND PROMPTING / 2026]
]
#place(top + left, dx: 18mm, dy: 31mm, block(width: 138mm)[
  #text(font: "Sora", size: 20pt, weight: 400)[Foundations of]
  #v(5pt)
  #set par(leading: 0pt)
  #text(font: "Sora", size: 35pt, weight: 700, tracking: -0.7pt)[Generative\ Artificial\ Intelligence]
  #v(10pt)
  #text(size: 11pt, fill: rgb("C2DBDF"))[Language Models\ and Basic Architecture]
])
#place(top + left, dx: 18mm, dy: 211mm)[
  #text(size: 14pt, weight: 600)[Marco Cremaschi]
  #v(6pt)
  #text(size: 7.5pt, fill: rgb("C2DBDF"))[Original teaching material · November 2026]
]
#pagebreak()
#set page(background: none, fill: white, margin: margins, header: running-head(), footer: folio())
#set text(fill: ink, hyphenate: false)

#include "capitolo-genai.typ"

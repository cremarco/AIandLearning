#let ink = rgb("2E3138")
#let accent = rgb("53EAFD")
#let muted = rgb("626872")
#let paper-width = 170mm
#let paper-height = 240mm
#let margins = (inside: 18mm, outside: 15mm, top: 15mm, bottom: 20mm)
#let body-margins = (inside: 18mm, outside: 15mm, top: 15mm, bottom: 55mm + 8pt)
#let gutter = 5mm

#let folio() = context {
  let side = if calc.odd(counter(page).get().first()) { right } else { left }
  align(side, box(fill: accent, inset: (x: 5pt, y: 3pt), text(size: 12pt, weight: 500, counter(page).display())))
}

#let booklet(body) = {
  set document(title: "Foundations of Generative Artificial Intelligence · Language Models and Basic Architecture", author: "Marco Cremaschi", description: "Original teaching chapter for the Beyond prompting workshop. Fictional book; real technical content and sources.")
  set text(font: "DM Sans 9pt", size: 11pt, lang: "en", region: "GB", fill: ink, hyphenate: true, variations: (opsz: 18), top-edge: 0.9em, bottom-edge: -0.1em)
  set par(justify: true, leading: 2.5pt, spacing: 10pt, first-line-indent: 0pt)
  show strong: set text(weight: 700, variations: (opsz: 14))
  set page(width: paper-width, height: paper-height, binding: left, margin: margins, numbering: "1", footer: folio(), footer-descent: 17pt)
  set columns(gutter: gutter)
  set heading(numbering: "1.1.")
  show heading.where(level: 1): it => block(above: 0pt, below: 16pt, sticky: true)[
    #set text(font: "Sora", weight: 700, size: 27pt, hyphenate: false)
    #set par(justify: false, leading: 0pt)
    #it.body
  ]
  show heading.where(level: 2): it => block(above: 18pt, below: 10pt, sticky: true)[
    #set text(font: "Sora", weight: 800, size: 20pt, hyphenate: false)
    #set par(justify: false, leading: 0pt)
    #if it.numbering != none {
      context text(size: 11pt, counter(heading).display("1.1."))
      v(5pt)
    }
    #it.body
  ]
  show heading.where(level: 3): it => block(above: 14pt, below: 4pt, sticky: true)[
    #set text(weight: 900, size: 14pt, hyphenate: false)
    #set par(justify: false, leading: 0pt)
    #it.body
  ]
  show cite: set text(size: 10pt, fill: muted)
  set cite(style: "apa")
  show footnote.entry: set text(size: 7.5pt, variations: (opsz: 9))
  show footnote.entry: set par(justify: false, leading: 1.5pt, spacing: 3pt)
  set footnote.entry(separator: line(length: 30%, stroke: 0.4pt + ink), clearance: 8pt, gap: 4pt)
  set list(marker: box(baseline: (at: bottom, shift: -0.05em), square(size: 0.4em, fill: accent, stroke: none)))
  set enum(numbering: "1.", indent: 0pt, body-indent: 14pt)
  set figure(kind: "diagram", supplement: [Figure], gap: 6pt)
  show figure.caption: it => {
    set align(left)
    set text(size: 9pt, weight: 300)
    set par(justify: false, leading: 1.8pt)
    it
  }
  body
}

#let check(title, body) = block(breakable: false, above: 12pt, below: 10pt, inset: 9pt, fill: accent.lighten(78%))[
  #set par(justify: false, spacing: 5pt)
  #text(weight: 700, title)
  #parbreak()
  #body
]

#let flow-diagram(nodes, description, caption) = figure(
  block(inset: 10pt, width: 100%, fill: accent.lighten(85%))[
    #set par(justify: false, leading: 3pt)
    #for (i, node) in nodes.enumerate() {
      if i > 0 { [#align(center, text(size: 14pt)[↓])] }
      [#align(center, text(weight: 600, node))]
    }
  ],
  alt: description,
  caption: caption,
)

#let comparison-flows(caption, description) = {
  let flows = (
    ("Training", "Examples", "Prediction error", "Parameter updates", "Changed model"),
    ("Inference", "Input + fixed model", "Model calculations", "Output distribution", "Selected output"),
    ("RAG", "Question", "Retrieved passages", "Context + fixed model", "Generated answer"),
  )
  figure(
    grid(columns: (1fr, 1fr, 1fr), gutter: 10pt,
      ..flows.map(flow => block(inset: 9pt, fill: accent.lighten(85%))[
        #set text(size: 10pt)
        #set par(justify: false, leading: 3pt, spacing: 0pt)
        #text(weight: 800, size: 12pt, flow.first())
        #v(12pt)
        #for (i, node) in flow.slice(1).enumerate() {
          if i > 0 { [#v(3pt)#align(center)[↓]#v(3pt)] }
          [#align(center, node)]
        }
      ])
    ),
    scope: "parent", placement: auto, alt: description, caption: caption,
  )
}

#let representation-stages(caption, description) = figure(
  grid(columns: (1fr, 14pt, 1fr, 14pt, 1fr), align: horizon, gutter: 3pt,
    block(inset: 9pt, fill: accent.lighten(85%))[
      #set par(justify: false, spacing: 6pt)
      #text(size: 11pt, weight: 700)[Token ID]
      #parbreak()
      #text(size: 10pt)[An index in the tokenizer’s vocabulary]
    ],
    text(size: 15pt)[→],
    block(inset: 9pt, fill: accent.lighten(85%))[
      #set par(justify: false, spacing: 6pt)
      #text(size: 11pt, weight: 700)[Initial embedding]
      #parbreak()
      #text(size: 10pt)[A learned vector retrieved using the ID]
    ],
    text(size: 15pt)[→],
    block(inset: 9pt, fill: accent.lighten(85%))[
      #set par(justify: false, spacing: 6pt)
      #text(size: 11pt, weight: 700)[Contextual representation]
      #parbreak()
      #text(size: 10pt)[Transformed through decoder blocks]
    ],
  ),
  scope: "parent", placement: auto, alt: description, caption: caption,
)

#let causal-mask(caption) = {
  let cells = ()
  for row in range(1, 6) {
    cells.push(table.cell(fill: accent.lighten(85%))[#row])
    for col in range(1, 6) {
      let allowed = col <= row
      cells.push(table.cell(fill: if allowed { accent.lighten(65%) } else { white })[
        #if allowed { [yes] } else { [no] }
      ])
    }
  }
  figure({
    set text(size: 9pt)
    set par(justify: false)
    table(columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1fr), align: center,
      stroke: 0.4pt + muted, inset: 4pt,
      table.header([q / k], [1], [2], [3], [4], [5]), ..cells)
  }, caption: caption)
}

#let temperature-bars(caption, description) = {
  let rows = (
    ("T = 0.5", (0.8668133322, 0.1173104278, 0.0158762400)),
    ("T = 1", (0.6652409558, 0.2447284711, 0.0900305732)),
    ("T = 2", (0.5064803911, 0.3071958857, 0.1863237232)),
  )
  let colors = (accent, ink, rgb("B8BDC6"))
  figure(
    layout(size => {
      let width = size.width - 47pt
      for row in rows {
        grid(columns: (42pt, 1fr), gutter: 5pt, align: horizon,
          text(size: 10pt, row.first()),
          stack(dir: ltr, spacing: 0pt,
            ..row.last().enumerate().map(((i, p)) => rect(width: width * p, height: 17pt, fill: colors.at(i), stroke: none))),
        )
        v(8pt)
      }
      text(size: 9pt)[A: logit 2 · B: logit 1 · C: logit 0. Segment order: A, B, C.]
    }),
    scope: "parent", placement: auto, alt: description, caption: caption,
  )
}

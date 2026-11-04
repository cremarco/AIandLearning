#let ink = rgb("203239")
#let accent = rgb("53EAFD")
#let teal = rgb("12626C")
#let muted = rgb("586A72")
#let rule = rgb("D6E0E2")
#let tint = rgb("F0F7F7")
#let paper-width = 170mm
#let paper-height = 240mm
#let margins = (inside: 21mm, outside: 19mm, top: 23mm, bottom: 22mm)
#let body-margins = margins
#let gutter = 7mm

#let running-head() = context {
  set text(size: 7pt, fill: muted, tracking: 0.4pt)
  grid(columns: (1fr, auto), align: (left, right),
    [FOUNDATIONS OF GENERATIVE AI], [MARCO CREMASCHI])
  v(5pt)
  line(length: 100%, stroke: 0.5pt + rule)
}

#let folio() = context {
  let side = if calc.odd(counter(page).get().first()) { right } else { left }
  line(length: 100%, stroke: 0.5pt + rule)
  v(5pt)
  grid(columns: if side == right { (1fr, auto) } else { (auto, 1fr) },
    align: (left, right),
    ..if side == right {
      (text(size: 7pt, fill: muted)[LANGUAGE MODELS AND BASIC ARCHITECTURE],
       text(size: 9pt, weight: 700, fill: teal, counter(page).display()))
    } else {
      (text(size: 9pt, weight: 700, fill: teal, counter(page).display()),
       text(size: 7pt, fill: muted)[BEYOND PROMPTING])
    })
}

#let booklet(body) = {
  set document(title: "Foundations of Generative Artificial Intelligence · Language Models and Basic Architecture", author: "Marco Cremaschi", description: "Original teaching chapter for the Beyond prompting workshop. Fictional book; real technical content and sources.")
  set text(font: "DM Sans 9pt", size: 10.5pt, lang: "en", region: "GB", fill: ink, hyphenate: false, variations: (opsz: 18), top-edge: 0.9em, bottom-edge: -0.1em)
  set par(justify: false, leading: 3.5pt, spacing: 8pt, first-line-indent: 0pt)
  show strong: set text(weight: 700, variations: (opsz: 14))
  set page(width: paper-width, height: paper-height, binding: left, margin: margins, numbering: "1", header: running-head(), header-ascent: 10mm, footer: folio(), footer-descent: 9mm)
  set columns(gutter: gutter)
  set heading(numbering: "1.1")
  show heading.where(level: 1): it => block(above: 0pt, below: 15pt, sticky: true)[
    #set text(font: "Sora", weight: 650, size: 28pt, hyphenate: false, tracking: -0.5pt)
    #set par(justify: false, leading: 2pt)
    #it.body
  ]
  show heading.where(level: 2): it => block(above: 19pt, below: 12pt, sticky: true)[
    #set text(font: "Sora", weight: 650, size: 21pt, hyphenate: false, tracking: -0.4pt)
    #set par(justify: false, leading: 1.5pt)
    #if it.numbering != none {
      context text(font: "DM Sans 9pt", fill: teal, size: 9pt, weight: 700, tracking: 1pt, counter(heading).display("1.1"))
      v(7pt)
    }
    #it.body
  ]
  show heading.where(level: 3): it => block(above: 14pt, below: 4pt, sticky: true)[
    #set text(weight: 700, size: 12pt, hyphenate: false, fill: teal)
    #set par(justify: false, leading: 0pt)
    #it.body
  ]
  show cite: set text(size: 9.5pt, fill: muted)
  set cite(style: "apa")
  show footnote.entry: set text(size: 8pt, variations: (opsz: 9), fill: muted)
  show footnote.entry: set par(justify: false, leading: 1.5pt, spacing: 3pt)
  set footnote.entry(separator: line(length: 20%, stroke: 0.7pt + teal), clearance: 9pt, gap: 4pt)
  set list(marker: box(baseline: (at: bottom, shift: -0.05em), square(size: 0.35em, fill: teal, stroke: none)))
  set enum(numbering: "1.", indent: 0pt, body-indent: 14pt)
  set figure(kind: "diagram", supplement: [Figure], gap: 7pt)
  show figure: set block(above: 13pt, below: 15pt)
  show table: set text(size: 9pt, hyphenate: false)
  set table(stroke: 0.4pt + rule, fill: (x, y) => if y == 0 { tint } else { none }, inset: 7pt, align: left)
  show table.cell.where(y: 0): set text(weight: 700, fill: teal)
  show figure.caption: it => {
    set align(left)
    set text(size: 8.2pt, weight: 400, fill: muted)
    set par(justify: false, leading: 1.8pt)
    it
  }
  body
}

#let kicker(body) = text(size: 8pt, weight: 700, tracking: 1.2pt, fill: teal, body)

#let contents-entry(title, target, number) = context {
  let destination = locate(target)
  block(above: 0pt, below: 0pt, inset: (y: 8pt), width: 100%)[
    #link(target, grid(columns: (24pt, 1fr, 20pt), gutter: 5pt, align: (left, left, right),
      text(size: 9pt, weight: 700, fill: teal, number),
      text(size: 10.5pt, title),
      text(size: 10pt, fill: muted, str(counter(page).at(destination).first())),
    ))
  ]
  line(length: 100%, stroke: 0.4pt + rule)
}

#let check(title, body) = block(breakable: false, above: 13pt, below: 13pt, inset: (left: 12pt, right: 12pt, y: 10pt), width: 100%, fill: tint, stroke: (left: 2pt + teal))[
  #set text(size: 10pt)
  #set par(justify: false, leading: 3pt, spacing: 5pt)
  #text(weight: 700, size: 9pt, fill: teal, title)
  #parbreak()
  #body
]

#let flow-diagram(nodes, description, caption) = figure(
  block(inset: 12pt, width: 100%, fill: tint)[
    #set par(justify: false, leading: 3pt)
    #grid(columns: (1fr, 10pt, 1.6fr, 10pt, 1fr, 10pt, 1.3fr, 10pt, 1fr), align: horizon, gutter: 3pt,
      ..nodes.enumerate().fold((), (items, pair) => {
        let (i, node) = pair
        items + if i == 0 { (text(size: 9pt, weight: 600, node),) } else {
          (text(fill: teal)[→], text(size: 9pt, weight: 600, node))
        }
      }))
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
      ..flows.map(flow => block(inset: 11pt, fill: tint)[
        #set text(size: 9pt)
        #set par(justify: false, leading: 3pt, spacing: 0pt)
        #text(weight: 700, size: 11pt, fill: teal, flow.first())
        #v(12pt)
        #for (i, node) in flow.slice(1).enumerate() {
          if i > 0 { [#v(3pt)#align(center)[↓]#v(3pt)] }
          [#align(center, node)]
        }
      ])
    ),
    alt: description, caption: caption,
  )
}

#let representation-stages(caption, description) = figure(
  grid(columns: (1fr, 14pt, 1fr, 14pt, 1fr), align: horizon, gutter: 3pt,
    block(inset: 11pt, fill: tint)[
      #set par(justify: false, spacing: 6pt)
      #text(size: 10pt, weight: 700, fill: teal)[Token ID]
      #parbreak()
      #text(size: 9pt)[An index in the tokenizer’s vocabulary]
    ],
    text(size: 15pt)[→],
    block(inset: 11pt, fill: tint)[
      #set par(justify: false, spacing: 6pt)
      #text(size: 10pt, weight: 700, fill: teal)[Initial embedding]
      #parbreak()
      #text(size: 9pt)[A learned vector retrieved using the ID]
    ],
    text(size: 15pt)[→],
    block(inset: 11pt, fill: tint)[
      #set par(justify: false, spacing: 6pt)
      #text(size: 10pt, weight: 700, fill: teal)[Contextual representation]
      #parbreak()
      #text(size: 9pt)[Transformed through decoder blocks]
    ],
  ),
  alt: description, caption: caption,
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
      stroke: 0.4pt + rule, inset: 6pt,
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
    alt: description, caption: caption,
  )
}

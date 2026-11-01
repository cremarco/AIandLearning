#!/usr/bin/env python3
"""Build the Italian preparation guide from its editable Markdown source."""
from pathlib import Path
import html
import json
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfdoc import PDFString
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, HRFlowable, KeepTogether
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/EduForum_Guida_Relatore_IT.pdf'
SOURCE = ROOT / 'docs/guida-relatore-it.md'
FONTS = Path('/Users/marco/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype')
for suffix, filename in [('', 'DejaVuSans.ttf'), ('-Bold', 'DejaVuSans-Bold.ttf'), ('-Italic', 'DejaVuSans-Oblique.ttf'), ('-BoldItalic', 'DejaVuSans-BoldOblique.ttf')]:
    pdfmetrics.registerFont(TTFont('Guide' + suffix, str(FONTS / filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='Guide-Bold', italic='Guide-Italic', boldItalic='Guide-BoldItalic')

INK = colors.HexColor('#172D3C')
ACCENT = colors.HexColor('#006F72')
MUTED = colors.HexColor('#526573')
RULE = colors.HexColor('#D8E2E5')
BASE = dict(fontName='Guide', fontSize=10.6, leading=15.1, textColor=INK, alignment=TA_LEFT, spaceAfter=9.4, allowWidows=0, allowOrphans=0)
STYLES = {
    'body': ParagraphStyle('Body', **BASE),
    'small': ParagraphStyle('Small', fontName='Guide', fontSize=8.5, leading=11.6, textColor=MUTED, spaceAfter=7),
    'meta': ParagraphStyle('Meta', fontName='Guide', fontSize=8.2, leading=11.5, textColor=MUTED, spaceAfter=8),
    'h1': ParagraphStyle('H1', fontName='Guide-Bold', fontSize=22, leading=27, textColor=INK, spaceAfter=19, keepWithNext=True),
    'h2': ParagraphStyle('H2', fontName='Guide-Bold', fontSize=13.1, leading=18, textColor=ACCENT, spaceBefore=5, spaceAfter=8, keepWithNext=True),
    'slide': ParagraphStyle('Slide', fontName='Guide-Bold', fontSize=15.2, leading=20, textColor=INK, spaceAfter=7, keepWithNext=True),
    'cover': ParagraphStyle('Cover', fontName='Guide-Bold', fontSize=38, leading=43, textColor=INK, spaceAfter=23, keepWithNext=True),
    'bib': ParagraphStyle('Bib', fontName='Guide', fontSize=9.2, leading=12.4, textColor=INK, spaceAfter=6),
}
SLIDES = json.loads((ROOT / 'data/slides.json').read_text())
BY_ID = {s['id']: s for s in SLIDES}
SOURCES = json.loads((ROOT / 'data/sources.json').read_text())
FLOWS = json.loads((ROOT / 'data/flows.json').read_text())
PAGE_W, PAGE_H = A4

def safe(value):
    # Keep punctuation consistent and avoid non-breaking or discretionary hyphens.
    return str(value).translate(str.maketrans({'\u2010':'-', '\u2011':'-', '\u2012':'-', '\u2013':'-', '\u2014':'-', '\u2212':'-', '\u00ad':''}))

def inline(value):
    value = html.escape(safe(value), quote=False)
    value = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', lambda m: f'<link href="{m[2]}" color="#006F72"><u>{m[1]}</u></link>', value)
    value = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', value)
    def refs(match):
        ids = [x.strip() for x in match[1].split(',')]
        if not all(x in SOURCES for x in ids):
            return match[0]
        return '[' + ', '.join(f'<link href="#ref-{x}" color="#006F72">{x}</link>' for x in ids) + ']'
    value = re.sub(r'\[([A-Z0-9, ]+)\]', refs, value)
    return value

class Head(Paragraph):
    def __init__(self, text, style, key, level=0, expected_page=None):
        super().__init__(inline(text), STYLES[style])
        self.bookmark_key = key
        self.bookmark_title = safe(text)
        self.bookmark_level = level
        self.expected_page = expected_page

class GuideDoc(BaseDocTemplate):
    def __init__(self, filename, total=0):
        super().__init__(str(filename), pagesize=A4, leftMargin=57, rightMargin=57, topMargin=63, bottomMargin=55,
                         title='Beyond prompting - Guida ragionata per il relatore', author='Preparata per Marco Cremaschi',
                         subject='Contesto, spiegazione delle 44 slide, laboratorio e fonti - EduForum 2026',
                         pageCompression=1)
        self.total = total
        self.heading_pages = {}
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, leftPadding=0, bottomPadding=0, rightPadding=0, topPadding=0)
        self.addPageTemplates(PageTemplate(id='guide', frames=frame, onPage=self.decorate))

    def decorate(self, c, doc):
        c.setTitle('Beyond prompting - Guida ragionata per il relatore')
        c.setAuthor('Preparata per Marco Cremaschi')
        c._doc.Catalog.Lang = PDFString('it-IT')
        c.saveState()
        c.setStrokeColor(RULE)
        c.setLineWidth(0.6)
        if doc.page > 1:
            c.line(57, PAGE_H - 40, PAGE_W - 57, PAGE_H - 40)
            c.setFont('Guide', 8)
            c.setFillColor(MUTED)
            c.drawString(57, PAGE_H - 29, 'EDUFORUM 2026  /  GUIDA DEL RELATORE')
        c.line(57, 42, PAGE_W - 57, 42)
        c.setFont('Guide', 8)
        c.setFillColor(MUTED)
        c.drawString(57, 28, 'Marco Cremaschi  |  1 novembre 2026')
        c.drawRightString(PAGE_W - 57, 28, f'{doc.page} / {self.total}' if self.total else str(doc.page))
        if doc.page == 1:
            c.setFillColor(ACCENT)
            c.rect(57, PAGE_H - 43, 52, 5, fill=1, stroke=0)
        c.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Head):
            key = flowable.bookmark_key
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.bookmark_title, key, level=flowable.bookmark_level, closed=False)
            self.heading_pages[key] = self.page
            if flowable.expected_page is not None and self.page != flowable.expected_page:
                raise ValueError(f'Pagination overflow: {key} is on {self.page}, expected {flowable.expected_page}')

def slide_header(slide_id):
    s = BY_ID[slide_id]
    # Source and route links remain useful when reading this guide apart from the deck.
    route_names = [f["name"] for f in FLOWS if slide_id in f['slideIds']]
    route_text = ' / '.join(route_names) if route_names else 'Scheda di riserva'
    refs = ', '.join(f'<link href="#ref-{sid}" color="#006F72">{sid}</link>' for sid in s['sources'])
    url = f'https://cremarco.github.io/EduForum/#/{slide_id.lower()}'
    return [Head(f'{s["number"]:02d}  {s["title"]}', 'slide', f'slide-{slide_id}', 1),
            Paragraph(f'{slide_id}  |  {html.escape(route_text)}  |  <link href="{url}" color="#006F72">Apri slide</link><br/>Fonti: {refs}', STYLES['meta'])]

SCOPES = {
    'A01': 'RCT scolastico. Distinguere esercitazione assistita ed esame indipendente; variazioni relative.',
    'A02': 'RCT crossover. Esito immediato di un tutor progettato; nessuna prova di ritenzione a distanza.',
    'A03': 'Esperimento di scrittura. Qualità del saggio, conoscenza e transfer sono esiti separati.',
    'A04': 'Studio sull\'agency con tecniche precedenti a ChatGPT; non prova su chatbot generativi attuali.',
    'A05': 'Questionario su lavoratori della conoscenza. Associazioni autoriferite, non causa né studio sugli alunni.',
    'A06': 'RCT fra configurazioni IA. Nessun gruppo senza IA; misure brevi di conoscenza.',
    'A07': 'RCT fra tre condizioni IA. Emozioni e conoscenza distinte; follow-up incompleto.',
    'A09': 'Discussione metodologica: attribuire gli effetti al confronto e al pacchetto didattico concreto.',
    'A14': 'Quadro sul cognitive offloading anteriore alla diffusione di ChatGPT.',
    'A16': 'Esperimento su decisioni immediate. Nessuna dimostrazione di un\'abitudine stabile.',
    'A17': 'Studio storico delle citazioni generate. Non tasso di errore dei prodotti attuali.',
    'A19': 'AVVISO DI RITRATTAZIONE, 2026. Solo esempio di controllo editoriale; escluso dalle prove di efficacia.',
    'A20': 'Revisione sulla distinzione tra prestazione e apprendimento; precedente all\'IA generativa.',
    'B01': 'Revisione dei modelli di autoregolazione. Base teorica, non validazione del canvas.',
    'B02': 'Discussione di self-direction e self-regulation; definizioni da usare con cautela.',
    'B03': 'Meta-analisi delle mappe: attività, compiti e confronti eterogenei.',
    'B04': 'Meta-analisi su studio e costruzione di mappe. Moderatori non sempre confronti causali diretti.',
    'B05': 'Esperimento di recupero contro una specifica attività di mapping; evitare generalizzazioni assolute.',
    'B12': 'Revisione dello scaffolding docente-discente; non studio di efficacia dei chatbot attuali.',
    'B13': 'Argomentazione e mapping dentro un intervento; non isolamento della sola forma visuale.',
    'B18': 'Distinzione fra sensazione e misura di apprendimento; non esperimento sull\'IA generativa.',
    'B23': 'RCT su interpretazione di visual learning analytics; esito immediato, non clinico.',
    'B27': 'Studio quasi sperimentale su mapping e recupero; non studio su IA generativa.',
    'R02': 'Orientamento UNESCO su educazione, ricerca e responsabilità; non certificazione di prodotto.',
    'R03': 'Guida ufficiale per educatori, edizione rivista 2026; non verifica di conformità del singolo tool.',
    'R04': 'Guida didattica su metacognizione e autoregolazione; adattare al contesto.',
    'R06': 'Strumento pratico collegato alla guida EEF; domande metacognitive, non prova sul canvas.',
    'R10': 'UDL 3.0: riferimento per opzioni di accesso e partecipazione; non equivalenza di ogni formato.',
    'R12': 'Checklist per eventi e presentazioni accessibili. Applicare anche a consegne e materiali.',
    'R13': 'Indicazioni per immagini complesse: rendere disponibili relazioni e informazioni in testo.',
    'R14': 'Standard WCAG 2.2 per contenuti web. Una checklist parziale non certifica conformità.',
    'R15': 'Studio su bias legati al dialetto in specifici modelli e scenari.',
    'R16': 'Interviste a persone cieche: benefici ed errori; non tasso universale attuale.',
    'R19': 'Orientamento sui diritti dei discenti e sull\'adozione responsabile.',
    'R20': 'Indicazioni W3C per contenuti alternativi a informazioni e compiti complessi.',
    'R21': 'Quadro UNESCO delle competenze IA degli studenti; non test di efficacia di un prodotto.',
    'C08': 'Rapporto teorico e operativo sulle mappe concettuali e sulle relazioni etichettate.',
    'C16': 'Documentazione di funzioni di prodotto; non prova di efficacia didattica.',
    'C17': 'Revisione universitaria di accessibilità di un prodotto; verificare versione e condizioni.',
    'C19': 'Sito ufficiale CmapTools. Esempio di strumento per mappe.',
    'C20': 'Repository ufficiale Excalidraw. Esempio di lavagna e progetto open source.',
    'C30': 'Supporto ufficiale dei sottotitoli nel browser; verificare lingue e condizioni attuali.',
    'C31': 'Materiale ufficiale d\'uso di ChatGPT. Descrive un flusso, non ne dimostra l\'efficacia.',
    'BIO01': 'Profilo istituzionale del relatore.',
    'BIO02': 'Materiale AIPP preesistente usato come riferimento visivo, non evidenza scientifica.',
    'BIO03': 'Sito personale del relatore; riferimento per il profilo aggiornato.',
    'ORG01': 'Sito ufficiale Whattadata: presentazione delle attività, non prova di efficacia educativa.',
    'ORG02': 'Elenco istituzionale UniMiB degli spin-off ICT/Web: contesto organizzativo.',
}

def build_story():
    raw = SOURCE.read_text()
    blocks = re.split(r'<!-- page: (\w+) -->', raw)
    story = []
    page_number = 0
    slide_ids = []
    for i in range(1, len(blocks), 2):
        kind, content = blocks[i], blocks[i + 1].strip()
        page_number += 1
        if page_number > 1:
            story.append(PageBreak())
        if kind == 'slides':
            ids = re.findall(r'<!-- slide: (S\d+) -->', content)
            nums = [BY_ID[x]['number'] for x in ids]
            story.append(Head(f'Le slide  /  {nums[0]:02d}-{nums[-1]:02d}', 'h1', f'page-{page_number}', expected_page=page_number))
        paragraphs = re.split(r'\n\s*\n', content)
        for j, part in enumerate(paragraphs):
            part = part.strip()
            if not part:
                continue
            match = re.fullmatch(r'<!-- slide: (S\d+) -->', part)
            if match:
                sid = match[1]
                if sid in slide_ids:
                    raise ValueError('Duplicate slide ' + sid)
                if len(slide_ids) % 2 == 1:
                    story += [Spacer(1, 14), HRFlowable(width='100%', thickness=0.6, color=RULE, spaceAfter=17)]
                slide_ids.append(sid)
                story += slide_header(sid)
            elif part.startswith('## '):
                story.append(Paragraph(inline(part[3:]), STYLES['h2']))
            elif part.startswith('# '):
                story.append(Head(part[2:], 'cover' if kind == 'cover' else 'h1', f'page-{page_number}', expected_page=page_number))
            else:
                story.append(Paragraph(inline(' '.join(part.splitlines())), STYLES['body']))
    if slide_ids != [s['id'] for s in SLIDES]:
        raise ValueError('Guide does not cover all slides in physical order')
    if page_number != 35:
        raise ValueError(f'Unexpected guide source page count: {page_number}')
    keys = sorted(SOURCES, key=lambda x: (['A','B','R','C','BIO','ORG'].index(re.match('[A-Z]+',x)[0]), int(re.search(r'\d+',x)[0])))
    for start in range(0, len(keys), 8):
        page_number += 1
        story.append(PageBreak())
        story.append(Head(f'Fonti  /  {start // 8 + 1}', 'h1', f'page-{page_number}', expected_page=page_number))
        if start == 0:
            story.append(Paragraph('Registro delle 48 fonti del set di slide. I codici sono cliccabili nel testo. Articoli, linee guida, documentazione tecnica e profili hanno funzioni diverse: il loro inserimento non costituisce una prova unica di efficacia.', STYLES['small']))
        for sid in keys[start:start+8]:
            source = SOURCES[sid]
            title = html.escape(safe(source['title']))
            citation = html.escape(safe(source.get('citation') or f'Risorsa web - {source.get("label", sid)}.'))
            url = source.get('url')
            if url:
                linked = f'<link href="{html.escape(url,quote=True)}" color="#006F72"><u>{title}</u></link>'
            else:
                linked = title + ' (riferimento preesistente, senza collegamento pubblico)'
            first = f'<a name="ref-{sid}"/><b>{sid}</b>  {linked}<br/>{citation}'
            second = html.escape(SCOPES[sid])
            story.append(KeepTogether([Paragraph(first, STYLES['bib']), Paragraph(second, STYLES['small']), Spacer(1, 7)]))
    return story, page_number

def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    story, expected = build_story()
    doc = GuideDoc(OUT)
    doc.build(story)
    total = len(PdfReader(OUT).pages)
    if total != expected:
        raise ValueError(f'PDF has {total} pages, expected {expected}')
    # Fresh flowables and a second pass give a reliable x/total footer.
    story, _ = build_story()
    doc = GuideDoc(OUT, total)
    doc.build(story)
    print(json.dumps({'pdf':str(OUT), 'pages':total, 'source_words':len(SOURCE.read_text().split()), 'slides':44, 'references':len(SOURCES), 'heading_pages':doc.heading_pages}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

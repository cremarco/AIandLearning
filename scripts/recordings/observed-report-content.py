"""Read-only structural extraction of an observed NotebookLM report HTML body."""
import json
import re
import sys
from html.parser import HTMLParser


class Element:
    def __init__(self, tag, attrs=(), parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children = []


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Element('root')
        self.current = self.root

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.current = node

    def handle_endtag(self, tag):
        node = self.current
        while node.parent and node.tag != tag:
            node = node.parent
        if node.parent:
            self.current = node.parent

    def handle_data(self, value):
        self.current.children.append(value)


def walk(node):
    yield node
    for child in node.children:
        if isinstance(child, Element):
            yield from walk(child)


def norm(value):
    return re.sub(r'\s+', ' ', value).strip()


def text(node):
    return ''.join(text(c) if isinstance(c, Element) else c for c in node.children)


def extract(filename):
    parser = Parser()
    with open(filename, encoding='utf-8') as stream:
        parser.feed(stream.read())
    all_nodes = list(walk(parser.root))
    blocks = []
    for node in all_nodes:
        paragraph = node.tag in {'div', 'li'} and 'paragraph' in node.attrs.get('class', '').split()
        standalone_math = 'math-element' in node.attrs.get('class', '').split()
        ancestor = node.parent
        while standalone_math and ancestor:
            if 'paragraph' in ancestor.attrs.get('class', '').split() or 'math-element' in ancestor.attrs.get('class', '').split():
                standalone_math = False
            ancestor = ancestor.parent
        if not paragraph and not standalone_math:
            continue
        runs, maths, pending = [], [], []

        def visit(part):
            if isinstance(part, str):
                pending.append(part)
            elif part is not node and 'paragraph' in part.attrs.get('class', '').split():
                return
            elif 'math-element' in part.attrs.get('class', '').split():
                runs.append(norm(''.join(pending)))
                pending.clear()
                tex = [n.attrs['data-math'] for n in walk(part) if 'data-math' in n.attrs]
                if len(tex) != 1:
                    raise ValueError('Each original math element must expose one canonical data-math value')
                maths.append(tex[0])
            else:
                for child in part.children:
                    visit(child)
        visit(node)
        runs.append(norm(''.join(pending)))
        ancestor, cell = node.parent, None
        while ancestor:
            if ancestor.tag in {'td', 'th'}:
                cell = ancestor.tag
                break
            ancestor = ancestor.parent
        level = int(node.attrs['aria-level']) if node.attrs.get('role') == 'heading' else None
        blocks.append({'index': len(blocks), 'sourceStartIndex': node.attrs.get('data-start-index'),
                       'kind': 'math' if standalone_math else 'heading' if level else 'table-cell' if cell else 'list-item' if node.tag == 'li' else 'paragraph',
                       'headingLevel': level, 'textRuns': runs, 'mathTex': maths})
    headings = [{'level': b['headingLevel'], 'text': b['textRuns'][0]} for b in blocks if b['kind'] == 'heading']
    tables = []
    for table in [n for n in all_nodes if n.tag == 'table']:
        rows = []
        for row in [n for n in walk(table) if n.tag == 'tr']:
            rows.append([norm(text(n)) for n in row.children if isinstance(n, Element) and n.tag in {'td', 'th'}])
        tables.append(rows)
    return {'schemaVersion': 1, 'blocks': blocks, 'headings': headings, 'tables': tables,
            'mathTex': [value for block in blocks for value in block['mathTex']]}


if __name__ == '__main__':
    print(json.dumps(extract(sys.argv[1]), ensure_ascii=False, separators=(',', ':')))

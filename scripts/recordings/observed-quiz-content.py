"""Fixed read-only extraction from bundled original visible Quiz DOM records."""
import sys,json,hashlib
from pathlib import Path
from bs4 import BeautifulSoup,NavigableString,Comment

def normalized_dom(html):
    return str(BeautifulSoup(html, 'html.parser'))


def project(node, record, selector, source):
    assert node is not None, f'Missing native DOM selector {selector}'
    segments = []

    def visit(current):
        if isinstance(current, Comment):
            return
        if isinstance(current, NavigableString):
            if segments and segments[-1]['kind'] == 'text':
                segments[-1]['text'] += str(current)
            else:
                segments.append({'kind': 'text', 'text': str(current)})
            return
        if 'katex' in current.get('class', []):
            matches = [m for m in record['rendered']['math']
                       if normalized_dom(m['originalSerializedDOM']) == normalized_dom(str(current))]
            assert matches, f'Math not bound to actually observed node: {source} {selector}'
            assert all(m == matches[0] for m in matches)
            segments.append(matches[0].copy())
            return
        assert current.name not in ('script', 'style', 'template'), 'Non-rendered native content rejected'
        for child in current.children:
            visit(child)

    visit(node)
    assert segments and ''.join(s.get('text', s.get('renderedText', '')) for s in segments).strip()
    return {'segments': segments, 'source': {'path': str(source), 'sha256': record['$sourceSha256'],
            'selector': selector, 'originalSerializedDOM': str(node),
            'domSha256': hashlib.sha256(str(node).encode()).hexdigest()}}


def value(field):
    return ''.join(s.get('text', s.get('renderedText', '')) for s in field['segments'])


def build(descriptor):
    records = {}
    for entry in descriptor["bundles"]:
        record=json.loads(Path(entry["recordPath"]).read_text())
        rendered=record['rendered']
        main=BeautifulSoup(rendered['visibleMain']['originalSerializedDOM'],'html.parser')
        assert normalized_dom(str(main.select_one('h1.question-text')))==normalized_dom(rendered['heading']['originalSerializedDOM']), 'Heading must be in actual observed main DOM'
        options=main.select('button.answer-btn')
        assert len(options)==4 and len(rendered['options'])==4
        assert all(normalized_dom(str(node))==normalized_dom(option['originalSerializedDOM']) for node,option in zip(options,rendered['options'])), 'Options must retain actual main DOM order/content'
        record["$sourceSha256"]=entry["sha256"]
        records[(entry["question"],entry["stage"])]=(record,Path(entry["originalPath"]))
    questions = []
    for n in range(1, 7):
        hint, hint_path = records[(n, 'hint')]
        feedback, feedback_path = records[(n, 'feedback')]
        hr, fr = hint['rendered'], feedback['rendered']
        hmain = BeautifulSoup(hr['visibleMain']['originalSerializedDOM'], 'html.parser')
        question = project(BeautifulSoup(hr['heading']['originalSerializedDOM'], 'html.parser').h1,
                           hint, 'h1.question-text', hint_path)
        feedback_question = project(BeautifulSoup(fr['heading']['originalSerializedDOM'], 'html.parser').h1,
                                    feedback, 'h1.question-text', feedback_path)
        assert question['segments'] == feedback_question['segments']
        assert value(question) == hr['heading']['innerText'] == fr['heading']['innerText']
        hint_value = project(hmain.select_one('.hint-text'), hint, '.hint-text', hint_path)
        assert len(hr['options']) == len(fr['options']) == 4
        options = []
        for label, hoption, foption in zip('ABCD', hr['options'], fr['options']):
            assert hoption['label'] == foption['label'] == label
            hs = BeautifulSoup(hoption['originalSerializedDOM'], 'html.parser')
            fs = BeautifulSoup(foption['originalSerializedDOM'], 'html.parser')
            assert foption['disabled'] is True and fs.button.has_attr('disabled')
            content = project(hs.select_one('.answer-text'), hint, f'button.answer-btn[{label}] .answer-text', hint_path)
            feedback_content = project(fs.select_one('.answer-text'), feedback, f'button.answer-btn[{label}] .answer-text', feedback_path)
            assert content['segments'] == feedback_content['segments']
            explanation = project(fs.select_one('.rationale'), feedback, f'button.answer-btn[{label}] .rationale', feedback_path)
            correct = 'correct' in fs.button.get('class', [])
            if correct:
                assert fs.select_one('.reaction-correct') and fs.select_one('.reaction-correct').get_text(strip=True) == "That's right!"
            options.append({'label': label, 'content': content, 'explanation': explanation, 'correct': correct,
                            'correctnessSource': {'path': str(feedback_path), 'sha256': feedback['$sourceSha256'],
                                                  'buttonClasses': fs.button.get('class'), 'disabled': True}})
        assert sum(o['correct'] for o in options) == 1
        questions.append({'number': n, 'question': question, 'hint': hint_value, 'options': options})
    return questions

if __name__ == "__main__":
    print(json.dumps(build(json.loads(sys.stdin.read())),ensure_ascii=False))

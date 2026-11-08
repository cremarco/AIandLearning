"""Render genuine browser captures into staging; never publish or change slides.

Geometry is observed metadata, not a reconstructed interface. Optional native
`contentBounds` are CSS rectangles on a frame or phase; `cropPixels` are explicit
pixel rectangles. A framing JSON may supply phaseBounds and framingGroups after
reviewing the real capture. Missing geometry keeps the complete native viewport.
Only explicit idleRanges are shortened. All other source timing is preserved at
3x for setup/input, 4x for generation and 1x for actual use.
"""
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / 'output/review/video-refresh'
WIDTH, HEIGHT, FPS, BAR, PAD = 1440, 900, 60, 60, 24
FAST = re.compile(r'(^|[-_])(setup|home|temporary|new|open|upload|pdf|attach|input|typing|write|configure|configuration|settings|select|send)([-_]|$)')
NORMAL = re.compile(r'usage|widget|review|feedback|hint|answer|retry|summary|read|playback|result|learner|prompt-ready|prompt-hold')


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def claim_render_progress(path, value):
    # A second writer must not encode into the first writer's candidate files.
    # Failed runs retain this evidence; cleanup requires an explicit review.
    with path.open('x') as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def within(path, parent):
    return path.resolve().is_relative_to(parent.resolve())


def rate(phase):
    category = phase.get('category', phase['name']).lower()
    if 'generation' in category:
        return 4
    if NORMAL.search(category):
        return 1
    return 3 if FAST.search(category) else 1


def stamp(seconds):
    n = round(seconds * 1000)
    return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02}.{n%1000:03}'


def font(size, bold=False):
    choices = [f'/System/Library/Fonts/Supplemental/Arial{" Bold" if bold else ""}.ttf',
               f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf']
    for file in choices:
        if Path(file).exists():
            return ImageFont.truetype(file, size)
    return ImageFont.load_default(size=size)


def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                             '-show_entries', 'stream=width,height,r_frame_rate',
                             '-show_entries', 'format=duration', '-of', 'json', str(path)],
                            check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    stream = data['streams'][0]
    num, den = map(int, stream['r_frame_rate'].split('/'))
    return {'width': stream['width'], 'height': stream['height'], 'fps': num/den,
            'durationSeconds': float(data['format']['duration'])}


def rectangle(rect):
    if isinstance(rect, list):
        assert len(rect) == 4
        return list(map(float, rect))
    left, top = rect.get('left', rect.get('x')), rect.get('top', rect.get('y'))
    return [left, top, rect['right'] if 'right' in rect else left + rect['width'],
            rect['bottom'] if 'bottom' in rect else top + rect['height']]


def source_clip(frame, capture):
    # Explicit null means this particular frame is the complete native viewport.
    if 'screenshotClip' in frame:
        return frame['screenshotClip']
    return capture.get('screenshotClip') if frame.get('method') == 'Page.captureScreenshot' else None


def css_ratio(frame, capture, image):
    clip = source_clip(frame, capture)
    if clip:
        return image.width / float(clip['width'])
    viewport = frame.get('viewport') or capture.get('sourceViewport') or capture.get('viewport') or {}
    css_width = viewport.get('width') or frame.get('metadata', {}).get('deviceWidth')
    if css_width:
        return image.width / float(css_width)
    return float(viewport.get('deviceScaleFactor', capture.get('deviceScaleFactor', 1)))


def framing(frame, phase, capture, config, source):
    file = (source / frame['file']).resolve()
    assert within(file, source), 'Source frames must stay inside the capture directory'
    with Image.open(file) as image:
        ratio = css_ratio(frame, capture, image)
        clip = source_clip(frame, capture) or {}
        origin_x, origin_y = float(clip.get('x',0)), float(clip.get('y',0))
        native = frame.get('contentBounds') or config.get('frameBounds', {}).get(frame['file']) or phase.get('contentBounds') or config.get('phaseBounds', {}).get(phase['name']) or capture.get('phaseBounds', {}).get(phase['name']) or capture.get('contentBounds')
        pixels = frame.get('cropPixels') or config.get('frameCropPixels', {}).get(frame['file']) or phase.get('cropPixels') or config.get('phaseCropPixels', {}).get(phase['name'])
        reviewed_crop = config.get('_qualifiedNativeAppCrop')
        if reviewed_crop and frame.get('nativeRetakeOrigin', {}).get('captureSha256') == reviewed_crop['readerCaptureSha256']:
            pixels = reviewed_crop['cropPixels']
        frame_review = config.get('_qualifiedFrameCrops', {}).get(frame['file'])
        if frame_review:
            pixels = frame_review['cropPixels']
        if pixels:
            box = rectangle(pixels)
        elif native:
            native_box = rectangle(native)
            box = [(v-(origin_x if i%2==0 else origin_y))*ratio for i,v in enumerate(native_box)]
            # Padding may reach the real viewport edge; the native content may not.
            assert box[0] >= 0 and box[1] >= 0 and box[2] <= image.width and box[3] <= image.height, f"{frame['file']}: native content is clipped in source capture"
            box = [max(0, box[0]-PAD), max(0, box[1]-PAD), min(image.width, box[2]+PAD), min(image.height, box[3]+PAD)]
        else:
            box = [0, 0, image.width, image.height]
        assert all(math.isfinite(v) for v in box) and 0 <= box[0] < box[2] <= image.width and 0 <= box[1] < box[3] <= image.height
        box = [round(v) for v in box]
        masks = config.get('framePrivacyMasks', {}).get(frame['file'], [])
        for mask in masks:
            rect = rectangle(mask['box'])
            assert mask.get('reason') and config.get('privacyMaskReview', {}).get('reviewedBy'), 'Privacy masks require an explicit source-frame review'
            assert all(math.isfinite(v) for v in rect) and 0 <= rect[0] < rect[2] <= image.width and 0 <= rect[1] < rect[3] <= image.height, 'Privacy masks must stay inside the original native frame'
            assert mask.get('fill', '#101010') == '#101010', 'Privacy masks use one opaque neutral fill'
    group = (frame_review or {}).get('framingGroup') or frame.get('framingGroup') or phase.get('framingGroup') or config.get('framingGroups', {}).get(phase['name']) or ('usage' if rate(phase) == 1 else phase['name'])
    return {'box': box, 'ratio': ratio, 'originX': origin_x, 'originY': origin_y,
            'framingGroup': group, 'geometryProvided': bool(native or pixels),
            **({'privacyMasks': masks} if masks else {}),
            **({'scaleCeiling':float(config['maxScale'])} if 'maxScale' in config else {})}


def ordered_native_frames(capture, config=None):
    """Native events may arrive a few milliseconds out of delivery order."""
    config = config or {}
    frames = capture['frames']
    inversions = [{'previousFile':a['file'],'previousAt':a['at'],'file':b['file'],'at':b['at'],'deltaMs':a['at']-b['at']}
                  for a,b in zip(frames,frames[1:]) if b['at'] < a['at']]
    review = config.get('timestampOrderReview', capture.get('timestampOrderReview',{}))
    assert not any(i['deltaMs']>100 for i in inversions) or (review.get('reviewedBy') and review.get('reason')), 'A native timestamp inversion over100ms requires explicit timestampOrderReview'
    return [f for _,f in sorted(enumerate(frames),key=lambda item:(item[1]['at'],item[0]))], inversions


def aligned_native_phases(capture, frames):
    """Generation must begin on an observed native frame, never a carried Home."""
    phases, audit = [dict(p) for p in capture['phases']], []
    for index, phase in enumerate(phases):
        if 'generation' not in phase.get('category', phase['name']).lower():
            continue
        requested = phase['at']
        frame = next((f for f in frames if f['at'] >= requested), None)
        assert frame, 'Generation boundary requires a native frame at or after its observed time'
        assert index+1 == len(phases) or frame['at'] < phases[index+1]['at'], 'Generation boundary must precede the next phase'
        phase['at'] = frame['at']
        if requested != frame['at']:
            audit.append({'phase':phase['name'],'requestedAt':requested,'nativeAt':frame['at'],'file':frame['file'],
                          'reason':'Start generation on its first observed native frame; do not carry earlier Home pixels across the boundary.'})
    return phases, audit


def native_prompt_insert(capture, source, config):
    """Verify a genuine later native prompt review without changing source time."""
    source=source.resolve()
    requested = config.get('nativePromptInsert')
    if not requested:
        return None
    sidecar = (source / (requested if isinstance(requested,str) else requested['sidecar'])).resolve()
    assert within(sidecar,source) and sidecar.exists(),'Native prompt insert sidecar must exist inside its source capture'
    data = read(sidecar)
    file = (source/data['file']).resolve()
    assert within(file,source) and file.exists(),'Native prompt insert pixels must exist inside the capture'
    assert digest(file)==data['sha256'],'Native prompt insert pixel hash mismatch'
    assert data['ownerResponseId']==capture.get('ownerResponseId',capture.get('responseId')),'Native prompt insert must show the exact recorded owner response'
    assert data['ownerConversationUrl']==capture.get('ownerConversationUrl',capture.get('conversationUrl')),'Native prompt insert must show the exact owner conversation'
    assert data['promptSha256']==hashlib.sha256(capture['prompt'].encode()).hexdigest(),'Native prompt insert prompt text must match exactly'
    assert data.get('completePromptVisible') is True,'Native prompt insert requires reviewed complete prompt visibility'
    assert data.get('method') in ['Page.captureScreenshot','Page.screencastFrame','native-browser-screenshot'],'Native prompt insert must identify its native capture method'
    observed = datetime.fromisoformat(data['capturedAt'].replace('Z','+00:00'))
    assert observed>=datetime.fromisoformat(capture['startedAt'].replace('Z','+00:00')),'Keep the actual later prompt-review capture timestamp'
    with Image.open(file) as pixels:
        dimensions={'width':pixels.width,'height':pixels.height}
    return {**data,**dimensions,'file':str(file.relative_to(source)),'sidecar':str(sidecar.relative_to(source)),
            'sidecarSha256':digest(sidecar),'editorialPlacement':'Two-second native sent-prompt review after original Send and before generation; actual later capture timestamp retained.'}


def native_read_holds(capture, source, config):
    """Editorial reading holds repeat an exact observed frame at its own time."""
    holds=[]
    for requested in config.get('nativeHolds',capture.get('nativeHolds',[])):
        frame=next((f for f in capture['frames'] if f['file']==requested['file'] and f['at']==requested['sourceAt']),None)
        assert frame,'Native read hold must identify an exact existing source frame and timestamp'
        file=(source/frame['file']).resolve()
        assert within(file,source) and file.exists()
        assert isinstance(requested.get('seconds'),(int,float)) and math.isfinite(requested['seconds']) and requested['seconds']>0,'Native read hold requires a positive duration'
        assert requested.get('reason','').strip(),'Native read hold requires its editorial reason'
        actual=digest(file)
        assert not requested.get('sha256') or requested['sha256']==actual,'Native read hold source hash mismatch'
        assert not any(h['sourceAt']==frame['at'] for h in holds),'Use one native read hold per observed source position'
        holds.append({**requested,'sha256':actual,'sourceFrameTimestamp':frame.get('timestamp'),
                      'caption':requested.get('caption','Read the observed result.')})
    return sorted(holds,key=lambda h:h['sourceAt'])


def native_source_read_inserts(capture, source, config):
    """Later real source-page reads, with honest capture time and native origin."""
    inserts=[]
    for requested in config.get('nativeReadInserts',[]):
        sidecar=(source/(requested if isinstance(requested,str) else requested['sidecar'])).resolve()
        assert within(sidecar,source) and sidecar.exists()
        data=read(sidecar);file=(source/data['file']).resolve()
        assert within(file,source) and file.exists() and digest(file)==data['sha256'],'Native read insert pixels must match their actual file'
        assert data['parentCaptureKey']==capture['key'],'Native source read belongs to another parent capture'
        trigger=data['triggerAction']
        assert any(a['at']==trigger['at'] and a['label']==trigger['label'] for a in capture.get('actions',[])),'Native source read requires its actual source-opening action'
        assert data['sourceAt']>=trigger['at'] and any(f['at']==data['sourceAt'] for f in capture['frames']),'Place the source read at an actual retained native parent frame after its recorded Open action'
        assert isinstance(data['seconds'],(float,int)) and 0<data['seconds']<=15
        origin=(ROOT/data['origin']['capturePath']).resolve()
        assert within(origin,source.parent) and digest(origin/'capture.json')==data['origin']['captureSha256'],'Native source read must bind its original staged capture'
        original=read(origin/'capture.json')
        frame=next((f for f in original['frames'] if f['file']==data['origin']['file'] and f['at']==data['origin']['sourceAt']),None)
        assert original.get('complete') and frame and digest(origin/frame['file'])==data['sha256'],'Native read insert is not the exact observed original source frame'
        assert original.get('conversationUrl')==data['sourceUrl'] and original.get('evidence',{}).get('parentCaptureKey')==capture['key'],'Native source URL or parent provenance mismatch'
        if data.get('resultSha256'):
            exported=Path(capture.get('evidence',{}).get('resultExport',{}).get('file','')).resolve()
            assert within(exported,source.parent.parent) and exported.exists() and digest(exported)==data['resultSha256'],'Native result-read insert must match the exact copied parent result'
            assert original.get('evidence',{}).get('resultSha256')==data['resultSha256'],'Supplemental native result view must preserve its verified output identity'
        actual=datetime.fromtimestamp(frame['timestamp'],tz=timezone.utc)
        observed=datetime.fromisoformat(data['capturedAt'].replace('Z','+00:00'))
        assert abs((observed-actual).total_seconds())<.001,'Keep the actual original native capture timestamp'
        with Image.open(file) as pixels:
            dimensions={'width':pixels.width,'height':pixels.height}
        viewport=data['sourceViewport'];metadata=frame.get('metadata',{})
        assert viewport['width']==metadata.get('deviceWidth') and viewport['height']==metadata.get('deviceHeight'),'Use the actual original native viewport, not the parent default'
        assert math.isclose(dimensions['width']/viewport['width'],dimensions['height']/viewport['height'],abs_tol=.01) and math.isclose(dimensions['width']/viewport['width'],viewport['deviceScaleFactor'],abs_tol=.01),'Original source native dimensions/scale are inconsistent'
        inserts.append({**data,**dimensions,'sidecar':str(sidecar.relative_to(source)),'sidecarSha256':digest(sidecar),
                        'editorialPlacement':'Genuine later native source-page reading view after the recorded Open-source action. Original source timestamps and mainline frames are unchanged.'})
    return sorted(inserts,key=lambda i:i['sourceAt'])


def reviewed_recorder_boundary(capture, exclusion):
    """Keep real resumed-window input clocks, only with hash-bound raw proof.

    The last retained native PNG remains on screen until the next actual PNG;
    no new pixels or input times are constructed. Unreviewed retakes still join
    on the first clean screenshot as before.
    """
    proof = exclusion.get('nativeRecorderBoundaryReview')
    if proof is None:
        return False
    quiz = capture.get('key') == 'notebook-quiz-unimib-take1' and capture.get('slideId') == 'S67'
    widget = capture.get('key') == 'widget-flashcard-inline-take1' and capture.get('slideId') == 'S53DETAILFLASHCARD'
    assert quiz or widget, 'Recorder boundary review is qualified only for the reviewed native Quiz or widget reader'
    assert proof.get('schemaVersion') == 1 and proof.get('reviewedBy') and proof.get('reason'), 'Recorder boundary proof requires reviewer and reason'
    assert exclusion.get('reviewedBy') == proof['reviewedBy'], 'Recorder boundary reviewer mismatch'
    path = (ROOT / proof['rawCapturePath']).resolve()
    assert within(path, STAGING) and path.name == 'capture.json' and path.is_file(), 'Recorder boundary raw capture must exist in staging'
    raw_hash = digest(path)
    assert raw_hash == proof.get('rawCaptureSha256'), 'Recorder boundary raw hash mismatch'
    raw = read(path)
    assert raw.get('complete'), 'Recorder boundary requires a completed actual source'
    if quiz:
        assert raw.get('accountDomain') == 'unimib.it' and raw.get('uiLanguage') == 'en', 'Quiz boundary requires the actual institutional source'
    else:
        assert raw_hash == 'cbcce843d96f9865b14ae62152b3abe689cd659a96b08ed77955b8cb0175b80d' and raw.get('key') == 'widget-flashcard-inline-reader-take2', 'Widget boundary requires the exact approved native reader'
        assert proof.get('kind') == 'closed-recorder-gap' and proof.get('beforeWindowId') == 4 and proof.get('afterWindowId') == 5, 'Only the actual pre-wheel widget recorder gap is qualified'
    refs = [capture.get('immutableRawSource', {}), capture.get('evidence', {}).get('nativeNotebookAppReader', {})]
    if widget:
        refs.extend(r.get('origin', {}) for r in capture.get('nativeUsageRetakes', []) if r.get('kind') == 'native-inline-widget-reader')
    assert any((ROOT / ref.get('directory', ref.get('capturePath', '.')) / 'capture.json').resolve() == path and ref.get('captureSha256') == raw_hash for ref in refs), 'Recorder boundary raw source is not bound to this composition'
    windows = raw.get('recordingWindows', [])
    offset = proof.get('sourceOffsetMs')
    assert isinstance(offset, (int, float)) and math.isfinite(offset), 'Recorder boundary source offset missing'

    def window(window_id):
        matches = [w for w in windows if w['id'] == window_id]
        assert len(matches) == 1 and isinstance(matches[0].get('end'), (int, float)), 'Recorder boundary requires a closed actual window'
        found = matches[0]
        composed = [w for w in capture.get('recordingWindows', []) if w['start'] == found['start'] + offset and w.get('end') == found['end'] + offset]
        assert len(composed) == 1, 'Recorder boundary offset differs from the composed window'
        origin = composed[0].get('nativeRetakeOrigin')
        if origin:
            assert origin.get('captureSha256') == raw_hash and origin.get('windowId') == window_id, 'Recorder boundary child window identity mismatch'
        else:
            assert offset == 0 and raw_hash == capture.get('immutableRawSource', {}).get('captureSha256'), 'Recorder boundary parent identity mismatch'
        return found

    if proof.get('kind') == 'closed-recorder-gap':
        before, after = window(proof.get('beforeWindowId')), window(proof.get('afterWindowId'))
        assert windows.index(after) == windows.index(before) + 1, 'Recorder boundary gap must join consecutive raw windows'
        assert exclusion['start'] == before['end'] + offset and exclusion['end'] == after['start'] + offset, 'Recorder boundary does not equal the actual closed gap'
    elif proof.get('kind') == 'failed-technical-window':
        failed = window(proof.get('windowId'))
        assert exclusion['start'] == failed['start'] + offset and exclusion['end'] == failed['end'] + offset, 'Recorder boundary retake must exclude the entire actual window'
        actual = [{k: step[k] for k in ('requestedStartAt', 'recordingWindowId', 'failure')} for step in raw.get('stepTimings', []) if step.get('recordingWindowId') == failed['id'] and step.get('failure')]
        assert actual and actual == proof.get('failures'), 'Recorder boundary technical failure proof mismatch'
        assert raw.get('key') == 'notebook-quiz-unimib-reader-take1' and failed['id'] in (3, 4), 'Only reviewed no-op/detached-scroll Quiz retakes are qualified'
        assert proof.get('nativeStateUnchangedReviewed') is True, 'Technical window needs explicit unchanged native state review'
    else:
        raise AssertionError('Unqualified recorder boundary kind')
    return True


def retake_exclusions(capture, config):
    """Retakes require explicit reasons and retain a record of every omitted action."""
    ranges = config.get('excludedRanges', capture.get('excludedRanges', []))
    requested = []
    for r in ranges:
        assert isinstance(r, dict) and isinstance(r.get('reason'), str) and r['reason'].strip(), 'Excluded retakes require an explicit reason'
        assert 0 <= r['start'] < r['end'] <= capture['durationMs'], 'Excluded retake times are outside the capture'
        requested.append({**r, 'reason': r['reason'].strip()})
    requested.sort(key=lambda r: r['start'])
    is_excluded = lambda at: any(r['start'] <= at < r['end'] for r in requested)
    good = [f for f in ordered_native_frames(capture,config)[0] if not is_excluded(f['at'])]
    applied = []
    for r in requested:
        # Join at an actually captured clean frame, never replay the discarded
        # take between the requested cut end and the next real screenshot.
        end = r['end'] if reviewed_recorder_boundary(capture, r) else next((f['at'] for f in good if f['at'] >= r['end']), capture['durationMs'])
        applied.append({**r, 'requestedEnd': r['end'], 'end': end})
    return applied


def native_recorder_carries(capture, source, timeline, exclusions):
    """Expose each exact-boundary carry with its original PNG and input clock."""
    output, seen = [], set()
    for r in exclusions:
        if not r.get('nativeRecorderBoundaryReview'):
            continue
        segment = next((s for s in timeline if not s.get('hold') and s['sourceStart'] == r['end']), None)
        if not segment:
            continue
        frame = next(f for f in capture['frames'] if f['file'] == segment['file'])
        if frame['at'] >= segment['sourceStart']:
            continue
        displayed = []
        for candidate in timeline[timeline.index(segment):]:
            if candidate['file'] != frame['file']:
                break
            interval = (candidate['sourceStart'], candidate['sourceEnd'])
            if candidate.get('hold') or interval in seen:
                continue
            seen.add(interval)
            displayed.append(candidate)
        if not displayed:
            continue
        actions = [a for a in capture.get('actions', []) if any(s['sourceStart'] <= a['at'] < s['sourceEnd'] for s in displayed)]
        output.append({'sourceStart': displayed[0]['sourceStart'], 'sourceEnd': displayed[-1]['sourceEnd'],
                       'outputStartSeconds': displayed[0]['start'], 'outputEndSeconds': displayed[-1]['end'],
                       'displayedIntervals': [{'sourceStart': s['sourceStart'], 'sourceEnd': s['sourceEnd'],
                                               'outputStartSeconds': s['start'], 'outputEndSeconds': s['end']} for s in displayed],
                       'nativeFrame': {'file': frame['file'], 'at': frame['at'], 'sha256': digest(source / frame['file'])},
                       'inWindowInputs': [{'sourceAt': a['at'], 'label': a['label'], 'kind': a.get('kind'),
                                          'click': a.get('click'), 'clickSource': a.get('clickSource'),
                                          'targetVisibleText': a.get('nativeFrameHitTest', {}).get('local', {}).get('targetVisibleText')}
                                         for a in actions],
                       'boundaryProof': r['nativeRecorderBoundaryReview'],
                       'policy': 'Hold only the last retained actual native PNG until the next actual source PNG. Original input clocks, native pixels and measured activated controls remain unchanged.'})
    return output


def reviewed_phase_captions(capture, source, config, phases):
    """Qualify editorial header text without changing native timing or pixels."""
    reviews = config.get('reviewedPhaseCaptions', [])
    if not reviews:
        return phases
    assert capture.get('key') == 'notebook-quiz-unimib-take1' and capture.get('slideId') == 'S67', 'Reviewed header override is qualified only for the native Quiz candidate'
    result = [dict(p) for p in phases]
    seen = set()
    allowed = {'native-quiz-feedback', 'native-quiz-explanation', 'native-quiz-correct-answer',
               'native-quiz-token-id', 'native-quiz-probability', 'native-quiz-temperature', 'native-quiz-rag'}
    texts = {'Read the native question and inspect the feedback.',
             'Read the feedback, then continue to the next question.'}
    for review in reviews:
        assert review.get('schemaVersion') == 1 and review.get('reviewedBy') and review.get('reason'), 'Reviewed header requires its reviewer and reason'
        assert review.get('captureSha256') == digest(source / 'capture.json'), 'Reviewed header source hash mismatch'
        identity = (review.get('phaseName'), review.get('sourceAt'))
        assert identity not in seen and identity[0] in allowed, 'Reviewed header phase is unknown or repeated'
        seen.add(identity)
        found = [p for p in result if p['name'] == identity[0] and p['at'] == identity[1]]
        assert len(found) == 1 and found[0].get('nativeRetakeOrigin') and rate(found[0]) == 1, 'Reviewed header must identify one original native-use phase'
        phase = found[0]
        assert review.get('originalCaption') == phase.get('label', phase.get('caption')), 'Reviewed header original text mismatch'
        assert review.get('caption') in texts, 'Reviewed native Quiz header must remain a truthful generic reading instruction'
        phase.pop('label', None)
        phase['caption'] = review['caption']
    return result


def qualify_reviewed_app_crop(capture, source, config):
    """One reviewed native Quiz crop may override its embedded full viewport."""
    config.pop('_qualifiedNativeAppCrop', None)
    review = config.get('reviewedNativeAppCrop')
    if not review:
        return
    assert capture.get('key') == 'notebook-quiz-unimib-take1' and capture.get('slideId') == 'S67', 'Native widget crop is qualified only for this Quiz reader'
    assert review.get('schemaVersion') == 1 and review.get('reviewedBy') and review.get('reason'), 'Native widget crop needs its actual review'
    assert review.get('captureSha256') == digest(source / 'capture.json'), 'Native widget crop capture hash mismatch'
    assert review.get('cropPixels') == [824, 256, 2056, 1706], 'Only the inspected whole central native Quiz body crop is qualified'
    reader = capture.get('evidence', {}).get('nativeNotebookAppReader', {})
    assert reader.get('captureSha256') == review.get('readerCaptureSha256') == 'd5d59f614a15aa5232799ea4406faf3aa2aab6fdca4d467c7bdf21b1d140e508', 'Native widget crop belongs to another raw reader'
    raw = (ROOT / reader.get('capturePath', '') / 'capture.json').resolve()
    assert within(raw, STAGING) and raw.is_file() and digest(raw) == review['readerCaptureSha256'], 'Native widget crop raw reader changed'
    child = read(raw)
    assert child.get('complete') and child.get('slideId') == 'S67' and child.get('sourceViewport') == {'width': 1440, 'height': 900, 'deviceScaleFactor': 2}, 'Native widget crop requires its actual completed viewport'
    assert review.get('allMeaningfulWidgetContentReviewed') is True and review.get('nativePixelsReconstructed') is False, 'Native widget crop requires full meaningful-content review without reconstructed pixels'
    config['_qualifiedNativeAppCrop'] = review


def qualify_reviewed_frame_crops(capture, source, config):
    """Exact native-source crop reviews; never change source pixels or clocks."""
    config.pop('_qualifiedFrameCrops', None)
    review = config.get('reviewedFrameCrops')
    if not review:
        return
    sources = {
        'widget-flashcard-inline-take1': 'cbcce843d96f9865b14ae62152b3abe689cd659a96b08ed77955b8cb0175b80d',
        'notebook-mind-map-unimib-take1': '7d8f3669d3caf9f4676a8514dff4b9d4c6077ebecc3e402f1082cf2ef30eecc5',
        'skills-the-learning-skill-take1': '7ee0c6e915e2ecb411f5971a7fca70ceb91de8ddae0b6d63c6caad1e683ea57c',
    }
    expected = sources.get(capture.get('key'))
    assert expected and review.get('readerCaptureSha256') == expected, 'Frame crop review is limited to these exact completed native recovery readers'
    assert review.get('schemaVersion') == 1 and review.get('reviewedBy') and review.get('reason'), 'Frame crops need an explicit reviewer and content reason'
    assert review.get('captureSha256') == digest(source / 'capture.json'), 'Frame crop source metadata hash mismatch'
    entries = review.get('entries')
    assert isinstance(entries, dict) and entries, 'Frame crop review must identify actual source frames'
    qualified = {}
    for name, entry in entries.items():
        frame = next((f for f in capture['frames'] if f['file'] == name), None)
        assert frame and frame.get('nativeRetakeOrigin', {}).get('captureSha256') == expected, 'Frame crop belongs to another native source'
        assert entry.get('sourceAt') == frame['at'] and entry.get('sourcePixelSha256') == frame['nativeRetakeOrigin'].get('sha256'), 'Frame crop native clock/pixel binding mismatch'
        file = (source / name).resolve()
        assert within(file, source) and file.is_file() and digest(file) == entry['sourcePixelSha256'], 'Frame crop native pixels changed'
        box = rectangle(entry.get('cropPixels', []))
        with Image.open(file) as native:
            assert all(math.isfinite(v) for v in box) and 0 <= box[0] < box[2] <= native.width and 0 <= box[1] < box[3] <= native.height, 'Frame crop must remain inside the exact original native PNG'
        assert isinstance(entry.get('framingGroup'), str) and entry['framingGroup'].strip(), 'Frame crop needs its consistent native camera group'
        qualified[name] = entry
    config['_qualifiedFrameCrops'] = qualified


def build_timeline(capture, source, config, prompt_hold):
    qualify_reviewed_app_crop(capture, source, config)
    qualify_reviewed_frame_crops(capture, source, config)
    exclusions = retake_exclusions(capture, config)
    excluded = lambda at: any(r['start'] <= at < r['end'] for r in exclusions)
    frames = [f for f in ordered_native_frames(capture,config)[0] if not excluded(f['at'])]
    assert len(frames) >= 2 and all(a['at'] <= b['at'] for a,b in zip(frames, frames[1:])), 'Source frame times must be monotonic'
    phases, _ = aligned_native_phases(capture, frames)
    phases = reviewed_phase_captions(capture, source, config, phases)
    assert phases and all(a['at'] < b['at'] for a,b in zip(phases, phases[1:])), 'Phases must be ordered'
    duration = float(capture['durationMs'])
    phases[0]['at'] = min(phases[0]['at'], frames[0]['at'])
    idle = config.get('idleRanges', capture.get('idleRanges', []))
    idle = [dict(r) if isinstance(r, dict) else {'start': r[0], 'end': r[1], 'keepSeconds': .25} for r in idle]
    idle.sort(key=lambda r: r['start'])
    for i, r in enumerate(idle):
        assert 0 <= r['start'] < r['end'] <= duration
        assert i == 0 or idle[i-1]['end'] <= r['start'], 'Idle ranges must not overlap'
        assert not any(r['start'] <= a['at'] < r['end'] and not excluded(a['at']) for a in capture.get('actions', [])), 'Cannot shorten an action as an idle range'
        assert 0 <= r.get('keepSeconds', .25) <= (r['end']-r['start'])/1000
    read_holds=native_read_holds(capture,source,config)
    for hold in read_holds:
        assert not excluded(hold['sourceAt']) and not any(r['start']<=hold['sourceAt']<r['end'] for r in idle),'Native read hold belongs to an excluded or shortened source interval'
    insert = native_prompt_insert(capture,source,config)
    source_reads=native_source_read_inserts(capture,source,config)
    assert all(not excluded(i['sourceAt']) and not any(r['start']<=i['sourceAt']<r['end'] for r in idle) for i in source_reads),'Source reading insert belongs to a shortened interval'
    if insert:
        generation = next((p for p in phases if 'generation' in p.get('category',p['name']).lower()),None)
        send = next((p for p in phases if p['name']=='send'),None)
        assert generation and send and generation['at']>send['at'],'A native sent-prompt review belongs after original Send and before generation'
    prompt_at = generation['at'] if insert else config.get('promptReadyAt', capture.get('promptReadyAt'))
    prompt_time_observed = prompt_at is not None
    if prompt_at is None and capture.get('prompt'):
        prompt_at = next((p['at'] for p in phases if p['name'] == 'send'), None)
    if prompt_at is not None:
        assert frames[0]['at'] <= prompt_at <= duration
        assert not excluded(prompt_at), 'Prompt-ready time belongs to a discarded retake; observe the new complete prompt'
    phase_at = lambda ms: next(p for p in reversed(phases) if p['at'] <= ms)
    native_prompt_read=config.get('nativePromptReading')
    if native_prompt_read:
        a,b=native_prompt_read['start'],native_prompt_read['end']
        frame=next((f for f in frames if f['file']==native_prompt_read['file']),None)
        assert native_prompt_read.get('reviewedBy') and native_prompt_read.get('reason') and frame,'Review the exact complete native prompt frame and interval'
        assert 1900<=b-a<=3500 and frame['at']<=a and a-frame['at']<150 and rate(phase_at(a))==1,'A native prompt read must already show the full prompt at normal speed for about2s'
        assert any(w['start']<=a<b<=w['end'] for w in capture.get('recordingWindows',[])),'Native prompt reading must be inside a real observed recording window'
        assert not any(a<r['end'] and b>r['start'] for r in [*idle,*exclusions]),'Preserve the entire reviewed native prompt interval'
        assert not any(a<=event['at']<b for event in capture.get('actions',[])),'A complete prompt read must not include an intervening input action'
    timeline, elapsed, held, read_held, source_read_held = [], 0., bool(native_prompt_read), set(), set()
    for index, frame in enumerate(frames):
        start = max(float(frame['at']), float(phases[0]['at']))
        end = float(frames[index+1]['at']) if index+1 < len(frames) else duration
        if end <= start:
            continue
        boundaries = {start, end, *[float(p['at']) for p in phases if start < p['at'] < end],
                      *[float(t) for r in idle + exclusions for t in [r['start'], r['end']] if start < t < end]}
        if prompt_at is not None and start < prompt_at < end:
            boundaries.add(float(prompt_at))
        segments = list(zip(sorted(boundaries), sorted(boundaries)[1:]))
        for a,b in segments:
            if excluded(a):
                continue
            if prompt_at is not None and not held and a >= prompt_at:
                prompt_frame_name = config.get('promptFrame', capture.get('promptFrame'))
                if insert:
                    prompt_frame={'file':insert['file'],'viewport':insert.get('sourceViewport') or capture.get('sourceViewport'),
                                  'screenshotClip':insert.get('screenshotClip'),'framingGroup':'native-prompt-insert'}
                    if insert.get('cropPixels'):prompt_frame['cropPixels']=insert['cropPixels']
                elif prompt_frame_name:
                    prompt_frame = next(f for f in frames if f['file'] == prompt_frame_name)
                else:
                    available = [f for f in frames if f['at'] <= prompt_at] if prompt_time_observed else [f for f in frames if f['at'] < prompt_at]
                    assert available, 'Observe a complete prompt frame before Send'
                    prompt_frame = max(available, key=lambda f: f['at'])
                prompt_phase = {'name':'native-prompt-insert'} if insert else next((p for p in reversed(phases) if p['at'] < prompt_at), phase_at(prompt_at))
                timeline.append({'sourceStart': prompt_at, 'sourceEnd': prompt_at, 'start': elapsed, 'end': elapsed+prompt_hold,
                                 'file': prompt_frame['file'], 'phase': 'prompt-hold', 'caption': 'Read the complete sent prompt.' if insert else 'Read the complete prompt.', 'rate': 1,
                                 **({'editorialInsert':True,'actualCapturedAt':insert['capturedAt']} if insert else {}),
                                 'hold': True, **framing(prompt_frame, prompt_phase, capture, config, source)})
                elapsed += prompt_hold
                held = True
            for hold in read_holds:
                if hold['sourceAt']!=a or hold['sourceAt'] in read_held:
                    continue
                held_frame=next(f for f in frames if f['file']==hold['file'] and f['at']==hold['sourceAt'])
                timeline.append({'sourceStart':hold['sourceAt'],'sourceEnd':hold['sourceAt'],'start':elapsed,'end':elapsed+hold['seconds'],
                                 'file':hold['file'],'phase':'native-hold','caption':hold['caption'],'rate':1,'hold':True,
                                 'editorialInsert':True,'reason':hold['reason'],'sourceFrameSha256':hold['sha256'],
                                 'observedFrameTimestamp':hold['sourceFrameTimestamp'],**framing(held_frame,phase_at(a),capture,config,source)})
                elapsed+=hold['seconds']
                read_held.add(hold['sourceAt'])
            for source_read in source_reads:
                if source_read['sourceAt']!=a or source_read['sourceAt'] in source_read_held:
                    continue
                source_frame={'file':source_read['file'],'viewport':source_read['sourceViewport'],'screenshotClip':None,
                              'cropPixels':source_read.get('cropPixels',[0,0,source_read['width'],source_read['height']]),
                              'framingGroup':'native-source-read-'+str(source_read['sourceAt'])}
                timeline.append({'sourceStart':a,'sourceEnd':a,'start':elapsed,'end':elapsed+source_read['seconds'],
                                 'file':source_read['file'],'phase':'native-source-read','caption':source_read['caption'],'rate':1,'hold':True,
                                 'editorialInsert':True,'actualCapturedAt':source_read['capturedAt'],'sourceUrl':source_read['sourceUrl'],
                                 **framing(source_frame,{'name':'native-source-read'},capture,config,source)})
                elapsed+=source_read['seconds'];source_read_held.add(source_read['sourceAt'])
            phase = phase_at(a)
            inactive = next((r for r in idle if r['start'] <= a and b <= r['end']), None)
            seconds = (b-a)/(inactive['end']-inactive['start'])*inactive.get('keepSeconds', .25) if inactive else (b-a)/1000/rate(phase)
            if seconds <= 0:
                continue
            timeline.append({'sourceStart': a, 'sourceEnd': b, 'start': elapsed, 'end': elapsed+seconds,
                             'file': frame['file'], 'phase': phase['name'], 'caption': phase.get('label') or phase.get('caption') or phase['name'].replace('-', ' '),
                             'sourcePhaseAt': phase['at'], 'rate': rate(phase), 'idle': bool(inactive), **framing(frame, phase, capture, config, source)})
            elapsed += seconds
    assert timeline and elapsed > 0
    if prompt_at is not None and not held:
        raise AssertionError('Prompt-ready time is after the last renderable source interval')
    assert len(read_held)==len(read_holds),'A native reading hold has no retained source interval at its observed position'
    assert len(source_read_held)==len(source_reads),'A native source reading insert has no retained parent position'
    # One scale per framing group avoids size jumps when feedback expands.
    scales = {}
    for s in timeline:
        w,h = s['box'][2]-s['box'][0], s['box'][3]-s['box'][1]
        ceiling=s.get('scaleCeiling',1)
        assert math.isfinite(ceiling) and 0<ceiling<=2, 'Editorial native-pixel upscale must be explicit and at most2x'
        fit = min((WIDTH-2*PAD)/w, (HEIGHT-BAR-2*PAD-48)/h, ceiling)
        scales[s['framingGroup']] = min(scales.get(s['framingGroup'], 1), fit)
    for s in timeline:
        s['scale'] = scales[s['framingGroup']]
        s['x'] = (WIDTH-round((s['box'][2]-s['box'][0])*s['scale']))//2
        s['y'] = BAR+PAD
    return timeline, elapsed, phases, exclusions


def warp(timeline, ms):
    for s in timeline:
        if not s.get('hold') and s['sourceStart'] <= ms < s['sourceEnd']:
            return s['start'] + (ms-s['sourceStart'])/(s['sourceEnd']-s['sourceStart'])*(s['end']-s['start'])
    if ms >= timeline[-1]['sourceEnd']:
        return timeline[-1]['end']
    return next((s['start'] for s in timeline if s['sourceStart'] >= ms), timeline[-1]['end'])


def warp_before_editorial_hold(timeline, ms):
    # Content relocation happens before repeating its newly observed frame.
    holds=[s['start'] for s in timeline if s.get('hold') and s['sourceStart']==ms]
    return min(holds) if holds else warp(timeline,ms)


def fit_text(draw, text, chosen_font, width):
    if draw.textlength(text, font=chosen_font) <= width:
        return text
    while text and draw.textlength(text+'…', font=chosen_font) > width:
        text = text[:-1]
    return text.rstrip()+'…'


def limited_click_markers(clicks, timeline):
    def geometry(s):
        return (*s['box'], round(s['scale'],12), s['x'],s['y'],round(s.get('ratio',1),12),s.get('originX',0),s.get('originY',0))
    limited=[]
    for click in clicks:
        source=next(s for s in timeline if not s.get('hold') and s['sourceStart']<=click['sourceAt']<s['sourceEnd'])
        changed=next((s['start'] for s in timeline if s['start']>click['seconds']+1e-7 and geometry(s)!=geometry(source)),timeline[-1]['end'])
        native_limit=click.get('visibleUntilSeconds',timeline[-1]['end'])
        duration=min(.8,max(0,changed-click['seconds']),max(0,native_limit-click['seconds']),timeline[-1]['end']-click['seconds'])
        assert duration>0,f"Real click has no display interval: {click['label']}"
        limited.append({**click,'durationSeconds':round(duration,9),
                        'clippedAtGeometryChange':changed-click['seconds']<.799999,
                        'clippedAtNativeContentChange':native_limit-click['seconds']<.799999})
    return limited


def overlay_click_markers(plain, video, work, clicks, elapsed):
    if not clicks:
        shutil.copyfile(plain,video)
        return
    marker=Image.new('RGBA',(120,120),(0,0,0,0));draw=ImageDraw.Draw(marker)
    draw.ellipse((24,24,96,96),fill=(100,240,217,35),outline=(0,0,0,240),width=10)
    draw.ellipse((24,24,96,96),outline=(100,240,217,255),width=6)
    draw.ellipse((55,55,65,65),fill='white');marker.save(work/'click.png')
    parts=['[0:v]null[base]',f'[1:v]split={len(clicks)}'+''.join(f'[c{i}]' for i in range(len(clicks)))]
    previous='base'
    for i,c in enumerate(clicks):
        t=c['seconds'];duration=c['durationSeconds'];fade_start=min(.35,duration*.45);fade_duration=max(.001,duration-fade_start)
        # A very brief native target cap must remain visible on its valid
        # encoded frame. Fading a brief marker can quantize its valid frames to transparency.
        # Keep its exact start/end and full opacity; never extend past the cap.
        if duration<.15:
            # Keep the static PNG clock aligned to the base for a very short
            # interval. A trimmed secondary stream can hit EOF before framesync
            # selects its sole valid output frame. enable still enforces the
            # exact native interval, so no click is shifted or extended.
            parts.append(f'[c{i}]null[p{i}]')
        else:
            parts.append(f'[c{i}]trim=duration={duration:.9f},setpts=PTS-STARTPTS,fade=t=out:st={fade_start:.9f}:d={fade_duration:.9f}:alpha=1,setpts=PTS+{t}/TB[p{i}]')
        parts.append(f"[{previous}][p{i}]overlay=x={c['x']-60}:y={c['y']-60}:eof_action=pass:repeatlast=0:enable='between(t,{t},{t+duration:.9f})'[v{i}]")
        previous=f'v{i}'
    graph=work/'clicks.ffscript';graph.write_text(';\n'.join(parts)+'\n')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(plain),'-loop','1','-framerate',str(FPS),'-i',str(work/'click.png'),
                    '-filter_complex_script',str(graph),'-map',f'[{previous}]','-t',f'{elapsed:.9f}','-an','-c:v','libx264','-preset','fast',
                    '-crf','14','-pix_fmt','yuv420p','-movflags','+faststart','-threads','4',str(video)],check=True)


def qualify_root_widget_render(capture, source, exclusions):
    if capture.get('key') != 'widget-flashcard-inline-take1':
        return None
    module = ROOT / 'scripts/recordings/native-root-widget-evidence.mjs'
    code = "import fs from 'node:fs';const m=await import(process.argv[1]);const a=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(m.qualifyRootWidgetRenderActions(a)));"
    data = {'capture':capture, 'sourceDirectory':str(source), 'exclusions':exclusions, 'rootDirectory':str(ROOT)}
    return json.loads(subprocess.run(['node','--input-type=module','-e',code,str(module)], input=json.dumps(data),
                                    text=True,capture_output=True,check=True,timeout=20000).stdout)


def qualify_learning_render(capture):
    if capture.get('key') != 'skills-the-learning-skill-take1' or not capture.get('learningOriginalWorkPreviewUse'):
        return None
    module = ROOT / 'scripts/recordings/native-learning-source-evidence.mjs'
    code = "import fs from 'node:fs';const m=await import(process.argv[1]);const a=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify({qualifiedAX:m.qualifyLearningNativeAXRenderActions(a),qualifiedUnmarked:m.qualifyLearningUnmarkedRenderActions(a)}));"
    data = {'capture':capture, 'rootDirectory':str(ROOT)}
    return json.loads(subprocess.run(['node','--input-type=module','-e',code,str(module)], input=json.dumps(data),
                                    text=True,capture_output=True,check=True,timeout=20000).stdout)


def qualify_learning_recorded_operations(capture, source, exclusions):
    if capture.get('key') != 'skills-the-learning-skill-take1' or not capture.get('learningOriginalWorkPreviewUse'):
        return None
    module = ROOT / 'scripts/recordings/native-learning-recorded-operations.mjs'
    code = "import fs from 'node:fs';const m=await import(process.argv[1]);process.stdout.write(JSON.stringify(m.qualifyLearningRecordedOperations(JSON.parse(fs.readFileSync(0,'utf8')))));"
    data = {'capture':capture,'sourceDirectory':str(source),'rootDirectory':str(ROOT),'exclusions':exclusions}
    return json.loads(subprocess.run(['node','--input-type=module','-e',code,str(module)], input=json.dumps(data),
                                    text=True,capture_output=True,check=True,timeout=20000).stdout)


def observed_click_markers(capture, timeline, root_widget_evidence=None, learning_evidence=None):
    clicks=[]
    qualified={}
    root_qualified={q['sourceActionAt']:q for q in (root_widget_evidence or {}).get('qualifications', [])}
    learning_qualified={q['parentSourceAt']:q for q in (learning_evidence or {}).get('qualifiedAX', [])}
    if any(a.get('clickSource')=='documented-browser-locator-click' for a in capture.get('actions',[])):
        module=ROOT/'scripts/recordings/native-app-evidence.mjs'
        code="import fs from 'node:fs';const m=await import(process.argv[1]);process.stdout.write(JSON.stringify(m.qualifyNativeAppRenderActions({capture:JSON.parse(fs.readFileSync(0,'utf8')),rootDirectory:process.argv[2]})));"
        actual=json.loads(subprocess.run(['node','--input-type=module','-e',code,str(module),str(ROOT)],input=json.dumps(capture),text=True,capture_output=True,check=True,timeout=20000).stdout)
        qualified={q['parentSourceAt']:q for q in actual}
    native_ats={f['at'] for f in capture['frames']}
    for action in capture.get('actions',[]):
        if not action.get('click'):
            continue
        at=action['click'].get('at',action['at'])
        s=next((s for s in timeline if not s.get('hold') and s['sourceStart']<=at<s['sourceEnd']),None)
        assert s, f"No source frame at real click: {action['label']}"
        x=s['x']+((action['click']['x']-s['originX'])*s['ratio']-s['box'][0])*s['scale']
        y=s['y']+((action['click']['y']-s['originY'])*s['ratio']-s['box'][1])*s['scale']
        assert PAD<=x<WIDTH-PAD and BAR<=y<HEIGHT-24,f"Real click falls outside native framing: {action['label']}"
        click={'seconds':round(warp(timeline,at),6),'x':round(x),'y':round(y),'label':action['label'],'sourceAt':at}
        root_proof=root_qualified.get(action['at'])
        learning_proof=learning_qualified.get(action['at'])
        if action.get('clickSource')=='native-cua-frame-accessibility-activation':
            assert learning_proof and learning_proof.get('eligible') is True, 'Learning AX centre requires its exact immutable native source qualification'
            click.update(clickSource=action['clickSource'],markerMeaning='activated-control-center',markerScope='native-learning-work-frame',
                         markerDisclosure=learning_proof['disclosure'],nativeInputProfile=learning_proof['profile'],
                         exactDeliveredPointerCoordinatesExposed=False,postControlReflowAllowed=True,
                         staticStatsAnchorVerified=True,frameOwnersAndViewportVerified=True)
        elif root_proof:
            assert root_proof.get('markerEligible') is True and root_proof.get('markerMeaning')=='activated-control-center', 'Root widget marker requires its actual native profile'
            click.update(clickSource=action['clickSource'], markerMeaning=root_proof['markerMeaning'],
                         markerScope='native-root-widget', markerDisclosure=root_proof['disclosure'],
                         exactDeliveredPointerCoordinatesExposed=False, twoFreshDomHitsRetained=True,
                         accessibilityLabelAndSnapshotHashRetained=root_proof['accessibilityLabelAndSnapshotHashRetained'])
        elif action.get('clickSource')=='native-cua-accessibility-click':
            raise AssertionError('Native accessibility control-centre marker requires its narrowly qualified source')
        elif action.get('clickSource')=='documented-browser-locator-click':
            proof=qualified.get(action['at'])
            assert proof,'Only unchanged genuine Apps reader locator input may use a control-centre marker'
            click.update(clickSource=action['clickSource'],markerMeaning='activated-control-center',
                         markerDisclosure=proof['disclosure'],exactDeliveredPointerCoordinatesExposed=False,
                         nativeInputProfile=proof['profile'],firstFullGeometryRetained=proof['firstFullGeometryRetained'],
                         firstGeometryReconstructed=False)
        if action.get('clickSource')=='native-cua-frame-locator-click':
            # An iframe locator exposes the activated control's measured centre,
            # rather than a delivered OS-pointer trace. Keep that distinction in
            # the render audit and require the actual hit/UI-change observations.
            proof=action.get('activatedControlEvidence',{})
            assert action.get('markerMeaning')=='activated-control-center' and action.get('nativeHitTestPassed') is True,'Iframe activation marker needs its explicit truthful meaning and native hit test'
            assert action.get('nativeUiChanged') is True and (proof.get('hitTestBefore') is True or action.get('iframeGeometry',{}).get('innerHitTestPassed') is True),'Iframe activation marker needs observed native control activation'
            click.update(clickSource=action['clickSource'],markerMeaning='activated-control-center',
                         markerDisclosure='Measured centre of the control activated by the native CUA iframe locator; not an OS-pointer trace.',nativeActivationVerified=True)
        until=action.get('markerUntilSourceAt')
        if until is not None:
            assert until>at and until in native_ats,'An explicit marker limit must name a later observed native frame timestamp'
            assert action.get('markerLimitReason','').strip(),'An explicit marker limit requires its reviewed native-content reason'
            click.update(visibleUntilSeconds=warp_before_editorial_hold(timeline,until),markerUntilSourceAt=until,markerLimitReason=action['markerLimitReason'])
        clicks.append(click)
    return limited_click_markers(clicks,timeline)


def omitted_markers(capture, root_widget_evidence=None, learning_evidence=None, learning_recorded_operations=None):
    original=[{'at':a['at'],'label':a['label'],'originalPoint':a['unverifiedPreActionClick'],
             'reason':a.get('clickAudit','Pre-action point is not verified as the actual final pointer position.')}
            for a in capture.get('actions',[]) if a.get('unverifiedPreActionClick')]
    kept={a['at']:a for a in capture.get('actions',[])}
    return original + [{'at':q['sourceActionAt'],'label':q['label'],'clickSource':q['clickSource'],
                        'reason':q['omissionReason'],'coordinateFreeMarkerInvented':False}
                       for q in (root_widget_evidence or {}).get('qualifications', []) if q.get('markerEligible') is False] + [
                        {'at':q['parentSourceAt'],'label':kept[q['parentSourceAt']]['label'],
                         'reason':q['disclosure'],'discardedSourceMarker':kept[q['parentSourceAt']]['discardedSourceMarker'],
                         'coordinateFreeMarkerInvented':False}
                        for q in (learning_evidence or {}).get('qualifiedUnmarked', []) if q['parentSourceAt'] in kept] + [
                        {'at':q['parentSourceAt'],'label':kept[q['parentSourceAt']]['label'],
                         'reason':q['disclosure'],'rawKindPreserved':True,'coordinateFreeMarkerInvented':False}
                        for q in (learning_recorded_operations or {}).get('qualifications', []) if q['parentSourceAt'] in kept]


def encode(source, capture, output, timeline, elapsed, service, root_widget_evidence=None, learning_evidence=None):
    work = output/'encode'
    work.mkdir(exist_ok=True)
    listing = ['ffconcat version 1.0']
    fnt, bold = font(25), font(27, True)
    cache, first, frames_used = {}, None, set()
    for s in timeline:
        identity = (s['file'], s['phase'], tuple(s['box']), s['scale'], s['caption'], s['rate'], json.dumps(s.get('privacyMasks', []), sort_keys=True))
        if identity not in cache:
            target = work/f'{len(cache):06}.png'
            with Image.open(source/s['file']) as image:
                native = image.convert('RGB')
                if s.get('privacyMasks'):
                    privacy_draw = ImageDraw.Draw(native)
                    for mask in s['privacyMasks']:
                        x0, y0, x1, y1 = [round(v) for v in rectangle(mask['box'])]
                        privacy_draw.rectangle((x0, y0, x1-1, y1-1), fill=mask.get('fill', '#101010'))
                crop = native.crop(s['box'])
                crop = crop.resize((round(crop.width*s['scale']), round(crop.height*s['scale'])), Image.Resampling.LANCZOS)
                canvas = Image.new('RGB', (WIDTH,HEIGHT), '#0d0d0d')
                canvas.paste(crop, (s['x'],s['y']))
                draw = ImageDraw.Draw(canvas)
                draw.rectangle((0,0,WIDTH,BAR-1), fill='#19191b')
                draw.text((24,13), service, font=bold, fill='white')
                label_x = int(draw.textlength(service,font=bold))+56
                label = s['caption'] + (f" ({s['rate']}×)" if s['rate'] != 1 else '')
                draw.text((label_x,14), fit_text(draw,label,fnt,WIDTH-label_x-24), font=fnt, fill='#78dccb')
                canvas.save(target)
            cache[identity] = target
        target = cache[identity]
        if first is None:
            first = target
        frames_used.add(s['file'])
        listing.extend([f"file '{target.as_posix()}'", 'option framerate 1000', f"duration {s['end']-s['start']:.9f}"])
    listing.extend([f"file '{target.as_posix()}'", 'option framerate 1000'])
    concat = work/'frames.ffconcat'
    concat.write_text('\n'.join(listing)+'\n')
    plain = work/'without-markers.mp4'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-t',f'{elapsed:.9f}',
                    '-vf',f'fps={FPS}','-an','-c:v','libx264','-preset','fast','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart','-threads','4',str(plain)],check=True)
    clicks=observed_click_markers(capture,timeline,root_widget_evidence,learning_evidence)
    overlay_click_markers(plain,output/'video.rendering.mp4',work,clicks,elapsed)
    with Image.open(first) as poster:
        poster.save(output/'poster.jpg',quality=97,subsampling=0)
    return clicks,frames_used


def authentic_native_drag(action, capture):
    """Accept verified native pointer movement without inventing a click point."""
    finite = lambda value: type(value) in (int, float) and math.isfinite(value)
    if (action.get('kind') != 'drag' or action.get('nativeHitTestPassed') is not True
            or action.get('inputSource') != 'native-cdp-mouse-input' or action.get('click') is not None):
        return False
    viewport = capture.get('sourceViewport') or {}
    width, height = viewport.get('width'), viewport.get('height')
    if not all(finite(v) and v > 0 for v in [width, height]):
        return False
    for point in [action.get('from'), action.get('to')]:
        if not isinstance(point, dict):
            return False
        x, y = point.get('x'), point.get('y')
        if not (finite(x) and finite(y) and 0 <= x < width and 0 <= y < height):
            return False
    start, end = action.get('at'), action.get('actualActionEndAt')
    if not (finite(start) and finite(end) and 0 <= start < end):
        return False
    step_end = action.get('stepEndedAt')
    if step_end is not None and not (finite(step_end) and end <= step_end):
        return False
    duration = capture.get('durationMs')
    if duration is not None and not (finite(duration) and end <= duration):
        return False
    return action['from'] != action['to']


def derive_production_checks(capture, inventory, fixture, service, clicks, render_capture, prompt_insert=None, exclusions=(), root_widget_evidence=None, learning_evidence=None, learning_recorded_operations=None):
    qualified_unmarked={q['sourceActionAt'] for q in (root_widget_evidence or {}).get('qualifications', []) if q.get('markerEligible') is False}
    qualified_unmarked.update(q['parentSourceAt'] for q in (learning_evidence or {}).get('qualifiedUnmarked', []) if q.get('eligibleUnmarked') is True)
    qualified_unmarked.update(q['parentSourceAt'] for q in (learning_recorded_operations or {}).get('qualifications', []) if q.get('eligibleUnmarked') is True)
    production_checks={
        'freshCapture':not fixture and datetime.fromisoformat(capture['startedAt'].replace('Z','+00:00'))>=datetime.fromisoformat(inventory['createdAt'].replace('Z','+00:00')),
        'bookMatches':capture.get('book',{}).get('sha256')==inventory['sourceBook']['sha256'],
        'realClickCoordinates':len(clicks)>0 and all(
            authentic_native_drag(a, capture) if a.get('kind') == 'drag'
            else a.get('click') or a.get('kind') in ['keyboard','scroll','input'] or a.get('at') in qualified_unmarked
            for a in render_capture.get('actions',[])),
        'noUnexcludedCaptureFailures':not any(not any(r['start']<=f['at']<r['end'] for r in exclusions) for f in capture.get('failures',[])),
        'sourceAllowedForProduction':capture.get('productionEligible') is not False and capture.get('purpose')!='sharing-feasibility-only',
    }
    if service=='ChatGPT':
        production_checks.update(newEmptyChat=capture.get('newChat') is True and capture.get('initialMessageCount')==0,
                                 persistentChat=capture.get('temporaryChat') is False,
                                 completePromptVisible=capture.get('completePromptVerified') is True or bool(prompt_insert),
                                 historyHidden=any(capture.get(k) is True for k in ['historyHidden','sidebarHidden','noPreviousConversations']))
    return production_checks


def attach_work_ui_identity(record, capture):
    identity=capture.get('observedWorkUiIdentity')
    if not identity:
        return
    assert record['key'] in {'skills-learn','skills-the-learning-skill','skills-markdown-mermaid-writing','skills-flashcard-generator'},'Work UI identity is limited to the approved nonwidget skills'
    assert capture.get('hostMode')=='Work' and not capture.get('ownerResponseId') and not capture.get('responseId'),'Native Work UI keys must not be relabelled as backend response IDs'
    assert identity.get('method')=='native-work-completed-assistant-ui'
    record['observedWorkUiIdentity']=identity
    record['capture']['ownerIdentityMethod']=identity['method']
    record['capture']['ownerVisibleTextSha256']=identity['visibleTextSha256']


def render(args):
    run=args.run.resolve();source=args.capture.resolve();output=(run/args.key).resolve()
    assert within(run,STAGING) and within(output,run) and output!=run,'All render outputs must be inside the selected staging run'
    assert source.is_dir() and (source/'capture.json').exists()
    assert args.fixture or within(source,run),'Old/external captures are permitted only with --fixture'
    inventory=read(run/'inventory.json');item=next((i for i in inventory['items'] if i['key']==args.key),None)
    assert item or args.fixture,'Unknown production clip key'
    capture=read(source/'capture.json');assert capture.get('complete') and not capture.get('truncated'),'Finish a complete untruncated native recording first'
    config=read(args.framing) if args.framing else {}
    prompt_insert=native_prompt_insert(capture,source,config)
    read_holds=native_read_holds(capture,source,config)
    source_reads=native_source_read_inserts(capture,source,config)
    output.mkdir(parents=True,exist_ok=True)
    timeline,elapsed,phases,exclusions=build_timeline(capture,source,config,2)
    recorder_carries=native_recorder_carries(capture,source,timeline,exclusions)
    root_widget_evidence=qualify_root_widget_render(capture,source,exclusions)
    learning_evidence=qualify_learning_render(capture)
    learning_recorded_operations=qualify_learning_recorded_operations(capture,source,exclusions)
    excluded=lambda at:any(r['start']<=at<r['end'] for r in exclusions)
    omitted_actions=[a for a in capture.get('actions',[]) if excluded(a['at'])]
    render_capture={**capture,'actions':[a for a in capture.get('actions',[]) if not excluded(a['at'])]}
    service=(item or {}).get('service') or capture.get('service') or 'Browser'
    progress=output/'.rendering.json'
    claim_render_progress(progress,{'key':args.key,'operation':'native staged render','captureSha256':digest(source/'capture.json'),'publication':'blocked until render and QA complete'})
    clicks,used=encode(source,render_capture,output,timeline,elapsed,service,root_widget_evidence,learning_evidence)
    candidate=output/'video.rendering.mp4'
    actual=probe(candidate)
    assert actual['width']==WIDTH and actual['height']==HEIGHT and actual['fps']==FPS
    assert abs(actual['durationSeconds']-elapsed)<=.15,'Encoded timing differs materially from the reviewed timeline'
    candidate.replace(output/'video.mp4')
    # Each cue describes the native phase, or the latest action in that phase.
    boundaries={0.,actual['durationSeconds'],*[s['start'] for s in timeline if 0<=s['start']<actual['durationSeconds']],*[c['seconds'] for c in clicks if 0<=c['seconds']<actual['durationSeconds']]}
    cues=[]
    for a,b in zip(sorted(boundaries),sorted(boundaries)[1:]):
        s=next((s for s in timeline if s['start']<=a<s['end']),timeline[-1])
        label=s['caption']
        if s['rate']==1 and not s.get('hold'):
            action=next((c for c in reversed(clicks) if c['seconds']<=a and c['sourceAt']>=s['sourcePhaseAt']),None)
            if action:label=action['label']
        if s['rate']!=1:label+=f" ({s['rate']}× speed)"
        if cues and cues[-1][2]==label and abs(cues[-1][1]-a)<1e-6:cues[-1]=(cues[-1][0],b,label)
        else:cues.append((a,b,label))
    # Native phase boundaries can differ by less than1ms. Omit a cue when its
    # actual serialized timestamps coincide; never invent a reading duration.
    cues=[(a,b,label) for a,b,label in cues if round(b*1000)>round(a*1000)]
    (output/'captions.en.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n{label}' for a,b,label in cues)+'\n')
    transcript=f"{service} — {capture.get('command',capture['key'])}\n\nREQUEST\n{capture.get('prompt','')}\n\nMETHOD\nNative browser pixels. Setup and input 3×; generation 4×; use and feedback normal speed. Only explicitly annotated idle ranges shortened. Two-second hold on the complete native prompt. Recorded click positions receive a brief ring.\n\n"
    transcript+='\n'.join(f'{stamp(a)} {label}' for a,b,label in cues)
    if any(c.get('clickSource')=='documented-browser-locator-click' and c.get('markerScope')!='native-root-widget' for c in clicks):
        transcript+='\nNATIVE APPS ACTIVATION MARKERS\nSome markers identify the measured centre of a native iframe control activated through the documented locator. Exact delivered pointer coordinates are not exposed; these are not CDP pointer traces. The source retains its actual hit tests and input-request clocks.\n'
    if root_widget_evidence:
        transcript+='\nNATIVE ROOT WIDGET ACTIVATION MARKERS\nSome markers identify the measured centre of the actual root-document control activated through native accessibility or a documented locator. Exact delivered pointer coordinates are not exposed. Two actual prompt activations retain no geometry and receive no invented marker. Native CDP actions retain their separate actual pointer profile.\n'
    if learning_evidence:
        transcript+='\nNATIVE LEARNING ACTIVATION MARKERS\nThe qualified markers show measured PRE-input centres of actual native accessibility-activated controls. Delivered pointer coordinates are not exposed. Stable stats-anchor, viewport and frame-owner evidence is retained; each marker ends at its actual post-input frame before controls can reflow. An earlier auto-scrolled centre remains discarded source evidence, never an invented pointer trace.\n'
    evidence=capture.get('evidence',{})
    transcript+='\n\nOBSERVED RESULT\n'+evidence.get('summary',evidence.get('observed',evidence.get('interactionSummary','')))+'\n'+evidence.get('text','')+'\n'
    if prompt_insert:
        transcript+='\nNATIVE EDITORIAL INSERT\nThe complete sent prompt is shown in a later native review of the exact same conversation and owner response. Mainline source frames and their times are unchanged.\n'
        transcript+=f"Actual capture: {prompt_insert['capturedAt']}\nOwner response: {prompt_insert['ownerResponseId']}\nNative pixels SHA-256: {prompt_insert['sha256']}\nExact prompt SHA-256: {prompt_insert['promptSha256']}\n"
    if read_holds:
        transcript+='\nNATIVE EDITORIAL READING HOLDS\n'
        for hold in read_holds:
            transcript+=f"{hold['seconds']}s on observed frame {hold['file']} at {hold['sourceAt']}ms; SHA-256 {hold['sha256']}. {hold['reason']}\n"
    if source_reads:
        transcript+='\nNATIVE ORIGINAL-SOURCE READING INSERTS\n'
        for source_read in source_reads:
            transcript+=f"{source_read['seconds']}s reading {source_read['sourceUrl']} after the recorded trigger action ({source_read['triggerAction']['label']}). Actual original capture: {source_read['capturedAt']}; SHA-256 {source_read['sha256']}. Later native pixels are an explicit editorial insert, not backdated source frames.\n"
    if capture.get('observedWorkUiIdentity'):
        identity=capture['observedWorkUiIdentity']
        transcript+='\nNATIVE WORK RESULT PROVENANCE\nActual completed assistant wrapper, ChatGPT said heading and exact rendered-text SHA-256 are bound to a recorded native PNG. UI search/render keys are not canonical backend response IDs.\n'
        transcript+=f"Actual owner URL: {identity.get('ownerConversationUrl')}\nRendered assistant text SHA-256: {identity.get('visibleTextSha256')}\n"
    (output/'transcript.txt').write_text(transcript)
    production_checks=derive_production_checks(capture,inventory,args.fixture,service,clicks,render_capture,prompt_insert,exclusions,root_widget_evidence,learning_evidence,learning_recorded_operations)
    files={name:{'path':file,'sha256':digest(output/file)} for name,file in [('video','video.mp4'),('poster','poster.jpg'),('captions','captions.en.vtt'),('transcript','transcript.txt')]}
    record={'schemaVersion':1,'key':args.key,'fixture':args.fixture,'productionEligible':not args.fixture and all(production_checks.values()),
            **actual,'plannedDurationSeconds':elapsed,'capture':{'path':str(source.relative_to(ROOT)) if within(source,ROOT) else str(source),'sha256':digest(source/'capture.json'),'startedAt':capture['startedAt'],'sourceFrames':len(capture['frames']),'usedFrames':len(used),
            'ownerConversationUrl':capture.get('ownerConversationUrl',capture.get('conversationUrl')),'ownerResponseId':capture.get('ownerResponseId',capture.get('responseId'))},
            'productionChecks':production_checks,'files':files,'clicks':clicks,'rates':{'setup':3,'generation':4,'usage':1},'promptHoldSeconds':2,
            'phaseTimings':[{'name':p['name'],'sourceAt':p['at'],'seconds':warp(timeline,p['at']),'rate':rate(p)} for p in phases],
            'promptHoldSourceFrame':next((s['file'] for s in timeline if s['phase']=='prompt-hold'),config.get('nativePromptReading',{}).get('file')),
            **({'nativePromptReading':{**config['nativePromptReading'],'sha256':digest(source/config['nativePromptReading']['file']),
                                       'policy':'Complete prompt already held at normal speed for about2s inside a real recording window; do not add a duplicate editorial hold.'}} if config.get('nativePromptReading') else {}),
            'nativePromptInsert':prompt_insert,
            'nativeHolds':read_holds,
            **({'privacyMaskReview':config['privacyMaskReview'], 'framePrivacyMasks':config['framePrivacyMasks']} if config.get('framePrivacyMasks') else {}),
            **({'nativeReadInserts':source_reads} if source_reads else {}),
            **({'nativeUsageRetakes':capture['nativeUsageRetakes']} if capture.get('nativeUsageRetakes') else {}),
            'excludedRanges':exclusions,'excludedActions':[{k:v for k,v in a.items() if k!='state'} for a in omitted_actions],
            **({'nativeRecorderCarries':recorder_carries} if recorder_carries else {}),
            **({'reviewedPhaseCaptions':config['reviewedPhaseCaptions']} if config.get('reviewedPhaseCaptions') else {}),
            **({'reviewedNativeAppCrop':config['reviewedNativeAppCrop']} if config.get('reviewedNativeAppCrop') else {}),
            **({'reviewedFrameCrops':config['reviewedFrameCrops']} if config.get('reviewedFrameCrops') else {}),
            **({'nativeRootWidgetEvidence':root_widget_evidence} if root_widget_evidence else {}),
            **({'nativeLearningInputEvidence':learning_evidence} if learning_evidence else {}),
            **({'nativeLearningRecordedOperationsEvidence':learning_recorded_operations} if learning_recorded_operations else {}),
            'nativeTimestampOrdering':{'method':'stable-sort by recorded native timestamp; raw capture untouched','inversions':ordered_native_frames(capture,config)[1]},
            'nativePhaseAlignment':aligned_native_phases(capture,[f for f in ordered_native_frames(capture,config)[0] if not excluded(f['at'])])[1],
            'omittedClickMarkers':omitted_markers(render_capture,root_widget_evidence,learning_evidence,learning_recorded_operations),
            'sourcePixels':[{'file':file,'sha256':digest(source/file)} for file in sorted(used)],
            'geometryProvidedForAllUseFrames':all(s['geometryProvided'] for s in timeline if s['rate']==1 and not s.get('hold')),
            'clickMarkerPolicy':'Up to0.8s, ending before the next framing geometry change or explicitly reviewed native content relocation',
            'publication':'staged-only; QA and result-link verification still required'}
    attach_work_ui_identity(record,capture)
    write(output/'timeline.json',timeline);write(output/'render.json',record)
    progress.unlink()
    print(json.dumps({'key':args.key,**actual,'fixture':args.fixture,'productionEligible':record['productionEligible'],'productionChecks':production_checks,'clicks':len(clicks),'output':str(output.relative_to(ROOT))}),flush=True)


def refresh_overlay(args):
    run=args.run.resolve();output=(run/args.key).resolve()
    assert within(run,STAGING) and within(output,run) and output!=run
    record=read(output/'render.json');timeline=read(output/'timeline.json');work=output/'encode'
    plain=work/'without-markers.mp4';assert plain.exists(),'Original marker-free staged encode is required'
    source=(ROOT/record['capture']['path']).resolve()
    capture=None
    if args.capture:
        assert args.capture.resolve()==source and within(source,run),'Overlay annotation review must use its original staged source'
        capture=read(source/'capture.json');config=read(args.framing) if args.framing else {}
        rebuilt,elapsed,_,exclusions=build_timeline(capture,source,config,record['promptHoldSeconds'])
        assert rebuilt==timeline,'Source/framing timing changed: a full render is required'
        assert all(digest(source/f['file'])==f['sha256'] for f in record['sourcePixels']),'Native source pixels changed: a full render is required'
        original_owner=record['capture'].get('ownerResponseId')
        assert not original_owner or original_owner==capture.get('ownerResponseId',capture.get('responseId')),'Result owner cannot change in an overlay refresh'
        is_excluded=lambda at:any(r['start']<=at<r['end'] for r in exclusions)
        retained={**capture,'actions':[a for a in capture.get('actions',[]) if not is_excluded(a['at'])]}
        root_widget_evidence=qualify_root_widget_render(capture,source,exclusions)
        learning_evidence=qualify_learning_render(capture)
        learning_recorded_operations=qualify_learning_recorded_operations(capture,source,exclusions)
        clicks=observed_click_markers(retained,timeline,root_widget_evidence,learning_evidence)
        record['omittedClickMarkers']=omitted_markers(retained,root_widget_evidence,learning_evidence,learning_recorded_operations)
        if root_widget_evidence:record['nativeRootWidgetEvidence']=root_widget_evidence
        if learning_evidence:record['nativeLearningInputEvidence']=learning_evidence
        if learning_recorded_operations:record['nativeLearningRecordedOperationsEvidence']=learning_recorded_operations
        record['capture']['sha256']=digest(source/'capture.json')
        record['overlayAnnotationReview']={'sourceTimingAndPixelsUnchanged':True,'captureSha256':record['capture']['sha256']}
        inventory=read(run/'inventory.json');item=next(i for i in inventory['items'] if i['key']==args.key)
        record['productionChecks']=derive_production_checks(capture,inventory,record['fixture'],item['service'],clicks,retained,record.get('nativePromptInsert'),exclusions,root_widget_evidence,learning_evidence,learning_recorded_operations)
        record['productionEligible']=not record['fixture'] and all(record['productionChecks'].values())
    else:
        clicks=limited_click_markers(record['clicks'],timeline)
    progress=output/'.rendering.json'
    claim_render_progress(progress,{'key':args.key,'operation':'native marker overlay refresh','publication':'blocked until renewed marker QA'})
    destination=output/'video.refreshed.mp4'
    overlay_click_markers(plain,destination,work,clicks,record['durationSeconds'])
    actual=probe(destination);assert actual['width']==WIDTH and actual['height']==HEIGHT and actual['fps']==FPS
    destination.replace(output/'video.mp4')
    record.update(actual,clicks=clicks,clickMarkerPolicy='Up to0.8s, ending before the next framing geometry change or explicitly reviewed native content relocation')
    record['files']['video']['sha256']=digest(output/'video.mp4')
    # Enrich earlier encodes with source identity only if the recorded source hash
    # still matches; no new sharing or source claim is inferred from a URL.
    source_file=source/'capture.json'
    if within(source_file,STAGING) and source_file.exists() and digest(source_file)==record['capture']['sha256']:
        capture=capture or read(source_file)
        record['capture'].update(ownerConversationUrl=capture.get('ownerConversationUrl',capture.get('conversationUrl')),ownerResponseId=capture.get('ownerResponseId',capture.get('responseId')))
    if capture:attach_work_ui_identity(record,capture)
    write(output/'render.json',record)
    qa_file=output/'qa.json'
    if qa_file.exists():
        qa=read(qa_file);qa['accepted']=False;qa.setdefault('checks',{})['clickMarkersVerified']=False
        qa['overlayReviewRequired']=True;write(qa_file,qa)
    progress.unlink()
    print(json.dumps({'key':args.key,'overlayOnly':True,**actual,'clicks':len(clicks),'clippedMarkers':sum(c['clippedAtGeometryChange'] for c in clicks),
                      'nativeContentLimitedMarkers':sum(c.get('clippedAtNativeContentChange',False) for c in clicks)}),flush=True)


def refresh_metadata_only(args):
    run=args.run.resolve();output=(run/args.key).resolve()
    assert within(run,STAGING) and within(output,run) and not (output/'.rendering.json').exists()
    record=read(output/'render.json');source=(ROOT/record['capture']['path']).resolve()
    assert within(source,run) and args.capture and args.capture.resolve()==source,'Use the exact original staged source'
    capture=read(source/'capture.json');config=read(args.framing) if args.framing else {}
    timeline=read(output/'timeline.json');rebuilt,_,_,exclusions=build_timeline(capture,source,config,record['promptHoldSeconds'])
    assert timeline==rebuilt,'Metadata-only refresh cannot change timeline, captions or native framing'
    assert all(digest(source/f['file'])==f['sha256'] for f in record['sourcePixels']),'Native pixels changed'
    assert all(digest(output/f['path'])==f['sha256'] for f in record['files'].values()),'Reviewed output assets changed'
    assert record['capture'].get('ownerResponseId')==capture.get('ownerResponseId',capture.get('responseId')),'Owner response changed'
    retained={**capture,'actions':[a for a in capture.get('actions',[]) if not any(r['start']<=a['at']<r['end'] for r in exclusions)]}
    root_widget_evidence=qualify_root_widget_render(capture,source,exclusions)
    learning_evidence=qualify_learning_render(capture)
    learning_recorded_operations=qualify_learning_recorded_operations(capture,source,exclusions)
    clicks=observed_click_markers(retained,timeline,root_widget_evidence,learning_evidence)
    assert clicks==record['clicks'],'Metadata-only refresh cannot change reviewed click markers'
    inventory=read(run/'inventory.json');item=next(i for i in inventory['items'] if i['key']==args.key)
    record['productionChecks']=derive_production_checks(capture,inventory,record['fixture'],item['service'],clicks,retained,record.get('nativePromptInsert'),exclusions,root_widget_evidence,learning_evidence,learning_recorded_operations)
    if root_widget_evidence:record['nativeRootWidgetEvidence']=root_widget_evidence
    if learning_evidence:record['nativeLearningInputEvidence']=learning_evidence
    if learning_recorded_operations:record['nativeLearningRecordedOperationsEvidence']=learning_recorded_operations
    record['omittedClickMarkers']=omitted_markers(retained,root_widget_evidence,learning_evidence,learning_recorded_operations)
    record['productionEligible']=not record['fixture'] and all(record['productionChecks'].values())
    record['capture']['sha256']=digest(source/'capture.json')
    record['metadataOnlyDerivationReview']={'sourceTimingPixelsMarkersAndAllOutputBytesUnchanged':True,
      'captureSha256':record['capture']['sha256'],'videoSha256':record['files']['video']['sha256'],
      'policy':'Recalculate derived eligibility from reviewed action-kind annotations using the exact normal-render checks; no approval is inferred.'}
    attach_work_ui_identity(record,capture)
    write(output/'render.json',record)
    print(json.dumps({'key':args.key,'metadataOnly':True,'productionEligible':record['productionEligible'],
      'productionChecks':record['productionChecks'],'videoBytesUnchanged':True,'videoSha256':record['files']['video']['sha256']}),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run',type=Path,default=STAGING/'2026-11-07')
    parser.add_argument('--capture',type=Path,help='Directory containing complete capture.json and native PNG frames')
    parser.add_argument('--key',required=True,help='An inventory key; output is always run/key/')
    parser.add_argument('--framing',type=Path,help='Observed phaseBounds/framingGroups/idleRanges/promptReadyAt metadata')
    parser.add_argument('--fixture',action='store_true',help='Test old native captures; output can never pass the production gate')
    parser.add_argument('--metadata-only',action='store_true',help='Recalculate eligibility only after verifying identical timeline, pixels, clicks and output bytes')
    parser.add_argument('--overlay-only',action='store_true',help='Refresh only click overlays from an existing marker-free staged encode; source/timeline unchanged')
    args=parser.parse_args()
    if args.metadata_only:refresh_metadata_only(args)
    elif args.overlay_only:refresh_overlay(args)
    else:
        assert args.capture,'--capture is required for a new render'
        render(args)


if __name__=='__main__':
    main()

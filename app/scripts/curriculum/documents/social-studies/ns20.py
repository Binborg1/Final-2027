# Native Studies 20 (1992). The PDF is a scan with an Acrobat Paper Capture OCR text layer; that
# layer is used as is. Per unit the guide prints "Foundational Objectives", a list of "C.E.L.
# emphasis is placed upon the following foundational objectives:", and per lesson "Learning Objectives:".
import sys, os, re, fitz
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from common import *

CID = 180
doc = fitz.open(pdf_path(CID))
FIRST, LAST = 131, 197          # bookmarks: "Optional Introduction Unit" (131) .. "Evaluation" (198)
units, notes = [], []
unit = None
mode = None
stem = None
lesson = None
cur = None
pages_used = set()


def printed(pg):
    H = pg.rect.height
    for b in pg.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ''.join(s['text'] for s in l['spans']).strip()
            if l['bbox'][1] > H - 60 and re.fullmatch(r'\d{1,3}', t):
                return int(t)
    return None


for pno in range(FIRST - 1, LAST):
    pg = doc[pno]
    H = pg.rect.height
    pp = printed(pg)
    lines = []
    for b in pg.get_text('dict', sort=True)['blocks']:
        for l in b.get('lines', []):
            t = norm(''.join(s['text'] for s in l['spans']))
            if t and not (l['bbox'][1] > H - 60 and re.fullmatch(r'\d{1,3}', t)):
                lines.append({'x': l['bbox'][0], 'y': l['bbox'][1], 't': t})
    for i, l in enumerate(lines):
        t = l['t']
        mu = re.match(r'^(Introduction Unit|Unit (One|Two|Three)\s*:\s*.+?)\s*$', t)
        if mu and i < 3 and l['x'] < 120 and not re.search(r'Table of Contents|Case Studies', t):
            name = mu.group(1)
            if not units or units[-1]['name'] != name:
                unit = {'name': name, 'nameSource': f'page {pno+1}', 'items': []}
                units.append(unit)
            mode = None
            continue
        if re.fullmatch(r'Foundational Objectives:?', t):
            mode, cur, lesson = 'fo', None, None
            stem = None
            continue
        if mode == 'fo' and cur is None and t.endswith(':') and not t.startswith('C.E.L.'):
            stem = t
            continue
        if re.match(r'^C\.E\.L\. emphasis is placed upon the following foundational objectives', t):
            mode, cur = 'cel', None
            continue
        ml = re.fullmatch(r'(Lesson \w+.*)', t)
        if ml and l['x'] < 120 and len(t) < 40:
            lesson = t
            mode, cur = None, None
            continue
        if re.fullmatch(r'Learning Objectives:?', t):
            mode, cur = 'lo', None
            continue
        if mode is None or unit is None:
            continue
        bm = re.match(r'^[•●]\s*(.*)$', t)
        if bm:
            typ = 'learning' if mode == 'lo' else 'foundational'
            cur = {'code': None, 'type': typ, 'lines': [bm.group(1)], 'page': pno + 1, 'printedPage': pp}
            if mode == 'cel':
                cur['group'] = 'C.E.L. emphasis is placed upon the following foundational objectives:'
            if mode == 'fo' and stem:
                cur['stem'] = stem
            if mode == 'lo' and lesson:
                cur['lesson'] = lesson
            unit['items'].append(cur)
            pages_used.add(pno + 1)
            continue
        if cur is not None and l['x'] > 72 and not re.match(r'^[oO0]\s+[A-Z]', t):
            cur['lines'].append(t)
            continue
        # a line back at the left margin ends the list
        mode, cur = None, None
units = [u for i, u in enumerate(units) if u['items'] or not any(v['name'].startswith(u['name']) and v is not u for v in units)]
nsus = 0
for u in units:
    for it in u['items']:
        it['text'] = join_lines(it.pop('lines'))
        if re.search(r'[~]|\b[a-z]+[0-9][a-z]+\b', it['text']):
            it['ocrSuspect'] = True
            nsus += 1
nF = sum(1 for u in units for i in u['items'] if i['type'] == 'foundational')
nL = sum(1 for u in units for i in u['items'] if i['type'] == 'learning')
notes = [
    'Text is the PDF\'s own OCR text layer (Adobe Acrobat 9 Paper Capture, 2010) of a scanned 1992 guide; it was not re-OCRed or corrected. Spot checks read cleanly, but OCR errors are possible.',
    'Foundational objectives come from two lists per unit: "Foundational Objectives" and "C.E.L. emphasis is placed upon the following foundational objectives:" (items from the second list carry "group"). Learning objectives are the "Learning Objectives:" bullets of each lesson ("lesson" gives the lesson heading).',
    'A list is taken to end at the first line back at the left margin that is not a bullet.',
    'The guide marks C.E.L.s in brackets after objectives, e.g. "(PSVS)", "(CCT)", "(C)"; these are kept as printed.',
] + notes + [f'{nsus} items contain characters typical of OCR misreads in the text layer (e.g. "~" for "e") and are marked ocrSuspect; their text is left exactly as the text layer has it.', 'Unit names are as printed in the text layer, including its misreads (e.g. "Developm.ent").']
stem = None
obj = {'curriculumId': CID, 'name': 'Native Studies 20', 'levels': [20],
       'source': {**source(CID), 'pages': sorted(pages_used),
                  'pageNumbering': 'page = 1-based PDF page; printedPage = the number printed on the page'},
       'kind': 'objectives',
       'counts': {'units': len(units), 'foundational': nF, 'learning': nL},
       'units': units, 'notes': notes}
print(write(CID, obj), obj['counts'])
for u in units:
    print(' ', u['name'], sum(1 for i in u['items'] if i['type'] == 'foundational'), sum(1 for i in u['items'] if i['type'] == 'learning'))

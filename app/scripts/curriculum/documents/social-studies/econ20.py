# Economics 20 (1975). Each of the ten units opens with an introduction page: "UNIT ONE: ...",
# "Objectives:" (a sentence), "Content:", "Understandings:" with "A. Primary:" and "B. Secondary:"
# numbered lists printed side by side. The strategy pages that follow are not extracted.
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from common import *
from guide90s import load, npages, make_lines

CID = 183
meta = json.load(open(os.path.join(ROOT, 'out', 'meta.json'), encoding='utf8'))[str(CID)]
NUMW = {'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5, 'SIX': 6, 'SEVEN': 7, 'EIGHT': 8, 'NINE': 9, 'TEN': 10}
units, notes, used, missing = [], [], [], []
course = []
N = npages(CID)
for p in range(1, N + 1):
    d = load(CID, p)
    if d is None or d.get('skipped'):
        continue
    W, H = d['w'], d['h']
    boxes = [b for b in d['lines'] if not re.fullmatch(r'[-–\s]*\d{1,3}[-–\s]*', b[5].strip())]
    lines = make_lines(boxes, W)
    if not lines:
        continue
    m = re.match(r'^UNIT\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s*:?\s*\|?\s*(.*)$', lines[0]['text'])
    if not m:
        continue
    used.append(p)
    k = NUMW[m.group(1)]
    unit = {'name': f"Unit {m.group(1).title()}: {m.group(2).strip()}", 'nameSource': f'page {p}', 'items': []}
    if k <= len(meta['siteUnits']):
        unit['siteUnitName'] = meta['siteUnits'][k - 1]
    units.append(unit)
    # Objectives paragraph
    ys = {('Understandings' if l['text'].startswith('Understandin') else re.sub(r':$', '', l['text'])): l for l in lines if re.fullmatch(r'(Objectives|Content|Understandin[a-z]*):?', l['text'])}
    if 'Objectives' in ys:
        y0 = ys['Objectives']['y0'] + 10
        y1 = ys['Content']['y0'] if 'Content' in ys else (ys['Understandings']['y0'] if 'Understandings' in ys else H)
        ol = [l for l in lines if y0 < l['y0'] < y1 and l is not ys['Objectives']]
        if ol:
            it = {'code': None, 'type': 'learning', 'text': join_lines([l['text'] for l in ol]), 'page': p, 'printedHeading': 'Objectives:'}
            if min(l['score'] for l in ol) < 0.85:
                it['ocrLowConfidence'] = round(min(l['score'] for l in ol), 2)
            unit['items'].append(it)
    if 'Understandings' in ys:
        y0 = ys['Understandings']['y1']
        st = [b[1] for b in boxes if b[1] > y0 and re.match(r'^Strategies', b[5].strip())]
        ub = [b for b in boxes if b[1] > y0 and (not st or b[1] < min(st) - 5)]
        # the two lists sit side by side: split at the x of the "B. Secondary" heading
        sec = [b for b in ub if re.search(r'Secondary', b[5])]
        split = (sec[0][0] - 20) if sec else W * 0.5
        for colname, col in (('A. Primary', [b for b in ub if b[0] < split]), ('B. Secondary', [b for b in ub if b[0] >= split])):
            cl = make_lines(col, W)
            items = []
            prev_g = None
            for l in cl:
                t = l['text']
                g = (l.get('glyph') or '').strip()
                if re.fullmatch(r'\d{1,2}\s*[.,]*', g) and g != prev_g:
                    t = g + ' ' + t
                prev_g = g or None
                if re.match(r'^[AB]\.\s*\|?\s*(Primary|Secondary):?', t):
                    continue
                mm = re.match(r'^(\d{1,2})\s*[.,]+\s*\|?\s*(.*)$', t)
                if mm:
                    items.append({'label': mm.group(1), 'lines': [mm.group(2)], 'score': l['score']})
                elif items:
                    items[-1]['lines'].append(t); items[-1]['score'] = min(items[-1]['score'], l['score'])
            for it in items:
                o = {'code': None, 'type': 'learning', 'label': it['label'], 'text': join_lines(it['lines']), 'page': p,
                     'printedHeading': 'Understandings:', 'group': colname}
                if it['score'] < 0.85:
                    o['ocrLowConfidence'] = round(it['score'], 2)
                unit['items'].append(o)
nL = sum(len(u['items']) for u in units)
found = {u['name'].split(':')[0] for u in units}
notes = [
    'OCR (RapidOCR PP-OCRv6, 200 dpi) of a scanned, typewritten 1975 guide; the typescript OCRs less cleanly than the 1990s guides (e.g. "Fole" for "Role" in the contents). Only the ten unit introduction pages were recognised in full; the strategy pages, appendices and bibliography were not.',
    'Per unit: "Objectives:" (one item, printedHeading "Objectives:") and the "Understandings:" lists ("group" = "A. Primary" or "B. Secondary"; label = the printed number). The two lists are printed side by side and were split at the "B. Secondary" heading.',
    'This guide predates foundational/learning objectives; the unit objectives and understandings are given type "learning". "Content:" headings are not extracted.',
    f'Units found: {len(units)} of {len(meta["siteUnits"])} listed on the site.',
]
obj = {'curriculumId': CID, 'name': meta['name'], 'levels': meta['levels'],
       'source': {**source(CID), 'pages': used, 'pageNumbering': 'page = 1-based PDF page'},
       'kind': 'objectives', 'text': 'OCR of a scanned image-only PDF; see notes',
       'counts': {'units': len(units), 'foundational': 0, 'learning': nL}, 'units': units, 'notes': notes}
print(write(CID, obj), obj['counts'])
for u in units:
    print(' ', u['name'], '|', u.get('siteUnitName'), '|', len(u['items']))

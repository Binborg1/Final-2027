# Native Studies 10 (2002): "Foundational and Learning Objectives" table, PDF pages 27 onward.
# Text layer from Acrobat Web Capture (real text, not OCR). Left column = foundational objective
# (Times-Bold), right column = learning objectives (ZapfDingbats "G" bullet, then Times-Roman).
import sys, os, re, fitz
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from common import *

CID = 179
doc = fitz.open(pdf_path(CID))
units, notes = [], []
unit = None
cur_fo = None
first, last = 27, None
for pno in range(26, 60):
    pg = doc[pno]
    lines = []
    for b in pg.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ''.join(s['text'] for s in l['spans'])
            if not t.strip():
                continue
            lines.append({'x': l['bbox'][0], 'y': l['bbox'][1], 't': t, 'fonts': [s['font'] for s in l['spans'] if s['text'].strip()], 'size': max(s['size'] for s in l['spans'] if s['text'].strip())})
    # stop at the first page with no objective-table lines
    has_table = any(l['fonts'] and l['fonts'][0] == 'ZapfDingbats' for l in lines) or any(re.match(r'Unit \w+ - ', l['t']) for l in lines)
    if not has_table:
        last = pno
        break
    lines.sort(key=lambda l: (l['y'], l['x']))
    # classify by font, not position: the table's column boundary moves between pages
    events = []
    para = None
    lo = None
    for l in lines:
        t = norm(l['t'])
        f0 = l['fonts'][0]
        if l['size'] >= 17:
            if re.match(r'^Unit (One|Two|Three|Four|Five) ', t):
                events.append((l['y'] - 4, 0, 'unit', t)); para = None
            continue
        if f0 == 'ZapfDingbats':
            lo = {'lines': [re.sub(r'^G\s*', '', l['t'])], 'page': pno + 1}
            events.append((l['y'], 2, 'lo', lo))
        elif 'Bold' in f0:
            if para and l['y'] - para['yend'] < 22:
                para['lines'].append(t); para['yend'] = l['y']
            else:
                para = {'y': l['y'], 'yend': l['y'], 'lines': [t]}
                events.append((l['y'] - 4, 1, 'fo', para))
        else:
            if lo is not None:
                lo['lines'].append(l['t'])
            else:
                notes.append(f"Page {pno+1}: plain line with no bullet before it, left out: {t!r}")
    events.sort(key=lambda e: (e[0], e[1]))
    for y, _, kind, val in events:
        if kind == 'unit':
            unit = {'name': val, 'items': []}
            units.append(unit); cur_fo = None
        elif kind == 'fo':
            cur_fo = {'code': None, 'type': 'foundational', 'text': None, '_p': val, 'page': pno + 1}
            unit['items'].append(cur_fo)
        else:
            unit['items'].append({'code': None, 'type': 'learning', 'text': join_lines(val['lines']), 'page': val['page'],
                                  'foundational': None, '_fo': cur_fo})
for u in units:
    for it in u['items']:
        if it['type'] == 'foundational':
            it['text'] = join_lines(it.pop('_p')['lines'])
    for it in u['items']:
        if it['type'] == 'learning':
            fo = it.pop('_fo')
            it['foundational'] = fo['text'] if fo else None
            if not fo:
                notes.append(f"Page {it['page']}: learning objective with no foundational objective before it: {it['text']!r}")
nF = sum(1 for u in units for i in u['items'] if i['type'] == 'foundational')
nL = sum(1 for u in units for i in u['items'] if i['type'] == 'learning')
notes.insert(0, 'Source is the course-wide "Foundational and Learning Objectives" table (PDF pages %d-%d). Each learning objective sits beside a foundational objective in the printed table; "foundational" on a learning item gives the foundational objective it is printed beside (by vertical position on the page, carried across page breaks).' % (first, last))
notes.append('Unit names are the headings printed in this table. The table prints "Unit Two - Community and Kinship" while the guide’s contents list "Unit Two - Community and Kinship: Aboriginal Perspectives". The same objectives are printed again at the start of each unit (PDF pages 196, 269, 403, 541 by the bookmarks); those copies were not compared.')
notes.insert(1, 'Text comes from the PDF text layer (Acrobat Web Capture of the original web document), not OCR. Bullet glyph "G" (ZapfDingbats) removed.')
obj = {'curriculumId': CID, 'name': 'Native Studies 10', 'levels': [10],
       'source': {**source(CID), 'pages': list(range(first, last + 1)), 'pageNumbering': 'page = 1-based PDF page (the PDF has no printed page numbers in this section)'},
       'kind': 'objectives',
       'structure': 'Units; each foundational objective is followed by the learning objectives printed beside it.',
       'counts': {'units': len(units), 'foundational': nF, 'learning': nL},
       'units': units, 'notes': notes}
print(write(CID, obj), obj['counts'])
for u in units:
    print(u['name'], sum(1 for i in u['items'] if i['type'] == 'foundational'), sum(1 for i in u['items'] if i['type'] == 'learning'))

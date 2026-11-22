# Parse the 2026 PRELIMINARY outcome/indicator documents (809, 812). Text layer from Word; no OCR.
import re, fitz
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

CODE = re.compile(r'^((?:CK|DTS|ED|IL|IS)\d+\.\d+)\s+(.*)$')
IND = re.compile(r'^([a-z])\.\s+(.*)$')
BUL = re.compile(r'^[•●▪◦]\s*(.*)$')
DETAIL_HEAD = re.compile(r'^(Content|Disciplinary Thinking Skills?|Ethical Dimension|Information Literacy)?\s*Outcomes? and Indicators$')


def page_lines(doc, pno):
    """Visible lines of a page in reading order with x0; the running footer is returned separately."""
    pg = doc[pno]
    H = pg.rect.height
    body, footer = [], []
    raw = []
    for b in pg.get_text('dict', sort=True)['blocks']:
        for l in b.get('lines', []):
            raw.append(l)
    # a label printed on its own ("i.") is merged with the text line that follows it
    merged, skip = [], False
    for i, l in enumerate(raw):
        t = norm(''.join(s['text'] for s in l['spans']))
        if re.fullmatch(r'[a-z]\.', t) and i + 1 < len(raw):
            raw[i + 1] = dict(raw[i + 1], bbox=(l['bbox'][0],) + tuple(raw[i + 1]['bbox'][1:]), spans=[{'text': t + ' '}] + raw[i + 1]['spans'])
            continue
        merged.append(l)
    for l in merged:
        if True:
            t = norm(''.join(s['text'] for s in l['spans']))
            if not t:
                continue
            is_footer = l['bbox'][1] > H - 72 or re.match(r'^(Social Studies 10|Indigenous Studies 10)\s+\d+$', t)
            (footer if is_footer else body).append({'x': l['bbox'][0], 't': t})
    pp = None
    for f in footer:
        m = re.search(r'(\d+)$', f['t'])
        if m:
            pp = int(m.group(1))
    return body, pp


def segs_to_text(segs):
    return join_lines(segs[0]) + ''.join('\n- ' + join_lines(s) for s in segs[1:])


def parse(cid, name, glance_page, last):
    doc = fitz.open(pdf_path(cid))
    notes = []
    # 1. Outcomes at a Glance: section headings and statements
    glance, sect, cur = [], None, None
    body, _ = page_lines(doc, glance_page - 1)
    for l in body:
        t = l['t']
        if t.startswith('Legend'):
            break
        m = CODE.match(t)
        if m:
            cur = {'section': sect, 'code': m.group(1), 'lines': [m.group(2)]}
            glance.append(cur)
            continue
        if re.search(r'Outcomes? \((CK|DTS|ED|IL|IS)\)$', t):
            sect, cur = t, None
            continue
        if cur and t not in ('Outcomes at a Glance',):
            cur['lines'].append(t)
    for g in glance:
        g['text'] = join_lines(g.pop('lines'))
    # 2. Detail pages: outcomes, indicators, sub-bullets
    items, heads, state, started = [], [], None, False
    for p in range(glance_page - 1, last):
        body, pp = page_lines(doc, p)
        for l in body:
            t = l['t']
            if DETAIL_HEAD.match(t):
                heads.append((t, p + 1))
                started, state = True, 'head'
                continue
            if not started:
                continue
            m = CODE.match(t)
            if m and l['x'] < 100:
                items.append({'code': m.group(1), 'type': 'outcome', 'segs': [[m.group(2)]], 'page': p + 1, 'printedPage': pp})
                state = 'outcome'
                continue
            if t in ('Indicators', 'Indicator'):
                if t == 'Indicator':
                    notes.append(f"Page {p+1}: the indicator list for {last_outcome(items)['code']} is headed 'Indicator' (singular) in the document.")
                state = 'ind'
                continue
            m = IND.match(t)
            if m and state in ('ind', 'indicator'):
                par = last_outcome(items)['code']
                items.append({'code': None, 'label': m.group(1), 'parent': par, 'type': 'indicator', 'segs': [[m.group(2)]], 'page': p + 1, 'printedPage': pp})
                state = 'indicator'
                continue
            m = BUL.match(t)
            if m and state == 'indicator':
                items[-1]['segs'].append([m.group(1)])
                continue
            if state in ('outcome', 'indicator'):
                items[-1]['segs'][-1].append(t)
                continue
            notes.append(f"Page {p+1}: line not classified and left out: {t!r}")
    for it in items:
        it['text'] = segs_to_text(it.pop('segs'))
    return glance, heads, items, notes


def last_outcome(items):
    for it in reversed(items):
        if it['type'] == 'outcome':
            return it


def build(cid, name, glance_page, last):
    glance, heads, items, notes = parse(cid, name, glance_page, last)
    gnum = {g['code'].split('.')[-1]: g for g in glance}
    for it in items:
        if it['type'] != 'outcome':
            continue
        g = gnum.get(it['code'].split('.')[-1])
        if not g:
            notes.append(f"{it['code']} (page {it['page']}) is not in Outcomes at a Glance.")
            continue
        if g['code'] != it['code']:
            it['glanceCode'] = g['code']
            notes.append(f"{it['code']} on page {it['page']} is printed as {g['code']} in Outcomes at a Glance (page {glance_page}).")
        if g['text'] != it['text']:
            it['glanceText'] = g['text']
            notes.append(f"{it['code']}: Outcomes at a Glance (page {glance_page}) prints {g['text']!r}; the outcome page {it['page']} prints {it['text']!r}.")
    sections = []
    for g in glance:
        if g['section'] not in sections:
            sections.append(g['section'])
    if sections != [None]:
        units = [{'name': s, 'nameSource': f'outcome section heading in Outcomes at a Glance (page {glance_page}); the document has no units', 'items': []} for s in sections]
        by = {s: u for s, u in zip(sections, units)}
        for it in items:
            num = (it.get('parent') or it['code']).split('.')[-1]
            by[gnum[num]['section']]['items'].append(it)
    else:
        units = [{'name': None, 'nameSource': 'The document has no units or outcome sections: every outcome is in one list.', 'items': items}]
    for h, p in heads:
        notes.append(f"Heading printed on page {p}: {h!r}.")
    nO = sum(1 for i in items if i['type'] == 'outcome')
    nI = sum(1 for i in items if i['type'] == 'indicator')
    obj = {'curriculumId': cid, 'name': name, 'levels': [10],
           'source': {**source(cid), 'pages': list(range(glance_page, last + 1)),
                      'pageNumbering': 'page = 1-based PDF page; printedPage = the number printed in the page footer'},
           'kind': 'outcomes',
           'structure': 'Outcomes (code + statement) each with lettered indicators; an indicator\'s bulleted sub-list is kept as lines starting "- ".',
           'counts': {'units': 0 if units[0]['name'] is None else len(units), 'outcomes': nO, 'indicators': nI},
           'units': units, 'notes': notes}
    print(write(cid, obj), obj['counts'], len(notes), 'notes')


if __name__ == '__main__':
    build(809, 'Social Studies 10 (2026 PRELIMINARY)', 14, 26)
    build(812, 'Indigenous Studies 10 (2026 PRELIMINARY)', 16, 22)

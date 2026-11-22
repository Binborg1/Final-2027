# Parser for the 1960s-70s programs of studies: Geography 10 (1964), 20 (1966), 30 (1969),
# Economics 20 (1975), 30 (1978). Works on RapidOCR page files. These guides predate
# "foundational/learning objectives": they print course OBJECTIVES and, per unit,
# "Understandings to be developed" (geography) or "Objectives" + "Understandings" (economics).
# Mapping used here (see notes in each file):
#   course-level objectives            -> type "foundational", printedHeading as printed
#   unit "Understandings ..." items     -> type "learning",     printedHeading as printed
#   economics unit "Objectives" text    -> type "learning",     printedHeading "Objectives"
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from guide90s import load, npages, make_lines

UNIT_RE = re.compile(r'^UNITE?\s+((?:[IVX]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)(?:\s*(?:&|and)\s*(?:[IVX]+|\d+))?)\b\s*[:.]?\s*(.*)$', re.I)
NUM_RE = re.compile(r'^(\d{1,2})\s*[.,。]\s*\|?\s*(?=[A-Za-z"(])(.*)$')
LET_RE = re.compile(r'^\(([a-z])\)\s*(.*)$')


def page_lines(cid, p):
    d = load(cid, p)
    if d is None:
        return None, []
    W, H = d['w'], d['h']
    lines = make_lines(d['lines'], W)
    out = []
    for l in lines:
        t = l['text'].strip()
        g = (l.get('glyph') or '').strip()
        if re.fullmatch(r'\d{1,2}\s*[.,。]?|\([a-z]\)', g):
            t = g + ' ' + t                 # an item number read as a separate small box
        if re.fullmatch(r'[-–\s]*\d{1,3}[-–\s]*', t) or re.fullmatch(r'[ivx]+', t):
            continue                      # page numbers
        l['text'] = t
        out.append(l)
    return d, out


def blocks_by_gap(lines):
    """Split lines into paragraphs where the vertical gap is clearly larger than the line spacing."""
    if not lines:
        return []
    gaps = [b['y0'] - a['y1'] for a, b in zip(lines, lines[1:])]
    med = sorted(gaps)[len(gaps) // 2] if gaps else 0
    paras = [[lines[0]]]
    for g, l in zip(gaps, lines[1:]):
        if g > max(med * 1.8, med + 18):
            paras.append([l])
        else:
            paras[-1].append(l)
    return paras


def items_from(lines, numbered_only=False):
    """Numbered (1.) or lettered ((a)) entries start items; otherwise one item per paragraph."""
    if any(NUM_RE.match(l['text']) or LET_RE.match(l['text']) for l in lines):
        items = []
        group = None
        for l in lines:
            m = NUM_RE.match(l['text']) or LET_RE.match(l['text'])
            if m and ((m.group(2).rstrip().endswith(':') and len(m.group(2).replace(' ', '')) <= 22) or re.fullmatch(r'[A-Z][A-Za-z0-9]{3,13}\.?', m.group(2).strip())):
                group = f"({m.group(1)}) {m.group(2).strip()}" if LET_RE.match(l['text']) else f"{m.group(1)}. {m.group(2).strip()}"
                continue                      # "(a) Understandings:" heads a group, it is not an item
            if m:
                items.append({'label': m.group(1), 'lines': [m.group(2)], 'page': l['page'], 'score': l['score'], 'group': group})
            elif items:
                items[-1]['lines'].append(l['text']); items[-1]['score'] = min(items[-1]['score'], l['score'])
            else:
                items.append({'label': None, 'lines': [l['text']], 'page': l['page'], 'score': l['score']})
        return items
    if numbered_only:
        return []
    return [{'label': None, 'lines': [l['text'] for l in p], 'page': p[0]['page'], 'score': min(l['score'] for l in p)} for p in blocks_by_gap(lines)]


def finish(it, typ, heading, **extra):
    o = {'code': None, 'type': typ, 'label': it['label'], 'text': join_lines(it['lines']), 'page': it['page'], 'printedHeading': heading}
    if it.get('group'):
        o['group'] = it['group']
    o.update({k: v for k, v in extra.items() if v is not None})
    if it['score'] < 0.85:
        o['ocrLowConfidence'] = round(it['score'], 2)
    return o


def collect(cid, pages, start_re, stop_re):
    """Lines after a heading matching start_re until a line matching stop_re, over the given pages."""
    got, on, heading = [], False, None
    for p in pages:
        d, lines = page_lines(cid, p)
        for l in lines:
            l['page'] = p
            if not on and start_re.search(l['text']):
                on, heading = True, l['text']
                continue
            if on and stop_re.search(l['text']):
                return heading, got
            if on:
                got.append(l)
    return heading, got


def parse_units(cid, pages, und_re, stop_re, obj_re=None, section_re=None, title_next_line=True, unit_upper=False, title_lines=1):
    units, unit, mode, section = [], None, None, None
    buf, buf_head = [], None

    def flush():
        nonlocal buf
        if buf and unit is not None and mode:
            for it in items_from(buf):
                unit['items'].append(finish(it, 'learning', buf_head, section=section))
        buf = []

    pending_title = 0
    first_title = False
    for p in pages:
        d, lines = page_lines(cid, p)
        for l in lines:
            l['page'] = p
            t = l['text']
            mu = UNIT_RE.match(t)
            if mu and unit_upper and not t.startswith('UNIT'):
                mu = None
            if mu and l['x0'] < d['w'] * 0.5:
                flush(); mode = None; section = None
                rest = mu.group(2).strip(' :-')
                unit = {'name': f"Unit {mu.group(1)}" + (f": {rest}" if rest else ''), 'nameSource': f'page {p}', 'items': []}
                units.append(unit)
                pending_title = title_lines if (title_next_line and not rest) else 0
                first_title = True
                continue
            if pending_title:
                if und_re.search(t) or (obj_re and obj_re.search(t)) or re.match(r'^(References|Theme|\(|SUGGESTED|Suggested)', t):
                    pending_title = 0
                else:
                    unit['name'] += (': ' if first_title else ' ') + t
                    first_title = False
                    pending_title -= 1
                    continue
            if unit is None:
                continue
            if section_re:
                ms = section_re.match(t)
                if ms:
                    flush(); mode = None; section = t
                    continue
            if und_re.search(t):
                flush(); mode = 'und'; buf_head = t
                continue
            if obj_re and obj_re.search(t):
                flush(); mode = 'obj'; buf_head = t
                continue
            if stop_re.search(t):
                flush(); mode = None
                continue
            if mode:
                buf.append(l)
    flush()
    return units


def build(cid, course_cfg, unit_cfg, notes):
    meta = json.load(open(os.path.join(ROOT, 'out', 'meta.json'), encoding='utf8'))[str(cid)]
    allunits = []
    nF = 0
    for cc in course_cfg:
        heading, lines = collect(cid, cc['pages'], cc['start'], cc['stop'])
        its = [finish(it, 'foundational', heading) for it in items_from(lines)]
        if its:
            allunits.append({'name': None, 'scope': 'course', 'note': f'Course-level objectives printed under "{heading}".', 'items': its})
            nF += len(its)
    units = parse_units(cid, **unit_cfg)
    ROMAN = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5, 'SIX': 6}
    for u in units:
        m = re.match(r'Unit\s+([IVX]+|\d+|[A-Z]+)', u['name'], re.I)
        k = (int(m.group(1)) if m.group(1).isdigit() else ROMAN.get(m.group(1).upper())) if m else None
        if k and k <= len(meta['siteUnits']):
            u['siteUnitName'] = meta['siteUnits'][k - 1]
            if re.match(r'Unit\s+\S+\s*(&|and)\s*(\S+)', u['name']):
                k2 = re.match(r'Unit\s+\S+\s*(?:&|and)\s*([IVX]+|\d+)', u['name'])
                k2 = (int(k2.group(1)) if k2 and k2.group(1).isdigit() else ROMAN.get(k2.group(1).upper())) if k2 else None
                if k2 and k2 <= len(meta['siteUnits']):
                    u['siteUnitName'] = meta['siteUnits'][k - 1] + ' + ' + meta['siteUnits'][k2 - 1]
    allunits += units
    nL = sum(len(u['items']) for u in units)
    used = sorted({it['page'] for u in allunits for it in u['items']})
    obj = {'curriculumId': cid, 'name': meta['name'], 'levels': meta['levels'],
           'source': {**source(cid), 'pages': used, 'pageNumbering': 'page = 1-based PDF page'},
           'kind': 'objectives',
           'text': 'OCR (RapidOCR PP-OCRv6, 200 dpi) of a scanned image-only PDF; see notes',
           'counts': {'units': len(units), 'foundational': nF, 'learning': nL},
           'units': allunits,
           'notes': ['This guide predates foundational/learning objectives. Course-level objectives are given type "foundational" and the unit "Understandings"/"Objectives" type "learning"; printedHeading keeps the heading as printed. "Content", "Suggested organization of content", "Suggested activities", references and resources are not extracted.',
                     'Numbered or lettered entries are separate items ("label" keeps the number or letter); unnumbered text is one item per paragraph.'] + notes}
    print(write(cid, obj), obj['counts'])
    for u in units:
        print(' ', u['name'], '|', u.get('siteUnitName'), '|', len(u['items']))
    return obj

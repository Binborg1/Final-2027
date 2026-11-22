# Parser for the 1990s Saskatchewan Social Studies / History guides (SS 10/20/30, History 10/20/30),
# working on RapidOCR page files out/ocr/<cid>/pNNN.json (full-page OCR, 200 dpi).
#
# What it extracts, verbatim from the OCR text:
#   1. course foundational objectives  (pages headed "... Foundational Objectives ...", not a unit)
#   2. unit foundational objectives     (pages headed "Unit X ... Foundational Objectives")
#   3. learning objectives from the unit content tables:
#        left page  "Content | Concepts (Knowledge Objectives)"            -> knowledge objectives (concept column)
#        right page "Skills/Abilities Objectives | Values Objectives | ..." -> skills/abilities and values objectives
#   4. 1997 guides: "Unit X: ... Core Learning Objectives" summary pages.
import sys, os, re, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

WORDNUM = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6}
MAIN_GLYPH = set('•●')
SUB_GLYPH = set('。○◦o0O-–·∙.e')
ABBR = re.compile(r'(\be\.g\.|\bi\.e\.|\betc\.|\bp\.|\bpp\.|\bSt\.|\bMr\.|\bMrs\.|\bDr\.|\bvs\.|\bU\.S\.|\bNo\.)$')
KNOW = re.compile(r'^(Know|Understand|Recogni[sz]e|Be aware|Appreciate that)\b')


def load(cid, p):
    f = os.path.join(ROOT, 'out', 'ocr', str(cid), f'p{p:03d}.json')
    if not os.path.exists(f):
        return None
    return json.load(open(f, encoding='utf8'))


def npages(cid):
    return len(glob.glob(os.path.join(ROOT, 'out', 'ocr', str(cid), 'p[0-9][0-9][0-9].json')))


def is_glyph_box(b, W):
    t = b[5].strip()
    return (b[2] - b[0]) < W * 0.03 and len(t) <= 2 and not re.fullmatch(r'\d+|[A-Z]\.?|[a-z]{2}', t) or t in ('●', '•', '。', '○', '◦')


def make_lines(boxes, W):
    """Group OCR boxes into text lines (rows). Small glyph boxes become a bullet flag on the line to their right."""
    glyphs = [b for b in boxes if is_glyph_box(b, W)]
    text = [b for b in boxes if not is_glyph_box(b, W)]
    text.sort(key=lambda b: (b[1], b[0]))
    rows = []
    for b in text:
        cy = (b[1] + b[3]) / 2
        for r in rows:
            if r['y0'] - 4 <= cy <= r['y1'] + 4 and abs(cy - (r['y0'] + r['y1']) / 2) < 18:
                r['boxes'].append(b); r['y0'] = min(r['y0'], b[1]); r['y1'] = max(r['y1'], b[3])
                break
        else:
            rows.append({'boxes': [b], 'y0': b[1], 'y1': b[3]})
    lines = []
    for r in rows:
        r['boxes'].sort(key=lambda b: b[0])
        t = ' '.join(b[5].strip() for b in r['boxes'])
        ln = {'x0': r['boxes'][0][0], 'x1': r['boxes'][-1][2], 'y0': r['y0'], 'y1': r['y1'], 'text': t,
              'score': min(b[4] for b in r['boxes']), 'glyph': None}
        for g in glyphs:
            gc = (g[1] + g[3]) / 2
            if ln['y0'] - 12 <= gc <= ln['y1'] + 6 and g[2] <= ln['x0'] + 12:
                ln['glyph'] = g[5].strip()
        m = re.match(r'^([•●。○◦▪■·∙]|[-–](?=\s)|o(?=\s[a-z])|\.(?=\s))\s*', t)
        if m:
            ln['glyph'] = ln['glyph'] or m.group(1)
            ln['text'] = t[m.end():]
        if re.search(r'(\w+-){6,}\w+', ln['text']) and ln['text'].count('-') >= 6 and ' ' not in ln['text'].strip():
            ln['text'] = ln['text'].replace('-', ' ').replace('_', ' ')
            ln['score'] = min(ln['score'], 0.5)
        if ln['text']:
            lines.append(ln)
    lines.sort(key=lambda l: l['y0'])
    return lines


def printed_page(d):
    H = d['h']
    nums = [b[5].strip() for b in d['lines'] if b[1] > H * 0.9 and re.fullmatch(r'\d{1,3}', b[5].strip())]
    return int(nums[-1]) if nums else None


def ends_terminal(t):
    t = t.rstrip()
    if ABBR.search(t):
        return False
    return bool(re.search(r'[.;:?!]["”’)]?$', t))


def segment(lines, main_cue=None):
    """Split a column of lines into items. Returns [{'lines': [...], 'glyph': ..}]"""
    if not lines:
        return []
    # right margin of the column: a high percentile of line ends, so one over-wide line
    # (two columns run together) does not make every other line look short
    x1s = sorted(l['x1'] for l in lines)
    right = x1s[min(len(x1s) - 1, int(len(x1s) * 0.8))]
    left = min(l['x0'] for l in lines)
    width = max(1, right - left)
    items = []
    for i, ln in enumerate(lines):
        new = not items
        if items:
            prev = items[-1]['lines'][-1]
            pt = prev['text'].rstrip()
            # reflow test: would the first word of this line have fitted at the end of the previous one?
            cw = (prev['x1'] - prev['x0']) / max(1, len(prev['text']))
            fw = len(ln['text'].split(' ')[0]) + 1
            fits = prev['x1'] + cw * fw < right - cw * 0.5 and not pt.endswith('-')
            gap = ln['y0'] - prev['y1']
            if re.fullmatch(r'(and|or),?', ln['text'].strip()):
                new = False                      # a lone "and," wrapped from the line above
            elif ln['glyph']:
                new = True
            elif main_cue and main_cue.match(ln['text']) and (fits or ends_terminal(pt)):
                new = True
            elif ends_terminal(pt):
                new = True
            elif re.search(r';\s*(and|or),?$', pt):
                new = True
            elif fits:
                new = True
            elif gap > 45:
                new = True
        if new:
            items.append({'lines': [ln], 'glyph': ln['glyph']})
        else:
            items[-1]['lines'].append(ln)
    for it in items:
        it['text'] = join_lines([l['text'] for l in it['lines']])
        it['minScore'] = min(l['score'] for l in it['lines'])
    return items


def nest(items, main_cue=None, is_heading=None):
    """Attach sub-list entries to the item ending in ':' that opens them. Returns main items with 'subs'.
    Rules (heuristic, see notes): the item right after ':' is always a sub-entry; a sub-list goes on
    while the last entry ends in ',', ';', 'and' or 'or'; it stops at an item matching main_cue, at
    a heading, at another item ending in ':', or after an entry ending in '.'/'?' when the next item
    starts with a capital and the entries started in lower case."""
    out = []
    parent = None
    for it in items:
        t = it['text']
        if parent is not None:
            subs = parent['subs']
            last = subs[-1]['text'] if subs else ''
            first_lower = subs[0]['text'][:1].islower() if subs else True
            close = False
            if (main_cue and main_cue.match(t)) or (is_heading and is_heading(it)):
                close = True
            elif not subs:
                close = False
            elif re.search(r'([,;]|\b(and|or),?)$', last):
                close = False
            elif t.endswith(':'):
                close = True
            elif main_cue:
                close = False
            elif re.search(r'[.?!]["”]?$', last) and t[:1].isupper() and first_lower:
                close = True
            elif last.endswith('.') and it['glyph'] not in SUB_GLYPH:
                close = True
            if not close:
                subs.append(it)
                continue
            parent = None
        it['subs'] = []
        out.append(it)
        if t.endswith(':'):
            parent = it
    return out


def flatten_text(it):
    return it['text'] + ''.join('\n- ' + s['text'] for s in it.get('subs', []))


def item_out(it, typ, page, pp, **extra):
    o = {'code': None, 'type': typ, 'text': flatten_text(it), 'page': page, 'printedPage': pp}
    o.update({k: v for k, v in extra.items() if v is not None})
    sc = min([it['minScore']] + [s['minScore'] for s in it.get('subs', [])])
    if sc < 0.85:
        o['ocrLowConfidence'] = round(sc, 2)
    return o


SECTION = re.compile(r'^(Concept|Concepts|Knowledge|Skills/Abilities|Skills and Abilities|Skills|Abilities|Values)(?:\s+Objectives)?\s*(?::\s*(.*)|$|\s+(?=The student))(.*)$', re.I)
COURSE_SECTION = re.compile(r'^The (knowledge|skills/abilities|skills|values) objectives (are|is) to help students\b(.*)$', re.I)


def domain_of(word):
    w = word.lower()
    return 'knowledge' if w.startswith('know') else 'skills/abilities' if w.startswith(('skill', 'abil')) else 'values' if w.startswith('value') else 'concept'


def parse_fo_page(d, page, kind, unit_name=None):
    """Foundational objectives page (course- or unit-level). Returns (items, heading, notes)."""
    W = d['w']
    lines = make_lines(d['lines'], W)
    H = d['h']
    lines = [l for l in lines if l['y0'] < H * 0.92]
    pp = printed_page(d)
    heading = []
    out, notes = [], []
    domain, concept, stem = None, None, None
    buf = []

    def flush():
        nonlocal buf
        if not buf:
            return
        cue = KNOW if domain == 'knowledge' and kind == 'unit' else (re.compile(r'^(that|understand)\b') if kind == 'course' else None)
        for it in nest(segment(buf, cue), cue):
            out.append(item_out(it, 'foundational', page, pp, domain=domain, concept=concept, stem=stem, level=kind))
        buf = []

    started = False
    for ln in lines:
        t = ln['text']
        m = SECTION.match(t)
        mc = COURSE_SECTION.match(t)
        if mc:
            flush(); started = True
            domain = domain_of(mc.group(1)); stem = t
            continue
        if m and ln['x0'] < W * 0.2:
            flush(); started = True
            dm = domain_of(m.group(1))
            if dm == 'concept':
                concept = (m.group(2) or m.group(3) or '').strip() or None
                stem = None
            else:
                domain = dm
                stem = (m.group(2) or m.group(3) or '').strip() or None
            continue
        if not started:
            heading.append(t)
            continue
        buf.append(ln)
    flush()
    return out, heading, notes, pp


def column_bounds(d, W, H, left_page):
    """x boundaries of the table columns from the header boxes."""
    head = header_boxes(d)
    if left_page:
        c = [b for b in head if re.search(r'Concepts', b[5])]
        return {'concepts': c[0][0] - 25 if c else W * 0.45}
    v = [b for b in head if re.search(r'Values', b[5])]
    s = [b for b in head if re.search(r'Suggest', b[5])]
    return {'values': v[0][0] - 25 if v else None, 'suggested': s[0][0] - 25 if s else None}


def header_boxes(d):
    """Boxes of the page header band. Pages OCRed by ocrsmart.py with a column crop keep the
    full-width header band in d['head']."""
    H = d['h']
    hb = [b for b in d['lines'] if b[1] < H * 0.13]
    if d.get('crop') and d.get('head'):
        hb = d['head']
    return hb


def header_text(d):
    return ' '.join(b[5] for b in sorted(header_boxes(d), key=lambda b: (b[1], b[0])))


def is_left_table(d):
    h = header_text(d)
    return bool(re.search(r'(?<!Core )\bContent\b', h) and re.search(r'Concepts\s*[\(<{]?\s*Knowledge|Knowledge Objectives', h))


def is_right_table(d):
    h = header_text(d)
    return bool(re.search(r'Skills', h) and re.search(r'Values', h) and re.search(r'Suggest', h))


def split_at(b, x, splits):
    """Split an OCR box that runs across a column boundary at x. The cut is made at the space (or the
    lower-to-upper case change, where two columns ran together) nearest the proportional position."""
    t = b[5]
    ratio = (x - b[0]) / max(1, b[2] - b[0])
    target = ratio * len(t)
    cands = [i for i in range(1, len(t)) if t[i] == ' ' or (t[i - 1].islower() and t[i].isupper())]
    if not cands:
        return None
    i = min(cands, key=lambda c: abs(c - target))
    if abs(i - target) > max(6, 0.25 * len(t)):
        return None
    left, right = t[:i].rstrip(), t[i:].lstrip()
    splits.append((t, left, right))
    sc = min(b[4], 0.5)  # flags the item as uncertain (ocrLowConfidence)
    return [b[0], b[1], x, b[3], sc, left], [x, b[1], b[2], b[3], sc, right]


def split_boxes(boxes, xs, page, notes):
    out = []
    for b in boxes:
        parts = [b]
        for x in xs:
            nxt = []
            for q in parts:
                if q[0] < x - 80 and q[2] > x + 60:
                    sp = []
                    r = split_at(q, x, sp)
                    if r:
                        nxt += [r[0], r[1]]
                        notes.append(f"Page {page}: one OCR line ran across two table columns and was split at the column edge: {sp[0][0]!r} -> {sp[0][1]!r} | {sp[0][2]!r}")
                    else:
                        nxt.append(q)
                        notes.append(f"Page {page}: an OCR line runs across a column edge and could not be split; kept in the column where it starts: {q[5]!r}")
                else:
                    nxt.append(q)
            parts = nxt
        out += parts
    return out


def concept_heading(it):
    t = it['text']
    return (len(it['lines']) == 1 and not KNOW.match(t) and not ends_terminal(t) and len(t) < 60
            and t[:1].isupper() and not re.search(r'[,;]$', t))


def table_items(d, page, unit, notes):
    W, H = d['w'], d['h']
    pp = printed_page(d)
    raw = [b for b in d['lines'] if b[1] < H * 0.93 and not (b[1] > H * 0.9 and re.fullmatch(r'\d{1,3}', b[5].strip()))]
    out = []
    if is_left_table(d):
        cb = column_bounds(d, W, H, True)['concepts']
        body = [b for b in raw if b[1] > H * 0.06]
        ys = [b[1] for b in body if re.match(r'^(Knowledge|Skills?|Values?|Skills/Abilities) Assessment|^Assessment of', b[5].strip())]
        if ys:
            notes.append(f"Page {page}: lines from the assessment block down (assessment notes, not objectives) were left out.")
            body = [b for b in body if b[1] < min(ys) - 5]
        body = split_boxes(body, [cb], page, notes)
        col = [b for b in body if b[0] >= cb - 10]
        lines = [l for l in make_lines(col, W) if not re.search(r'^Concepts\s*[\(<{]|Knowledge Objectives\)?$', l['text'])]
        items = nest(segment(lines, KNOW), KNOW, concept_heading)
        concept = unit.get('_concept')
        for it in items:
            if concept_heading(it) and not it['subs']:
                concept = it['text']
                continue
            out.append(item_out(it, 'learning', page, pp, domain='knowledge', concept=concept))
        unit['_concept'] = concept
        return out
    if is_right_table(d):
        cb = column_bounds(d, W, H, False)
        if cb['values'] is None or cb['suggested'] is None:
            notes.append(f"Page {page}: right-hand table page without readable column headers; skipped.")
            return out
        hdr_re = re.compile(r'^(Skills/Abilities|Skills|Values|Objectives?|Values Objectives|Skills/Abilities Objectives|Suggested Teaching.*|Strategies|Evaluation Strategies)$')
        body = [b for b in raw if b[1] > H * 0.05 and not hdr_re.match(b[5].strip())]
        stop_y = None
        for b in body:
            if b[0] < cb['suggested'] and re.match(r'^(Knowledge|Skills?|Values?|Skills/Abilities) Assessment|^Assessment of', b[5].strip()):
                stop_y = b[1] if stop_y is None else min(stop_y, b[1])
        if stop_y:
            notes.append(f"Page {page}: lines from the assessment block down (assessment notes, not objectives) were left out of the skills and values columns.")
            body = [b for b in body if b[1] < stop_y - 5]
        body = split_boxes(body, [cb['values'], cb['suggested']], page, notes)
        sk = [b for b in body if b[0] < cb['values'] - 10]
        va = [b for b in body if cb['values'] - 10 <= b[0] < cb['suggested'] - 10]
        for dom, col in (('skills/abilities', sk), ('values', va)):
            lines = [l for l in make_lines(col, W) if not hdr_re.match(l['text'])]
            for it in nest(segment(lines)):
                out.append(item_out(it, 'learning', page, pp, domain=dom))
        return out
    return out



CLO_CUE = re.compile(r'^(Know|Learn|Appreciate|Understand|Practi[sc]e|Develop|Be aware)\b')


def parse_clo_page(cid, d, page, state, notes):
    """1997 guides: "Unit X: ... Core Learning Objectives" pages. Concept labels sit in a left column;
    the objectives are to the right. A filled marker (●) means a foundational objective of the course,
    a hollow marker (○) a core learning objective (legend printed on the first page). Markers are read
    from the page image (markers.py), not from the OCR text."""
    from markers import marker_left_of
    W, H = d['w'], d['h']
    pp = printed_page(d)
    raw = [b for b in d['lines'] if b[1] < H * 0.93 and not (b[1] > H * 0.9 and re.fullmatch(r'\d{1,3}', b[5].strip()))]
    raw.sort(key=lambda b: (b[1], b[0]))
    # skip the page heading and the marker legend
    start_y = 0
    for b in raw:
        if re.search(r'Core Learning Objectives|indicates the (foundational|core learning) objectives|^Note: In the overview', b[5]):
            start_y = max(start_y, b[3])
    raw = [b for b in raw if b[1] > start_y]
    cands = [b[0] for b in raw if b[0] > W * 0.17 and not re.match(r'^(Knowledge|Skills/Abilities|Values) Concepts', b[5])]
    if not cands:
        return []
    sx = min(cands)
    secs = [b for b in raw if re.match(r'^(Knowledge|Skills/Abilities|Skills|Values) Concepts$', b[5].strip())]
    raw = secs + split_boxes([b for b in raw if b not in secs], [sx - 15], page, notes)
    raw.sort(key=lambda b: (b[1], b[0]))
    out = []
    labels, stm = [], []
    for b in raw:
        t = b[5].strip()
        m = re.match(r'^(Knowledge|Skills/Abilities|Skills|Values) Concepts$', t)
        if m:
            labels.append(('section', b, domain_of(m.group(1))))
            continue
        (labels if b[0] < sx - 15 else stm).append(('label', b, None) if b[0] < sx - 15 else b)
    # join label boxes into labels (a label may wrap: "Social" / "Change:")
    lab = []
    for kind, b, dom in labels:
        if kind == 'section':
            lab.append({'section': dom, 'y': b[1]})
            continue
        if lab and 'text' in lab[-1] and b[1] - lab[-1]['y1'] < 25 and not lab[-1]['text'].endswith(':'):
            lab[-1]['text'] += ' ' + b[5].strip(); lab[-1]['y1'] = b[3]
        else:
            mk = marker_left_of(cid, page, b[0], b[1], b[3], inside=bool(re.match(r'^[•●。○◦·.\-]', b[5].strip())))
            txt = re.sub(r'^[•●。○◦·.\-]\s*', '', b[5].strip())
            lab.append({'text': txt, 'y': b[1], 'y1': b[3], 'marker': mk})
    lines = make_lines(stm, W)
    for ln in lines:
        mk = marker_left_of(cid, page, ln['x0'], ln['y0'], ln['y1'], inside=bool(ln.get('glyph')))
        ln['marker'] = mk
        if mk in ('filled', 'hollow'):
            ln['glyph'] = '●' if mk == 'filled' else '○'
        elif mk == 'dash':
            ln['glyph'] = ln['glyph'] or '-'
    items = nest(segment(lines, CLO_CUE), CLO_CUE, lambda it: len(it['lines']) == 1 and not CLO_CUE.match(it['text']) and len(it['text']) < 50 and it['text'][:1].isupper() and not re.search(r'[,;:.?]$', it['text']) and it['lines'][0].get('marker') != 'dash')
    events = [(l['y'], 0, l) for l in lab] + [(it['lines'][0]['y0'], 1, it) for it in items]
    events.sort(key=lambda e: (e[0] - (12 if e[1] == 0 else 0), e[1]))
    for y, k, ev in events:
        if k == 0:
            if 'section' in ev:
                state['domain'] = ev['section']; state['concept'] = None; state['sub'] = None
            else:
                state['concept'] = ev['text'].rstrip(':').strip(); state['conceptMarker'] = ev['marker']; state['sub'] = None
                state['labelY'] = ev['y']
            continue
        it = ev
        first = it['lines'][0]
        if (len(it['lines']) == 1 and not it['subs'] and not CLO_CUE.match(it['text']) and len(it['text']) < 50
                and it['text'][:1].isupper() and not re.search(r'[,;:.?]$', it['text']) and first.get('marker') != 'dash'):
            state['sub'] = it['text']; state['subMarker'] = first.get('marker')
            continue
        mk = first.get('marker')
        lab_mk = None
        if state.get('labelY') is not None and abs(first['y0'] - state['labelY']) < 20:
            lab_mk = state.get('conceptMarker')
        marker = mk if mk in ('filled', 'hollow') else lab_mk
        typ = 'foundational' if marker == 'filled' else 'learning'
        o = item_out(it, typ, page, pp, domain=state.get('domain'), concept=state.get('concept'), subConcept=state.get('sub'),
                     marker=marker or (mk if mk == 'dash' else None), core=True if marker == 'hollow' else None, level='unit-summary')
        out.append(o)
    return out


FO_N = re.compile(r'^Foundational Objective\s+(\d+)\s*:?\s*$')


def parse_h30_page(cid, d, page, state, notes):
    """History 30 (1997): "Unit X: Foundational Objectives" pages. Each "Foundational Objective N"
    statement is a foundational objective; the "Core Concepts" that follow carry concept headings
    and statements marked with a hollow bullet (core learning objectives; read from the image)."""
    from markers import marker_left_of
    W, H = d['w'], d['h']
    pp = printed_page(d)
    raw = [b for b in d['lines'] if b[1] < H * 0.93 and not (b[1] > H * 0.9 and re.fullmatch(r'\d{1,3}', b[5].strip()))]
    lines = [l for l in make_lines(raw, W) if not re.match(r'^Unit\s+\S+\s+Foundational Objectives|^Unit\s+\S+:\s*Foundational Objectives', l['text'])]
    out = []
    buf = []

    def flush():
        nonlocal buf
        if not buf:
            return
        for ln in buf:
            mk = marker_left_of(cid, page, ln['x0'], ln['y0'], ln['y1'], inside=True)
            ln['marker'] = mk
            if mk in ('filled', 'hollow') and not ln['glyph']:
                ln['glyph'] = '●' if mk == 'filled' else '○'
        if state.get('mode') == 'fo':
            it = {'lines': buf, 'glyph': None, 'subs': [], 'text': join_lines([l['text'] for l in buf]), 'minScore': min(l['score'] for l in buf)}
            out.append(item_out(it, 'foundational', page, pp, label=f"Foundational Objective {state['n']}", level='unit'))
            state['mode'] = 'core'          # what follows the statement belongs to its core concepts
        else:
            for it in nest(segment(buf, KNOW), KNOW, concept_heading):
                if concept_heading(it) and not it['subs']:
                    state['concept'] = it['text']
                    continue
                mk = it['lines'][0].get('marker')
                out.append(item_out(it, 'learning', page, pp, concept=state.get('concept'), foundationalObjective=state.get('n'),
                                    marker=mk if mk in ('filled', 'hollow') else None, core=True if mk == 'hollow' else None, level='unit-summary'))
        buf = []

    for ln in lines:
        t = ln['text']
        m = FO_N.match(t)
        if m:
            flush(); state['mode'] = 'fo'; state['n'] = int(m.group(1)); state['concept'] = None
            continue
        if re.fullmatch(r'Core Concepts', t):
            flush(); state['mode'] = 'core'
            continue
        if state.get('mode') == 'fo' and buf and ends_terminal(buf[-1]['text']) and ln['y0'] - buf[-1]['y1'] > 25:
            flush()                          # paragraph gap after the statement
        buf.append(ln)
    flush()
    return out

UNIT_TITLE = re.compile(r'^Unit\s+(One|Two|Three|Four|Five|Six|I{1,3}|IV|V|VI|\d)\b\s*[:.]?\s*(.*)$', re.I)


def unit_key(word):
    w = word.lower()
    return WORDNUM.get(w) or (int(w) if w.isdigit() else None)


def parse_course(cid, name, levels, site_units, extra_notes=(), tables=True):
    N = npages(cid)
    units, course_items, notes = [], [], list(extra_notes)
    unit = None
    in_clo, clo_state = False, {}
    in_h30, h30_state = False, {}
    deskewed, skipped = [], []
    pages_used = set()
    for p in range(1, N + 1):
        d = load(cid, p)
        if d is None:
            notes.append(f"Page {p}: not OCRed; skipped.")
            continue
        W, H = d['w'], d['h']
        if d.get('deskew'):
            deskewed.append((p, d['deskew']))
        if d.get('skipped'):
            skipped.append(p)
            continue
        top = make_lines([b for b in d['lines'] if b[1] < H * 0.12], W)
        toptext = ' '.join(l['text'] for l in top[:3])
        first = top[0]['text'] if top else ''
        # unit foundational objectives page
        m = re.match(r'^Unit\s+(\S+?)[:.]?\s+(?:Foundation(?:al)? Objectives)', toptext)
        if m:
            k = unit_key(m.group(1).rstrip(':'))
            unit = next((u for u in units if u['_n'] == k), None)
            if unit is None:
                unit = {'name': None, '_n': k, 'items': []}
                units.append(unit)
            if any(FO_N.match(b[5].strip()) for b in d['lines']):
                h30_state = {}
                items = parse_h30_page(cid, d, p, h30_state, notes)
                unit['items'].extend(items); pages_used.add(p)
                unit.setdefault('foundationalPages', []).append(p)
                in_h30 = True
                continue
            items, heading, nn, pp = parse_fo_page(d, p, 'unit')
            unit['items'].extend(items); notes += nn; pages_used.add(p)
            unit.setdefault('foundationalPages', []).append(p)
            continue
        if re.search(r'Foundational Objectives', first) and not re.match(r'^Unit', first) and not re.search(r'^Organization|Assessment', first) and not unit:
            items, heading, nn, pp = parse_fo_page(d, p, 'course')
            if items:
                hd = ' '.join(heading)
                for it in items:
                    it['heading'] = hd
                course_items.extend(items); notes += nn; pages_used.add(p)
            continue
        if in_h30:
            if is_left_table(d) or is_right_table(d) or re.match(r'^(Unit|Concept Map|Core Material|Content)', first):
                in_h30 = False
            else:
                items = parse_h30_page(cid, d, p, h30_state, notes)
                unit['items'].extend(items); pages_used.add(p)
                unit['foundationalPages'].append(p)
                continue
        # 1997 guides: Core Learning Objectives summary pages
        mc = re.match(r'^Unit\s+(\S+?)[:.]?\s+(.*?)\s*Core Learning Objectives', toptext)
        if mc:
            k = unit_key(mc.group(1).rstrip(':'))
            unit = next((u for u in units if u['_n'] == k), None)
            if unit is None:
                unit = {'name': None, '_n': k, 'items': []}
                units.append(unit)
            if mc.group(2).strip(' :') and not unit['name']:
                unit['name'] = f"Unit {mc.group(1).rstrip(':')}: {mc.group(2).strip(' :')}"; unit['nameSource'] = f'page {p}'
            clo_state = {'domain': 'knowledge'}
            items = parse_clo_page(cid, d, p, clo_state, notes)
            unit['items'].extend(items); pages_used.add(p)
            unit.setdefault('coreLearningObjectivePages', []).append(p)
            in_clo = True
            continue
        if in_clo:
            if is_left_table(d) or is_right_table(d) or re.match(r'^(Unit|Concept Map|Core Material)', first):
                in_clo = False
            else:
                items = parse_clo_page(cid, d, p, clo_state, notes)
                unit['items'].extend(items); pages_used.add(p)
                unit['coreLearningObjectivePages'].append(p)
                continue
        # unit overview / title pages give the unit's printed name
        mt = UNIT_TITLE.match(first)
        if mt and unit_key(mt.group(1)) is not None and not re.search(r'Unit\s+\S+\s+Unit', first) and (top[0]['x0'] < W * 0.3 or len(d['lines']) <= 4 or re.fullmatch(r'Unit\s+\S+', first.strip())):
            k = unit_key(mt.group(1))
            u = next((u for u in units if u['_n'] == k), None)
            if u is None:
                u = {'name': None, '_n': k, 'items': []}
                units.append(u)
            rest = mt.group(2).strip()
            allt = make_lines(d['lines'], W)
            if not rest and len(allt) > 1 and not re.search(r'Foundational|Overview|Concept Map|Core Material|Objectives', allt[1]['text']):
                rest = allt[1]['text'].strip()
                site = site_units[k - 1] if k and 1 <= k <= len(site_units) else ''
                for j in range(2, min(5, len(allt)) + 1):
                    cand = ' '.join(l['text'].strip() for l in allt[1:j])
                    if re.sub(r'[^a-z]', '', cand.lower()) == re.sub(r'[^a-z]', '', site.lower()):
                        rest = cand
                        break
            rest = re.sub(r'[:\s]*(Overview|Foundational Objectives|Core Learning Objectives)$', '', rest).strip(' :')
            if rest and not u['name'] and not re.search(r'Concept Map|^Unit', rest):
                u['name'] = f"Unit {mt.group(1)}: {rest}"
                u['nameSource'] = f'page {p}'
            unit = u
        if tables and unit is not None and (is_left_table(d) or is_right_table(d)):
            items = table_items(d, p, unit, notes)
            unit['items'].extend(items)
            if items:
                pages_used.add(p)
    for u in units:
        u.pop('_concept', None)
        k = u.pop('_n')
        u['_sort'] = k
        if k and 1 <= k <= len(site_units):
            u['siteUnitName'] = site_units[k - 1]
        if not u['name']:
            u['name'] = f"Unit {k}"
            u['nameSource'] = 'unit number only; no printed unit title was read'
    # flag items whose boundaries look doubtful (fragments split off by the heuristics)
    nflag = 0
    for u in units + [{'items': course_items}]:
        for it in u['items']:
            t = it['text'].split(chr(10))[0]
            last = it['text'].rstrip()
            if (not re.search(r'[.?!;:,]["”’)]?$', last) and not re.search(r'\b(and|or)$', last)) or (t[:1].islower() and it.get('level') != 'course' and it.get('domain') == 'knowledge'):
                it['segmentationUncertain'] = True
                nflag += 1
    notes.insert(0, 'Method: page images OCRed with RapidOCR (PP-OCRv6 det/rec small, 200 dpi). Lines are grouped into columns by the table header positions, then split into items by: a list marker, a line ending in . ; : ? !, a line ending in "; and"/"; or", or a line that ends early (the next line’s first word would have fitted). Lines after an item ending in ":" are kept as its sub-list (lines starting "- "). Text is the OCR reading with no correction; hyphenated line breaks are rejoined.')
    notes.insert(1, f'{nflag} items are marked segmentationUncertain (no closing punctuation, or a knowledge objective that does not start with a capital): they may be a fragment of the item before or after.')
    notes.insert(2, 'Items with ocrLowConfidence have at least one OCR line scored below 0.85, or a line that ran across two table columns and was split at the column edge.')
    notes.insert(3, 'Core vs optional: the guides print core material in bold. Bold is not detected here, so content-table items are not marked core/optional.')
    if deskewed:
        notes.append('Pages scanned at a slant were straightened and OCRed again (page, degrees): ' + ', '.join(f'{p} ({a})' for p, a in deskewed) + '.')
    if skipped:
        notes.append('Pages not recognised in full because their header showed no objectives (concept maps, core-material tables, activity guides, appendices, blank pages): ' + ', '.join(map(str, skipped)) + '.')
    allunits = []
    if course_items:
        allunits.append({'name': None, 'scope': 'course', 'note': 'Course-level foundational objectives (not part of any unit).', 'items': course_items})
    units.sort(key=lambda u: (u.get('_sort') or 99))
    for u in units:
        u.pop('_sort', None)
    allunits += units
    nF = sum(1 for u in allunits for i in u['items'] if i['type'] == 'foundational')
    nL = sum(1 for u in allunits for i in u['items'] if i['type'] == 'learning')
    obj = {'curriculumId': cid, 'name': name, 'levels': levels,
           'source': {**source(cid), 'pages': sorted(pages_used),
                      'pageNumbering': 'page = 1-based PDF page; printedPage = the number printed on the page (units restart at 101, 201, ...)'},
           'kind': 'objectives',
           'text': 'OCR (RapidOCR PP-OCRv6, 200 dpi) of a scanned image-only PDF; see notes',
           'counts': {'units': len(units), 'foundational': nF, 'learning': nL,
                      'courseFoundational': len(course_items)},
           'units': allunits, 'notes': notes}
    return obj


if __name__ == '__main__':
    import argparse
    sys.stdout.reconfigure(encoding='utf-8')
    cid = int(sys.argv[1])
    import subprocess
    meta = json.load(open(os.path.join(ROOT, 'out', 'meta.json'), encoding='utf8'))[str(cid)]
    extra = list(meta.get('notes', []))
    tables = True
    if cid == 175:
        extra.append('This 1997 guide has no separate foundational-objectives pages. Each unit has "Core Learning Objectives" summary pages (level "unit-summary") where, by the printed legend, a solid bullet marks a foundational objective of the course and a hollow bullet a core learning objective. Bullets were read from the page image (markers.py: shape and centre fill), not from the OCR text: type "foundational" = solid bullet, "core": true = hollow bullet, "marker" keeps the reading. Bullets that could not be read leave the item as type "learning" without "core". Spot checks on Unit One matched the page, but a few bullets were missed.')
        extra.append('Concept labels in the left margin of those pages are in "concept"; indented sub-concept headings (e.g. "Burden of proof") are in "subConcept". The content tables that follow give the full learning objectives (level absent).')
    if cid == 182:
        tables = False
        extra.append('Objectives-only OCR (ocrclo.py): to save time only the "Unit X: Foundational Objectives" pages (and front matter) were recognised in full, so this file has the foundational objectives and the core-concept statements printed under them, but not the learning objectives of the content tables. The content tables (pages headed "Concepts (Knowledge Objectives) | Content" and "Skills/Abilities | Values Objectives | Suggested Teaching ...") can be added by OCRing them and running the table parser used for History 20.')
        extra.append('Core-concept statements are printed with a hollow bullet; "core": true marks those where the bullet was read from the page image.')
    obj = parse_course(cid, meta['name'], meta['levels'], meta['siteUnits'], extra, tables)
    print(write(cid, obj), obj['counts'])
    for u in obj['units']:
        print(' ', u['name'], '|', u.get('siteUnitName'), '|', sum(1 for i in u['items'] if i['type'] == 'foundational'), sum(1 for i in u['items'] if i['type'] == 'learning'))

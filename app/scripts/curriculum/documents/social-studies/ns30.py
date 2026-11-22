# Native Studies 30: Canadian Studies (1997). Per unit: a "Foundational Objectives" page (two
# columns; Knowledge, Values, Skills/Processes; each objective ends with C.E.L. tags such as
# "(PSVS) (CCT)"), then two-page spreads whose left page has "Learning Objectives" (narrow left
# column, "Students will:" lists under Knowledge / Values / Skills/Processes) beside
# "Instructional Notes" opening with "Key Understanding: ...". OCR files from ocrclo.py.
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from common import *
from guide90s import load, npages, make_lines, segment, nest, item_out, printed_page

CID = 181
TAGS = re.compile(r'(\((?:C|CCT|PSVS|IL|TL|NUM|N)\)\s*)+$')
SEC = re.compile(r'^(Knowledge|Values|Skills/Processes|Skills|Processes)$')
UNIT = re.compile(r'^(OPTIONAL|Optional)?\s*(Introductory Unit|Unit (One|Two|Three|Four|Five)\s*:?)\s*(.*)$')
meta = json.load(open(os.path.join(ROOT, 'out', 'meta.json'), encoding='utf8'))[str(CID)]
units, notes, used = [], [], set()
unit = None
N = npages(CID)


def seg_tagged(lines):
    """Items end at a line ending with C.E.L. tags. A line holding only tags belongs to the item
    before it; a capitalised line after a line ending in a full stop starts a new item."""
    items, cur = [], []
    for l in lines:
        t = l['text']
        if re.fullmatch(r'(\((?:C|CCT|PSVS|IL|TL|NUM|N)\)\s*)+', t):
            if cur:
                cur.append(l)
                items.append(cur); cur = []
            elif items:
                items[-1].append(l)
            continue
        if cur and cur[-1]['text'].rstrip().endswith('.') and t[:1].isupper():
            items.append(cur); cur = []
        cur.append(l)
        if TAGS.search(t):
            items.append(cur); cur = []
    if cur:
        items.append(cur)
    return items


for p in range(1, N + 1):
    d = load(CID, p)
    if d is None or d.get('skipped'):
        # unit title pages were not OCRed in full when the header starts with the unit title's
        # second line; the header band still names the unit
        if d is not None and units:
            ht = ' '.join(b[5] for b in sorted(d.get('head', []), key=lambda b: (b[1], b[0])))
            m = re.search(r'(Unit (One|Two|Three|Four|Five))\s*:', ht)
            if m and len(d.get('head', [])) <= 6 and units[-1]['_key'] != m.group(1):
                unit = {'_key': m.group(1), 'name': m.group(1), 'nameSource': f'page {p} (header band)', 'items': []}
                units.append(unit)
        continue
    W, H = d['w'], d['h']
    pp = printed_page(d)
    boxes = [b for b in d['lines'] if b[1] < H * 0.93 and not re.fullmatch(r'\d{1,3}', b[5].strip())]
    alllines = make_lines(boxes, W)
    toptxt = ' '.join(l['text'] for l in alllines[:4])
    mu = re.search(r'(Introductory Unit|Unit (One|Two|Three|Four|Five))', toptxt)
    if mu and not re.search(r'Learning Objectives|Planning', toptxt) and (units or 'Introductory Unit' in toptxt):
        key = mu.group(1)
        if not units or units[-1]['_key'] != key:
            # the unit name is the line(s) after "Unit X:" on the title page
            rest = []
            for l in alllines[:6]:
                if re.search(r'Unit (One|Two|Three|Four|Five)|Introductory Unit|^OPTIONAL$|^Optional$', l['text']):
                    continue
                rest.append(l['text'])
            unit = {'_key': key, 'name': key, 'nameSource': f'page {p}', 'items': []}
            units.append(unit)
        if not re.search(r'Foundational Objectives', toptxt):
            continue
    if unit is None:
        continue
    if re.search(r'Foundational Objectives', toptxt):
        used.add(p)
        mid = W * 0.5
        left = make_lines([b for b in boxes if b[0] < mid], W)
        right = make_lines([b for b in boxes if b[0] >= mid], W)
        sec, stem = None, None
        stream = left + right
        buf = []

        def flush_fo():
            global buf
            for grp in seg_tagged(buf):
                t = join_lines([l['text'] for l in grp])
                it = {'code': None, 'type': 'foundational', 'text': t, 'page': p, 'printedPage': pp, 'domain': sec}
                sc = min(l['score'] for l in grp)
                if sc < 0.85:
                    it['ocrLowConfidence'] = round(sc, 2)
                if not TAGS.search(t):
                    it['segmentationUncertain'] = True
                unit['items'].append(it)
            buf = []
        for l in stream:
            t = l['text']
            if t == 'Foundational Objectives' or re.match(r'^The foundational objectives are to guide|^students to achievement', t):
                continue
            if SEC.match(t):
                flush_fo(); sec = t.lower()
                continue
            if sec is None:
                continue                      # lead-in sentence before the first heading
            buf.append(l)
        flush_fo()
        continue
    if re.search(r'Learning Objectives', toptxt):
        used.add(p)
        hdr = [b for b in boxes if b[1] < H * 0.09]
        ins = [b for b in hdr if re.search(r'Instructional Notes', b[5])]
        lo = [b for b in hdr if re.search(r'Learning Objectives', b[5])]
        if not lo:
            continue
        lo_left = lo[0][0] < (ins[0][0] if ins else W)
        # the learning objectives column is the narrow one under its heading; the notes column
        # starts where "Key Understanding:" starts
        ku = [b for b in boxes if b[5].strip().startswith('Key Understanding')]
        if lo_left:
            bound = (ku[0][0] - 20) if ku and ku[0][0] > W * 0.25 else W * 0.37
        else:
            bound = lo[0][0] - 30
        if lo_left:
            col = [b for b in boxes if b[0] < bound and b[1] > H * 0.07]
            other = [b for b in boxes if b[0] >= bound]
        else:
            col = [b for b in boxes if b[0] >= bound and b[1] > H * 0.07]
            other = [b for b in boxes if b[0] < bound]
        ol = make_lines(other, W)
        key = None
        for i, l in enumerate(ol):
            if l['text'].startswith('Key Understanding:'):
                ks = [l]
                for m2 in ol[i + 1:]:
                    if m2['y0'] - ks[-1]['y1'] > 25:
                        break
                    ks.append(m2)
                key = join_lines([x['text'] for x in ks])
                break
        lines = [l for l in make_lines(col, W) if l['text'] != 'Learning Objectives']
        sec, stem, buf = None, None, []

        def flush_lo():
            global buf
            for it in nest(segment(buf)):
                o = item_out(it, 'learning', p, pp, domain=sec, stem=stem, keyUnderstanding=key)
                unit['items'].append(o)
            buf = []
        for l in lines:
            t = l['text']
            if SEC.match(t):
                flush_lo(); sec = t.lower(); stem = None
                continue
            if re.match(r'^Students will:?$', t):
                flush_lo(); stem = t
                continue
            buf.append(l)
        flush_lo()
for u in units:
    u.pop('_key', None)
site = meta['siteUnits']
for u in units:
    m = re.match(r'Unit (One|Two|Three|Four|Five)', u['name'])
    k = {'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5}.get(m.group(1)) if m else None
    if k and k <= len(site):
        u['siteUnitName'] = site[k - 1]
        u['name'] = f"{u['name']}: {site[k - 1]}"
        u['nameSource'] += '; unit title after the colon is taken from the guide\'s contents/bookmarks, which match the site name'
    elif u['name'] == 'Introductory Unit':
        u['name'] = 'Introductory Unit (optional)'
items = [i for u in units for i in u['items']]
nF = sum(1 for i in items if i['type'] == 'foundational')
nL = sum(1 for i in items if i['type'] == 'learning')
skipped = [p for p in range(1, N + 1) if (load(CID, p) or {}).get('skipped')]
notes = [
    'OCR (RapidOCR PP-OCRv6, 200 dpi) of a scanned image-only PDF. To save time only pages whose header names objectives (and the pages that follow them) were recognised in full; the other ' + str(len(skipped)) + ' pages (suggested instructional approaches, resources, front matter) were not.',
    'Foundational objectives: the unit "Foundational Objectives" page, read left column then right column. Each objective ends with the C.E.L. tags printed after it, e.g. "(PSVS) (CCT)"; an item without tags is marked segmentationUncertain.',
    'Learning objectives: the "Learning Objectives" column of each spread ("Students will:" lists). keyUnderstanding is the "Key Understanding:" line that opens the Instructional Notes beside them.',
    'Some learning objectives are printed with a solid bullet in the guide; the bullet is not recorded.',
    'Unit names: the bookmarks name the units "Introductory Unit: Native Studies 30: Canadian Studies", "Unit One: Aboriginal and Treaty Rights", "Unit Two: Governance", "Unit Three: Land Claims and Treaty Land Entitlements", "Unit Four: Economic Development", "Unit Five: Social Development".',
] + notes
obj = {'curriculumId': CID, 'name': meta['name'], 'levels': meta['levels'],
       'source': {**source(CID), 'pages': sorted(used), 'pageNumbering': 'page = 1-based PDF page; printedPage = the number printed on the page'},
       'kind': 'objectives', 'counts': {'units': len(units), 'foundational': nF, 'learning': nL},
       'units': units, 'notes': notes}
print(write(CID, obj), obj['counts'])
for u in units:
    print(' ', u['name'], sum(1 for i in u['items'] if i['type'] == 'foundational'), sum(1 for i in u['items'] if i['type'] == 'learning'))

# Cross-check OCR item text against the PDF's own (Acrobat Paper Capture) text layer, page by page.
import sys, os, re, json, fitz
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from common import *
from difflib import SequenceMatcher
cid = int(sys.argv[1])
obj = json.load(open(os.path.join(ROOT, f'{cid}.json'), encoding='utf8'))
doc = fitz.open(pdf_path(cid))
N = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
cache = {}
exact = near = miss = 0
worst = []
for u in obj['units']:
    for it in u['items']:
        p = it['page']
        if p not in cache:
            cache[p] = N(doc[p - 1].get_text())
        t = N(it['text'].replace('\n- ', ' '))
        if not t:
            continue
        if t in cache[p]:
            exact += 1; it['textLayerCheck'] = 'exact'
            continue
        sm = SequenceMatcher(None, t, cache[p], autojunk=False)
        m = sm.find_longest_match(0, len(t), 0, len(cache[p]))
        # best local alignment ratio over a window
        a = max(0, m.b - m.a)
        win = cache[p][a:a + len(t) + 20]
        r = SequenceMatcher(None, t, win, autojunk=False).ratio()
        if r >= 0.9:
            near += 1; it['textLayerCheck'] = f'near:{r:.2f}'
        else:
            miss += 1; it['textLayerCheck'] = f'differs:{r:.2f}'
            worst.append((r, p, it['text'][:100]))
obj.setdefault('qualityChecks', {})['textLayerCrossCheck'] = {'exact': exact, 'near(>=0.90)': near, 'differs': miss,
    'meaning': 'Each item (letters and digits only, lower-cased) looked up in the PDF\'s own Acrobat OCR text layer of the same page. exact = found verbatim; near = similar; differs = the two OCRs disagree or the item spans text the other OCR read differently.'}
write(cid, obj)
print(cid, 'exact', exact, 'near', near, 'differs', miss)
for w in sorted(worst)[:12]:
    print('  ', round(w[0], 2), w[1], w[2])

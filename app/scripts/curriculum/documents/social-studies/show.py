# Print OCR pages as positioned lines. Usage: python show.py <cid> <from> [to] [--grep word]
import sys, os, json, glob
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
cid, a = sys.argv[1], int(sys.argv[2])
b = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else a
xs = '--x' in sys.argv
for p in range(a, b + 1):
    f = os.path.join(ROOT, 'out', 'ocr', cid, f'p{p:03d}.json')
    if not os.path.exists(f):
        print(f'--- page {p}: not OCRed yet'); continue
    d = json.load(open(f, encoding='utf8'))
    print(f'=========== {cid} page {p} ({d["w"]}x{d["h"]})')
    lines = sorted(d['lines'], key=lambda l: (l[1], l[0]))
    # group into rows by y overlap
    rows = []
    for l in lines:
        if rows and abs(l[1] - rows[-1][0][1]) < 14:
            rows[-1].append(l)
        else:
            rows.append([l])
    for r in rows:
        r.sort(key=lambda l: l[0])
        if xs:
            print(f'y{r[0][1]:<5}' + '  '.join(f'[{l[0]}]{l[5]}' + ('' if l[4] > 0.8 else f'(?{l[4]})') for l in r))
        else:
            print(' | '.join(l[5] for l in r))

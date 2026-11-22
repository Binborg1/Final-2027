# Objectives-only OCR for the 1997 guides (History 30, Native Studies 30), to save time.
#   python ocrclo.py <outdir> <pdf>
# Every page gets a header-band OCR (top 16%). A page is recognised in full only when its header
# names objectives ("Core Learning Objectives", "Foundational Objectives", "Learning Objectives"),
# a unit title, or when it follows such a page and is not a content table / concept map / core
# material page (summary lists run over several pages). Other pages are stored with "skipped": true.
import sys, os, json, re, time, fitz, numpy as np, cv2
from rapidocr import RapidOCR
sys.stdout.reconfigure(encoding='utf-8')
outdir, pdf = sys.argv[1], sys.argv[2]
CONT = "--nocont" not in sys.argv
eng = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": 2, "Global.use_cls": False})
stem = os.path.basename(pdf).split('_')[0]
od = os.path.join(outdir, stem); os.makedirs(od, exist_ok=True)
d = fitz.open(pdf)


def ocr(img, x_off=0, y_off=0):
    r = eng(cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))
    out = []
    if r.boxes is not None:
        for box, txt, sc in zip(r.boxes, r.txts, r.scores):
            xs = [float(b[0]) + x_off for b in box]; ys = [float(b[1]) + y_off for b in box]
            out.append([round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)), round(float(sc), 3), txt])
    return out


WANT = re.compile(r'Core Learning Objectives|Foundational Objectives|Learning Objectives|^Unit\b|Introductory Unit|Knowledge Concepts|Skills/Abilities Concepts|Values Concepts', re.I)
STOP = re.compile(r'^(Content|Concepts\s*\(Knowledge|Values Objectives|Skills/Abilities|Concept Map|Core Material|Suggested|Activity|Appendix|References)', re.I)
cont = False
t0 = time.time()
for i in range(d.page_count):
    of = os.path.join(od, f"p{i+1:03d}.json")
    if os.path.exists(of):
        prev = json.load(open(of, encoding='utf8'))
        cont = bool(prev.get('lines')) and not prev.get('skipped') and bool(WANT.search(' '.join(l[5] for l in prev.get('head', prev['lines'])[:3])) or cont)
        continue
    pix = d[i].get_pixmap(dpi=200, colorspace=fitz.csGRAY)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    H, W = img.shape
    head = ocr(img[:int(H * 0.16)].copy())
    hs = sorted(head, key=lambda b: (b[1], b[0]))
    first = ' '.join(b[5] for b in hs[:3])
    want = bool(WANT.search(first))
    if want or (CONT and cont and hs and not STOP.search(hs[0][5]) and not re.search(r'Content.*Concepts|Skills.*Values.*Suggest', first)):
        lines = ocr(img)
        rec = {"page": i + 1, "w": W, "h": H, "crop": None, "head": head, "lines": lines}
        cont = True
    else:
        rec = {"page": i + 1, "w": W, "h": H, "crop": None, "head": head, "lines": head, "skipped": True}
        cont = False
    with open(of + ".tmp", "w", encoding="utf8") as f:
        json.dump(rec, f, ensure_ascii=False)
    os.replace(of + ".tmp", of)
    if (i + 1) % 25 == 0:
        print(stem, i + 1, round(time.time() - t0), flush=True)
print(stem, 'finished', round(time.time() - t0), flush=True)

# Find skewed scanned pages and re-OCR them straightened.
#   python deskew.py <cid> [--fix] [--min 0.35]
# Skew is estimated on a 60-dpi rendering by maximising the variance of the row projection
# over angles -3..3 degrees. With --fix, pages above the threshold are rotated at 200 dpi and
# OCRed again (same crop rules as ocrsmart.py); the old page file is kept as pNNN.orig.json and
# the new file records "deskew": angle. Coordinates in the new file refer to the straightened page.
import sys, os, json, re, glob, fitz, numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from common import pdf_path, ROOT

cid = int(sys.argv[1])
FIX = '--fix' in sys.argv
TH = float(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 0.35
doc = fitz.open(pdf_path(cid))


def skew_of(img):
    b = (img < 140).astype(np.float32)
    h, w = b.shape
    best, ang = -1, 0.0
    for a in np.arange(-3, 3.01, 0.1):
        M = cv2.getRotationMatrix2D((w / 2, h / 2), a, 1.0)
        r = cv2.warpAffine(b, M, (w, h), flags=cv2.INTER_NEAREST)
        v = r.sum(axis=1).var()
        if v > best:
            best, ang = v, a
    return round(float(ang), 1)


def rotate(img, a):
    h, w = img.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), a, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderValue=255)


skewed = []
for f in sorted(glob.glob(os.path.join(ROOT, 'out', 'ocr', str(cid), 'p[0-9][0-9][0-9].json'))):
    d = json.load(open(f, encoding='utf8'))
    if d.get('skipped') or d.get('deskew') is not None or len(d['lines']) < 6:
        continue
    p = d['page']
    pix = doc[p - 1].get_pixmap(dpi=60, colorspace=fitz.csGRAY)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    a = skew_of(img)
    if abs(a) >= TH:
        skewed.append((p, a))
print(cid, 'skewed pages', len(skewed), skewed)
if not FIX:
    sys.exit(0)
from rapidocr import RapidOCR
eng = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": 2, "Global.use_cls": False})


def ocr(img, x_off=0, y_off=0):
    r = eng(cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))
    out = []
    if r.boxes is not None:
        for box, txt, sc in zip(r.boxes, r.txts, r.scores):
            xs = [float(q[0]) + x_off for q in box]; ys = [float(q[1]) + y_off for q in box]
            out.append([round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)), round(float(sc), 3), txt])
    return out


for p, a in skewed:
    f = os.path.join(ROOT, 'out', 'ocr', str(cid), f'p{p:03d}.json')
    old = json.load(open(f, encoding='utf8'))
    pix = doc[p - 1].get_pixmap(dpi=200, colorspace=fitz.csGRAY)
    img = rotate(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w).copy(), a)
    H, W = img.shape
    band = int(H * 0.16)
    head = ocr(img[:band].copy())
    htxt = ' '.join(l[5] for l in head)
    crop = None
    concepts = [l for l in head if re.search(r'Concepts', l[5]) and l[0] > W * 0.3]
    suggested = [l for l in head if re.search(r'Suggest', l[5]) and l[0] > W * 0.3]
    if re.search(r'Content', htxt) and concepts:
        crop = [max(0, concepts[0][0] - 40), 0, W, H]
    elif re.search(r'Skills', htxt) and re.search(r'Values', htxt) and suggested:
        crop = [0, 0, min(W, suggested[0][0] - 12), H]
    lines = ocr(img[:, crop[0]:crop[2]].copy(), crop[0], 0) if crop else ocr(img)
    os.replace(f, f.replace('.json', '.orig.json'))
    with open(f, 'w', encoding='utf8') as fh:
        json.dump({'page': p, 'w': W, 'h': H, 'crop': crop, 'head': head, 'lines': lines, 'deskew': a}, fh, ensure_ascii=False)
    print('re-OCRed', p, a, len(lines))

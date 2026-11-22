# Faster OCR for the 1990s Saskatchewan social studies guides. Usage:
#   python ocrsmart.py <worker> <nworkers> <outdir> <pdf>...
# Reads the page header first. On a two-page content-table spread only the objective
# columns are recognised:
#   left page  "Content | Concepts (Knowledge Objectives)"  -> from the Concepts column to the right edge
#   right page "Skills/Abilities Objectives | Values Objectives | Suggested Teaching ..." -> left edge to the Suggested column
# Every other page is recognised in full. Output format is the same as ocrbatch.py, plus "crop".
import sys, os, json, time, re, fitz, numpy as np, cv2
from rapidocr import RapidOCR
sys.stdout.reconfigure(encoding='utf-8')
args = [a for a in sys.argv[1:] if not a.startswith("--")]
SKIP = "--skip" in sys.argv
THREADS = 1 if "--t1" in sys.argv else 2
k, n, outdir = int(args[0]), int(args[1]), args[2]
pdfs = args[3:]
eng = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": THREADS, "Global.use_cls": False})
DPI = 200


def ocr(img, x_off=0, y_off=0):
    r = eng(cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))
    out = []
    if r.boxes is not None:
        for box, txt, sc in zip(r.boxes, r.txts, r.scores):
            xs = [float(b[0]) + x_off for b in box]; ys = [float(b[1]) + y_off for b in box]
            out.append([round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)), round(float(sc), 3), txt])
    return out


jobs = []
for p in pdfs:
    d = fitz.open(p)
    stem = os.path.basename(p).split('_')[0]
    for i in range(d.page_count):
        jobs.append((p, stem, i))
mine = jobs[k::n]
t0 = time.time(); done = 0
docs = {}
for p, stem, i in mine:
    od = os.path.join(outdir, stem); os.makedirs(od, exist_ok=True)
    of = os.path.join(od, f"p{i+1:03d}.json")
    if os.path.exists(of):
        continue
    d = docs.get(p) or docs.setdefault(p, fitz.open(p))
    pix = d[i].get_pixmap(dpi=DPI, colorspace=fitz.csGRAY)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    H, W = img.shape
    band = int(H * 0.16)
    head = ocr(img[:band].copy())
    htxt = ' '.join(l[5] for l in head)
    crop = None
    concepts = [l for l in head if re.search(r'Concepts', l[5]) and l[0] > W * 0.3]
    suggested = [l for l in head if re.search(r'Suggest', l[5]) and l[0] > W * 0.3]
    if re.search(r'Content', htxt) and concepts:
        x = max(0, concepts[0][0] - 40)
        crop = [x, 0, W, H]
    elif re.search(r'Skills', htxt) and re.search(r'Values', htxt) and suggested:
        x = min(W, suggested[0][0] - 12)
        crop = [0, 0, x, H]
    # --skip: pages whose header shows they cannot hold objectives are not recognised in full
    NOSKIP = re.compile(r'Unit|Objective|Concept|Know|Learn|Apprecia|Skills|Values|Content|Foundational|Criteria|:')
    SKIPHEAD = re.compile(r'^(Concept Map|Core Material|Activity|Appendix|Learning Cycle|Lesson Planning|Unit Planning|Assessment Strategies|Bibliography|References|Acknowledg|Table of Contents|Teaching Controversial|Evaluation|Mastery Learning|Effective Teaching|Scope and Sequence|Resource-Based|Gender Equity|Indian and M)', re.I)
    first_head = ' '.join(l[5] for l in sorted(head, key=lambda b: (b[1], b[0]))[:2])
    if SKIP and not crop and (not head or (SKIPHEAD.search(first_head) and not re.search(r'Foundational|Core Learning', htxt))):
        with open(of + ".tmp", "w", encoding="utf8") as f:
            json.dump({"page": i + 1, "w": W, "h": H, "crop": None, "head": head, "lines": head, "skipped": True}, f, ensure_ascii=False)
        os.replace(of + ".tmp", of)
        done += 1
        continue
    if crop:
        # the column crop runs the full page height, so no line is cut at the header band
        x0, y0, x1, y1 = crop
        lines = ocr(img[y0:y1, x0:x1].copy(), x0, y0)
    else:
        lines = ocr(img)
    with open(of + ".tmp", "w", encoding="utf8") as f:
        json.dump({"page": i + 1, "w": W, "h": H, "crop": crop, "head": head, "lines": lines}, f, ensure_ascii=False)
    os.replace(of + ".tmp", of)
    done += 1
    if done % 25 == 0:
        print(k, stem, i + 1, done, round(time.time() - t0), flush=True)
print("worker", k, "finished", done, round(time.time() - t0), flush=True)

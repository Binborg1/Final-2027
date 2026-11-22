# OCR image-only PDF pages with RapidOCR. Usage: python ocrbatch.py <worker> <nworkers> <outdir> <pdf>...
# Writes <outdir>/<pdfstem>/p<NNN>.json : {"page":n,"w":..,"h":..,"lines":[[x0,y0,x1,y1,score,text],...]}
import sys, os, json, time, fitz, numpy as np, cv2
from rapidocr import RapidOCR
k, n, outdir = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
pdfs = sys.argv[4:]
eng = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": 2})
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
    if os.path.exists(of): continue
    d = docs.get(p) or docs.setdefault(p, fitz.open(p))
    pix = d[i].get_pixmap(dpi=200, colorspace=fitz.csGRAY)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    r = eng(img)
    lines = []
    if r.boxes is not None:
        for box, txt, sc in zip(r.boxes, r.txts, r.scores):
            xs = [float(b[0]) for b in box]; ys = [float(b[1]) for b in box]
            lines.append([round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys)), round(float(sc), 3), txt])
    with open(of + ".tmp", "w", encoding="utf8") as f:
        json.dump({"page": i+1, "w": pix.w, "h": pix.h, "lines": lines}, f, ensure_ascii=False)
    os.replace(of + ".tmp", of)
    done += 1
    if done % 25 == 0: print(k, stem, i+1, done, round(time.time()-t0), flush=True)
print("worker", k, "finished", done, round(time.time()-t0), flush=True)

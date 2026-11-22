import sys, time, fitz, numpy as np, cv2
sys.stdout.reconfigure(encoding='utf-8')
from rapidocr import RapidOCR
d = fitz.open(sys.argv[1]); pno = int(sys.argv[2])
for dpi, params in [(200, {}), (150, {}), (200, {"Det.limit_side_len": 1200, "Det.limit_type": "max"})]:
    eng = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": 2, **params})
    pix = d[pno-1].get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
    img = cv2.cvtColor(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w), cv2.COLOR_GRAY2BGR)
    t = time.time(); r = eng(img); el = time.time() - t
    print(dpi, params, round(el, 2), 'elapse', [round(x, 2) for x in r.elapse_list] if hasattr(r, 'elapse_list') else r.elapse, len(r.txts))
    print('   ', ' / '.join(r.txts[3:9]))

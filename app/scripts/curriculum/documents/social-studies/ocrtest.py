import sys, time, fitz, numpy as np
from rapidocr import RapidOCR
pdf, pno = sys.argv[1], int(sys.argv[2])
d = fitz.open(pdf)
pg = d[pno-1]
pix = pg.get_pixmap(dpi=int(sys.argv[3]) if len(sys.argv)>3 else 200, colorspace=fitz.csGRAY)
img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
import cv2
img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
eng = RapidOCR()
t=time.time(); r = eng(img); print('secs', round(time.time()-t,2), 'size', pix.w, pix.h)
for box, txt, sc in zip(r.boxes, r.txts, r.scores):
    print(int(box[0][0]), int(box[0][1]), round(float(sc),2), txt)

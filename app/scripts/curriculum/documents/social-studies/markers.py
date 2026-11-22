# Classify the list marker printed just left of a text line, from the page image (200 dpi, same
# coordinates as the OCR files): 'filled' (●), 'hollow' (○), 'dash' (-) or None.
import fitz, numpy as np, cv2
from functools import lru_cache
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import pdf_path


@lru_cache(maxsize=8)
def page_bin(cid, page):
    d = fitz.open(pdf_path(cid))
    pix = d[page - 1].get_pixmap(dpi=200, colorspace=fitz.csGRAY)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w).copy()
    # pages re-OCRed straightened (deskew.py) have coordinates on the rotated image
    import json
    from common import ROOT
    f = os.path.join(ROOT, 'out', 'ocr', str(cid), f'p{page:03d}.json')
    if os.path.exists(f):
        a = json.load(open(f, encoding='utf8')).get('deskew')
        if a:
            h, w = img.shape
            M = cv2.getRotationMatrix2D((w / 2, h / 2), a, 1.0)
            img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderValue=255)
    return (img < 128).astype(np.uint8)


def blobs(cid, page, x0, y0, x1, y1):
    b = page_bin(cid, page)
    H, W = b.shape
    x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(W, int(x1)), min(H, int(y1))
    if x1 <= x0 or y1 <= y0:
        return []
    sub = b[y0:y1, x0:x1]
    n, lab, stats, cent = cv2.connectedComponentsWithStats(sub, connectivity=8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        out.append({'x': x + x0, 'y': y + y0, 'w': int(w), 'h': int(h), 'area': int(area), 'fill': area / max(1, w * h)})
    return out


def marker_left_of(cid, page, line_x0, y0, y1, reach=70, inside=False):
    """Find a list marker at the start of a line: in the strip from line_x0-reach to line_x0+28 (the OCR
    box often includes the marker), at the height of the line's first row. A marker is a small
    roughly round blob followed by a gap of at least 9 px (letters such as 'o' are followed by the
    next letter). Filled vs hollow is read from the blob's centre."""
    b = page_bin(cid, page)
    top, bot = y0 - 4, min(y1, y0 + 45) + 4
    # the marker is inside the OCR box only when the OCR text itself starts with a glyph
    cands = blobs(cid, page, line_x0 - reach, top, line_x0 + 28, bot)
    allb = blobs(cid, page, line_x0 - reach, top, line_x0 + 80, bot)
    best = None
    for c in cands:
        w, h = c['w'], c['h']
        right = c['x'] + w
        nxt = [o for o in allb if o['x'] >= right - 1 and o is not c and o['x'] - right < 8 and not (o['y'] > c['y'] + h or o['y'] + o['h'] < c['y'])]
        if nxt:
            continue
        cy0 = c['y'] + h / 2
        if not (y0 + 2 <= cy0 <= y0 + 34):
            continue
        if 7 <= w <= 16 and 7 <= h <= 16 and 0.7 <= w / h <= 1.4:
            cx, cy = c['x'] + w // 2, c['y'] + h // 2
            box = b[c['y']:c['y'] + h, c['x']:c['x'] + w].astype(float)
            l, r = box[:, :w // 2].sum(), box[:, w - w // 2:].sum()
            t, bt = box[:h // 2].sum(), box[h - h // 2:].sum()
            sym = min(l, r) / max(1, max(l, r)) > 0.65 and min(t, bt) / max(1, max(t, bt)) > 0.65
            if not sym:
                continue
            centre = b[cy - 1:cy + 2, cx - 1:cx + 2].mean()
            kind = 'filled' if (centre > 0.6 and c['fill'] >= 0.68) else 'hollow' if (centre < 0.34 and 0.35 <= c['fill'] <= 0.78) else None
            if kind and (best is None or c['x'] > best[1]):
                best = (kind, c['x'])
        elif 7 <= w <= 30 and h <= 6 and w / max(1, h) >= 2.0:
            if best is None:
                best = ('dash', c['x'])
    return best[0] if best else None

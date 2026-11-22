"""Shared helpers for the Social Studies document extractions (OCR of scanned guides, text layer of the rest).

Copied from the Social Studies research of 2026-11-21 so the extraction can be reproduced. Inputs and outputs:

  sources.json, meta.json            committed here: each PDF's CurriculumFile URL, SHA-256 and filename; site unit names
  .cache/curriculum/sk/<key>.bin     the PDFs, fetched by the importer's polite cache (node scripts/curriculum/documents/pdftext.mjs <id>)
  .cache/curriculum/documents/social-studies/   working folder (not committed): pdf/, out/ocr/<cid>/pNNN.json, <cid>.json

Pipeline (Python 3 with PyMuPDF, numpy, opencv-python and rapidocr):
  python common.py                                   copy the cached PDFs into the working folder's pdf/
  python ocrsmart.py 0 1 <work>/out/ocr <work>/pdf/<cid>_*.pdf      full-page OCR (ocrclo.py: objectives pages only)
  python deskew.py <cid>                             where pages are skewed
  python guide90s.py <cid> | python run_old.py <cid> | python econ20.py | python ns10.py | python ns20.py | python ns30.py | python prelim.py <cid>
  node scripts/curriculum/documents/collect-research.mjs   normalise <work>/<cid>.json into src/data/curriculum/documents/
OCR output is not proofread: the importer marks these documents "document-ocr-unverified".
"""
import hashlib, json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
ROOT = os.environ.get('SOCIAL_STUDIES_WORKDIR') or os.path.join(APP, '.cache', 'curriculum', 'documents', 'social-studies')
CACHE = os.path.join(APP, '.cache', 'curriculum', 'sk')
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
SOURCES = json.load(open(os.path.join(HERE, 'sources.json'), encoding='utf8'))
# The extraction scripts read the site's unit names from <work>/out/meta.json.
if not os.path.exists(os.path.join(ROOT, 'out', 'meta.json')):
    shutil.copyfile(os.path.join(HERE, 'meta.json'), os.path.join(ROOT, 'out', 'meta.json'))

KEEP_HYPHEN = re.compile(r'(self|non|well|co|re|multi|cross|anti|pre|post|long|short|world|land|nation|first|two|one|three|four|five|Crown|inter|socio|semi|sub|mid|counter|over|under|decision|problem)-$', re.I)


def norm(s):
    s = s.replace('­', '').replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    s = re.sub(r'[ \t ]+', ' ', s)
    return s.strip()


def join_lines(lines):
    """Join wrapped lines with a space; rejoin a word broken by a hyphen at a line end
    (lower-case letter, hyphen, line break, lower-case letter) unless the first part is a
    common prefix that is normally hyphenated."""
    out = ''
    for l in lines:
        l = norm(l)
        if not l:
            continue
        if not out:
            out = l
            continue
        if re.search(r'[A-Za-z]-$', out):
            # a line ending in a hyphen: a word broken across lines, or a hyphenated compound
            if re.search(r'[a-z]-$', out) and re.match(r'[a-z]', l) and not KEEP_HYPHEN.search(out):
                out = out[:-1] + l      # broken word: drop the hyphen
            else:
                out = out + l           # compound (e.g. "Crown-Indigenous"): keep the hyphen, no space
        else:
            out = out + ' ' + l
    return out


def source(cid):
    s = SOURCES[str(cid)]
    return {"url": s["url"], "file": s["filename"], "sha256": s["sha256"], "retrievedOn": s["retrievedOn"], "bytes": s["bytes"]}


def pdf_path(cid):
    """The PDF in the working folder (pdf/<cid>_<filename>), copied from the importer's cache and checked against its hash."""
    s = SOURCES[str(cid)]
    dest = os.path.join(ROOT, 'pdf', f"{cid}_{s['filename']}")
    if not os.path.exists(dest):
        key = hashlib.sha256(s['url'].encode('utf8')).hexdigest()[:24]
        cached = os.path.join(CACHE, key + '.bin')
        if not os.path.exists(cached):
            raise SystemExit(f"{s['url']} is not cached: run node scripts/curriculum/documents/pdftext.mjs {cid}")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(cached, dest)
    digest = hashlib.sha256(open(dest, 'rb').read()).hexdigest()
    if digest != s['sha256']:
        raise SystemExit(f"{dest}: SHA-256 {digest} differs from {s['sha256']}: the document changed, re-extract and review.")
    return dest


def write(cid, obj):
    p = os.path.join(ROOT, f"{cid}.json")
    with open(p, 'w', encoding='utf8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    return p


if __name__ == '__main__':
    for cid in SOURCES:
        print(pdf_path(cid))

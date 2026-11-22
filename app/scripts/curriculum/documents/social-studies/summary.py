# Summarise the extracted files: python summary.py
import sys, os, json, glob
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rows = []
for f in sorted(glob.glob(os.path.join(ROOT, '*.json'))):
    o = json.load(open(f, encoding='utf8'))
    items = [i for u in o['units'] for i in u['items']]
    units = [u for u in o['units'] if u.get('scope') != 'course' and u.get('name') is not None]
    c = {}
    for i in items:
        c[i['type']] = c.get(i['type'], 0) + 1
    unc = sum(1 for i in items if i.get('segmentationUncertain'))
    low = sum(1 for i in items if i.get('ocrLowConfidence') or i.get('ocrSuspect'))
    x = o.get('qualityChecks', {}).get('textLayerCrossCheck')
    print(f"{o['curriculumId']:>4} {o['name'][:42]:<42} units={len(units):<2} " + ' '.join(f'{k}={v}' for k, v in sorted(c.items())) + f"  uncertain={unc} lowOCR={low}" + (f"  xcheck exact={x['exact']} near={x['near(>=0.90)']} differs={x['differs']}" if x else ''))
    print('      file', o['source'].get('file'), o['source']['sha256'][:16], o['source']['url'])

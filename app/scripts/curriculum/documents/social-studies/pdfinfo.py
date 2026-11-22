import sys, fitz
for p in sys.argv[1:]:
    d = fitz.open(p)
    n = d.page_count
    chars = [len(d[i].get_text()) for i in range(n)]
    imgs = sum(1 for i in range(min(n,20)) if d[i].get_images())
    print(p.split('/')[-1], 'pages', n, 'meta', {k:v for k,v in d.metadata.items() if v}, 'textchars first20', chars[:20], 'pages w/ images (first20)', imgs, 'empty pages', sum(1 for c in chars if c < 20))
    toc = d.get_toc()
    print(' toc entries', len(toc), toc[:40])

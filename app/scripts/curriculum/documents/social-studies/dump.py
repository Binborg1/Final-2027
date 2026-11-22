# Dump per-page text of a PDF: python dump.py <pdf> <out.txt>
import sys, fitz
d = fitz.open(sys.argv[1])
with open(sys.argv[2], 'w', encoding='utf8') as f:
    for i in range(d.page_count):
        f.write(f"\n=================== PAGE {i+1} ===================\n")
        f.write(d[i].get_text("text", sort=True))
print(d.page_count)

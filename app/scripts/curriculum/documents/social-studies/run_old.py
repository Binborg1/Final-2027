import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8')
from oldguide import build, npages
R = re.compile
which = sys.argv[1]
if which == '188':
    build(188,
          [{'pages': range(9, 18), 'start': R(r'^O\s*B\s*J\s*E\s*C\s*T\s*I\s*V\s*E?\s*S$'), 'stop': R(r'C\s*O\s*U\s*R\s*S\s*E\s*O\s*U\s*T\s*L\s*I\s*N\s*E|^INSTRUCTIONAL|^REFERENCES|^TEXT|^RECOMMENDED PROCEDURES')}],
          {'pages': range(18, npages(188) + 1), 'und_re': R(r'Understandings to be developed', re.I), 'stop_re': R(r'^\(b\)|^\(c\)|Suggested (organization|activities)', re.I)},
          [])
elif which == '189':
    build(189,
          [{'pages': range(4, 15), 'start': R(r'^O\s*B\s*J\s*E\s*C\s*T\s*I\s*V\s*E?\s*S$'), 'stop': R(r'^SPECIFIC OBJECTIVES|COURSE OUTLINE|^REFERENCES|^TEXT|^RECOMMENDED PROCEDURES')},
           {'pages': range(10, 16), 'start': R(r'^SPECIFIC OBJECTIVES'), 'stop': R(r'COURSE OUTLINE|^UNIT')}],
          {'pages': range(14, npages(189) + 1), 'und_re': R(r'UNDERSTANDINGS TO BE DEVELOPED', re.I), 'stop_re': R(r'SUGGESTED|^References', re.I), 'unit_upper': True, 'title_lines': 2},
          ['The guide treats Units I and II together ("UNIT I & II", one list of understandings); the site lists them as two units. Unit names after the colon are the region titles as printed, which differ in wording from the site names (siteUnitName).',
           'Unit III prints its understandings as a paragraph rather than a numbered list; Unit X has only a "Suggested organization of course content" outline, so it has no items.',
           'The PDF’s own Acrobat OCR text layer is poor (e.g. "Notth", "~lestern"); the page images were OCRed again. Remaining misreads include "1" for "l" (e.g. "Ski1ls").'])
elif which == '184':
    build(184,
          [{'pages': range(10, 14), 'start': R(r'^General Objectives of Economics 30'), 'stop': R(r'^To summarize|^CONTENT OVERVIEW')}],
          {'pages': range(32, npages(184) + 1), 'und_re': R(r'^Understandings$'), 'obj_re': R(r'^Objectives$'), 'stop_re': R(r'^(Content|Issues|Resources|Suggested|References)\b'), 'section_re': R(r'^[A-L]\.\s*\|?\s*\S'), 'title_next_line': False},
          ['Unit One is a review of Economics 20 and is printed as sections A-J, each with "Objectives", "Content" and "Understandings"; "section" gives the section heading as printed, including its Economics 20 unit reference.',
           'Units Two, Three and Four print only a numbered topic outline (topics, sub-topics, issues and resources) with no objectives or understandings, so they have no items here. The outline is on PDF pages 36-54 if it is wanted later.'])
if which == '190':
    build(190,
          [{'pages': range(1, 8), 'start': R(r'^OBJECTIVES OF GEOGRAPHICAL STUDIES'), 'stop': R(r'^RECOMMENDED PROCEDURES|COURSE OUTLINE')}],
          {'pages': range(10, npages(190) + 1), 'und_re': R(r'UNDERSTANDINGS TO BE DEVELOPED', re.I), 'stop_re': R(r'^Teacher References|^Student References', re.I), 'unit_upper': True, 'title_lines': 1},
          ['The six units of this 1969 tentative course outline print only a numbered topic outline (topics and sub-topics, with teacher and student references); there are no "Understandings to be developed" or unit objectives, so the units have no items. The outline is on PDF pages 10-18.',
           'The course objectives repeat, nearly word for word, those of Geography 10 (1964) and Geography 20 (1966).'])

"""
Builds the five Funza low-fidelity wireframe screens as SVG files, sized like the
desktop app (1280 x 800) plus a notes band, in the same grey-box style as the
printable sheet. Drag the SVGs onto a Figma canvas and they arrive as editable
frames, shapes and text (Figma maps the Nunito font family automatically).

Run:  python 00_build_wireframes.py
Out:  01_home.svg ... 05_ask_funza.svg next to this file.
"""
from __future__ import annotations

import html
import pathlib

INK, MUTED, LINE, LIGHT, PALE, WHITE = "#222222", "#777777", "#BBBBBB", "#E6E6E6", "#F5F5F5", "#FFFFFF"
FONT = "Nunito, Inter, 'Segoe UI', sans-serif"
W, H, NOTES_H = 1280, 800, 200
SIDEBAR_W = 256


class Svg:
    def __init__(self, title: str):
        self.title = title
        self.parts: list[str] = []

    # ---- primitives -------------------------------------------------------
    def rect(self, x, y, w, h, r=8, fill=WHITE, stroke=INK, sw=1.5, dashed=False, name=None):
        dash = ' stroke-dasharray="5 4"' if dashed else ""
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        nm = f' id="{html.escape(name)}"' if name else ""
        self.parts.append(f'<rect{nm} x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{st}{dash}/>')

    def circle(self, cx, cy, r, fill=WHITE, stroke=INK, sw=1.5):
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        self.parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{st}/>')

    def line(self, x1, y1, x2, y2, stroke=LINE, sw=1.5, dashed=False):
        dash = ' stroke-dasharray="5 4"' if dashed else ""
        self.parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{dash}/>')

    def text(self, x, y, s, size=14, weight=400, color=INK, anchor="start"):
        self.parts.append(
            f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{html.escape(s)}</text>'
        )

    # ---- wireframe widgets ------------------------------------------------
    def lines(self, x, y, w, n=3, gap=12, last=0.6):
        for i in range(n):
            self.rect(x, y + i * gap, round(w * (last if i == n - 1 else 1)), 7, r=3, fill=LIGHT, stroke=None)
        return y + n * gap

    def chip(self, x, y, label, size=11):
        w = round(len(label) * size * 0.62 + 18)
        self.rect(x, y, w, 20, r=10, fill=WHITE, stroke=MUTED, sw=1)
        self.text(x + w / 2, y + 14, label, size, 600, MUTED, "middle")
        return w

    def button(self, x, y, label, primary=True, w=None):
        w = w or round(len(label) * 7.6 + 36)
        self.rect(x, y, w, 36, r=18, fill=LIGHT if primary else WHITE, stroke=INK)
        self.text(x + w / 2, y + 23, label, 14, 700 if primary else 600, INK, "middle")
        return w

    def badge(self, x, y, n):
        self.circle(x, y, 11, fill=INK, stroke=None)
        self.text(x, y + 4, str(n), 11, 700, WHITE, "middle")

    def bar(self, x, y, w, pct):
        self.rect(x, y, w, 10, r=5, fill=LIGHT, stroke=None)
        if pct > 0:
            self.rect(x, y, max(10, round(w * pct)), 10, r=5, fill=MUTED, stroke=None)

    def option(self, x, y, w, label, selected=False, dashed=True):
        self.rect(x, y, w, 40, r=12, fill=LIGHT if selected else WHITE, stroke=INK if selected else MUTED, sw=1.5 if selected else 1, dashed=dashed and not selected)
        self.text(x + 16, y + 25, label, 14, 600 if selected else 400, INK if selected else MUTED)

    def check(self, x, y, label, size=12, checked=False):
        self.rect(x, y - 10, 13, 13, r=3, fill=LIGHT if checked else WHITE, stroke=INK, sw=1.2)
        self.text(x + 20, y, label, size, 600, MUTED)

    # ---- app chrome -------------------------------------------------------
    def sidebar(self):
        self.rect(0, 0, SIDEBAR_W, H, r=0, fill=PALE, stroke=None)
        self.line(SIDEBAR_W, 0, SIDEBAR_W, H, LINE, 1)
        self.circle(36, 40, 15)
        self.text(60, 47, "Funza", 20, 800)
        self.rect(20, 84, 216, 40, r=20, fill=LIGHT, stroke=None)
        self.text(40, 109, "My courses", 14, 700)
        self.text(40, 157, "Progress", 14, 600, MUTED)

    def mascot_column(self, x, y, bubble: list[str], tutor_active=False, tutor_step=""):
        """The 272px right column: mascot, speech bubble, tutor controls. Returns the next free y."""
        w = 272
        self.circle(x + w / 2, y + 36, 34)
        self.text(x + w / 2, y + 40, "mascot", 10, 400, MUTED, "middle")
        by = y + 86
        bh = 24 + 20 * len(bubble) + 44
        self.rect(x, by, w, bh, r=14)
        for i, s in enumerate(bubble):
            self.text(x + 14, by + 26 + 20 * i, s, 13)
        self.line(x + 14, by + bh - 36, x + w - 14, by + bh - 36, LINE, 1)
        self.chip(x + 14, by + bh - 28, "Voice off")
        self.chip(x + 94, by + bh - 28, "Replay")
        ny = by + bh + 14
        if tutor_active:
            cw = self.chip(x, ny + 6, f"Tutor: {tutor_step}")
            self.button(x + cw + 8, ny - 2, "Pause", False, 70)
            self.text(x + cw + 96, ny + 21, "Exit", 13, 600, MUTED)
            ny += 44
        else:
            self.button(x, ny, "Start Tutor Mode", True, w)
            self.text(x + w / 2, ny + 56, "Funza talks you through the whole topic,", 11, 400, MUTED, "middle")
            self.text(x + w / 2, ny + 72, "one step at a time.", 11, 400, MUTED, "middle")
            ny += 90
        return ny

    def topic_list(self, x, y, items, current=1):
        w = 272
        self.rect(x, y, w, 30 + 26 * len(items), r=14)
        self.text(x + 16, y + 22, "In this topic", 13, 800)
        for i, s in enumerate(items):
            cy = y + 46 + 26 * i
            if i < current:
                self.circle(x + 24, cy - 4, 7, fill=MUTED, stroke=None)
            else:
                self.circle(x + 24, cy - 4, 7, fill=LIGHT if i == current else WHITE, stroke=INK if i == current else LINE, sw=1.5)
            self.text(x + 40, cy, s, 12, 700 if i == current else 600, INK if i == current else MUTED)
        return y + 30 + 26 * len(items)

    # ---- notes band and output -----------------------------------------
    def notes(self, items: list[tuple[str, str]]):
        y0 = H
        self.rect(0, y0, W, NOTES_H, r=0, fill=PALE, stroke=None)
        self.line(0, y0, W, y0, INK, 1.5)
        self.text(40, y0 + 30, "What we want to learn", 13, 800)
        for i, (lead, body) in enumerate(items):
            cx = 40
            cy = y0 + 58 + i * 27
            self.badge(cx + 11, cy - 4, i + 1)
            self.parts.append(
                f'<text x="{cx + 30}" y="{cy}" font-family="{FONT}" font-size="12.5" fill="{INK}"><tspan font-weight="700">{html.escape(lead)}</tspan> {html.escape(body)}</text>'
            )

    def save(self, path: pathlib.Path):
        total_h = H + NOTES_H
        body = "\n".join(self.parts)
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{total_h}" viewBox="0 0 {W} {total_h}" font-family="{FONT}">\n'
            f"<title>{html.escape(self.title)}</title>\n"
            f'<rect x="0" y="0" width="{W}" height="{total_h}" fill="{WHITE}"/>\n{body}\n'
            f'<rect x="0.75" y="0.75" width="{W - 1.5}" height="{total_h - 1.5}" rx="6" fill="none" stroke="{INK}" stroke-width="1.5"/>\n</svg>\n'
        )
        path.write_text(svg, encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Screen 1: Home
# ---------------------------------------------------------------------------
def home() -> Svg:
    s = Svg("1. Home — my courses")
    s.sidebar()
    mx = SIDEBAR_W + 40
    s.circle(mx + 36, 72, 36)
    s.text(mx + 36, 76, "mascot", 10, 400, MUTED, "middle")
    s.text(mx + 90, 66, "What are we learning today?", 30, 800)
    s.badge(mx + 80, 42, 1)
    s.text(mx + 90, 94, "Pick a course to continue, or add one with your lecture PDFs.", 15, 400, MUTED)
    s.button(W - 40 - 130, 48, "Add Course", True, 130)
    s.badge(W - 40 - 130 - 2, 46, 2)
    # course cards
    names = [("Computer Networks", 0.4, "2 of 5 concepts completed"), ("Mathematics", 0, "No lessons started"), ("Physics", 0, "No lessons started")]
    cw, ch, gap = 300, 160, 24
    for i, (name, pct, foot) in enumerate(names):
        x = mx + i * (cw + gap)
        y = 150
        s.rect(x, y, cw, ch, r=20)
        s.rect(x + 20, y + 20, 44, 44, r=14, fill=LIGHT, stroke=None)
        s.text(x + 42, y + 48, name[0], 18, 800, MUTED, "middle")
        s.text(x + 76, y + 38, name, 16, 800)
        s.chip(x + 76, y + 48, "SAMPLE")
        s.text(x + 76, y + 84, "Built-in lessons", 12, 400, MUTED)
        s.bar(x + 20, y + 106, cw - 40, pct)
        s.text(x + 20, y + 136, foot, 11, 600, MUTED)
    s.badge(mx + 74, 196, 3)
    # second row, partial, to hint at more
    s.rect(mx, 334, cw, 60, r=20, dashed=True, stroke=MUTED, sw=1)
    s.text(mx + 20, 370, "Computer Science · SAMPLE", 13, 600, MUTED)
    s.rect(mx + cw + gap, 334, cw, 60, r=20, dashed=True, stroke=MUTED, sw=1)
    s.text(mx + cw + gap + 20, 370, "Biology · SAMPLE", 13, 600, MUTED)
    # try a sample
    s.text(mx, 450, "Try a built-in sample", 13, 800, MUTED)
    s.text(mx, 470, "Short lessons with interactive demos. Remove them whenever you like.", 12, 400, MUTED)
    bx = mx
    for label in ["Add Mathematics", "Add Physics"]:
        bx += s.button(bx, 486, label, False) + 10
    s.notes([
        ("Greeting.", "Does a first-time student know this is a study app, not a chat bot?"),
        ("Add course.", "Is it obvious that a course comes from the student's own PDFs?"),
        ("Sample badge.", "Do students understand that \"sample\" means built-in lessons they can delete?"),
    ])
    return s


# ---------------------------------------------------------------------------
# Screen 2: Course page
# ---------------------------------------------------------------------------
def course() -> Svg:
    s = Svg("2. Course page — PDFs and topics")
    s.sidebar()
    mx = SIDEBAR_W + 40
    s.text(mx, 52, "← My courses", 13, 700, MUTED)
    s.text(mx, 96, "ENSE 472", 30, 800)
    s.rect(mx, 118, W - mx - 40, 44, r=14, fill=PALE, stroke=LINE, sw=1)
    s.chip(mx + 14, 130, "FROM YOUR PDFS")
    s.text(mx + 150, 145, "Lessons were generated on this device from your PDFs. Questions can be rough; every explanation is quoted from the file.", 12, 400, MUTED)
    s.badge(mx + 2, 118, 1)
    # files column
    fx, fy, fw = mx, 190, 330
    s.text(fx, fy, "Files", 15, 800)
    s.badge(fx - 8, fy - 20, 2)
    s.rect(fx, fy + 14, fw, 74, r=14)
    s.text(fx + 16, fy + 40, "Lecture.pdf", 14, 700)
    s.chip(fx + 16, fy + 52, "NOTES")
    s.text(fx + 86, fy + 66, "12 concepts · 3 topics", 12, 400, MUTED)
    s.rect(fx, fy + 100, fw, 74, r=14)
    s.text(fx + 16, fy + 126, "Tutorial 3.pdf", 14, 700)
    s.chip(fx + 16, fy + 138, "QUESTIONS")
    s.text(fx + 108, fy + 152, "8 questions · Guide me / Answers", 12, 400, MUTED)
    s.button(fx, fy + 190, "Attach PDF", False)
    s.rect(fx, fy + 246, fw, 70, r=14, dashed=True, stroke=MUTED, sw=1)
    s.text(fx + 16, fy + 272, "Plan AI lessons from Lecture.pdf", 13, 700, MUTED)
    s.text(fx + 16, fy + 292, "Sends the text to the AI provider, after asking you first.", 11, 400, MUTED)
    # topics column
    tx, tw = fx + fw + 32, W - 40 - (fx + fw + 32)
    s.text(tx, fy, "Topics", 15, 800)
    s.badge(tx - 8, fy - 20, 3)
    topics = [("HTTP/2 basics", "4 concepts · 1 completed", 0.25, True), ("Flow control", "3 concepts · not started", 0, False), ("Server push", "3 concepts · not started", 0, False)]
    for i, (name, meta, pct, primary) in enumerate(topics):
        y = fy + 14 + i * 92
        s.rect(tx, y, tw, 80, r=14)
        s.text(tx + 16, y + 30, name, 15, 800)
        s.text(tx + 16, y + 50, meta, 12, 400, MUTED)
        s.bar(tx + 16, y + 60, tw - 160, pct)
        s.button(tx + tw - 16 - 90, y + 22, "Start", primary, 90)
    s.notes([
        ("Source banner.", "Is \"from your PDFs\" versus \"sample\" versus \"adaptive AI\" clear and reassuring?"),
        ("Files.", "Does the notes / questions split make sense? Would they flip a wrong classification?"),
        ("Topics.", "Is \"concept\" the right word? Do they want to pick a concept directly?"),
    ])
    return s


# ---------------------------------------------------------------------------
# Shared lesson scaffolding for screens 3 to 5
# ---------------------------------------------------------------------------
def lesson_header(s: Svg, mx, concept_label="Concept 2 of 4", pct=0.35):
    s.text(mx, 48, "← Computer Networks", 13, 700, MUTED)
    cw = s.chip(mx + 600, 34, concept_label)
    s.bar(mx, 64, 660, pct)
    s.rect(mx, 86, 660, 36, r=12, fill=PALE, stroke=LINE, sw=1)
    s.chip(mx + 12, 94, "SAMPLE")
    s.text(mx + 90, 108, "These lessons are built in, not from a PDF.", 12, 400, MUTED)


def lesson() -> Svg:
    s = Svg("3. Lesson — explain, ask, hint")
    s.sidebar()
    mx = SIDEBAR_W + 40
    lesson_header(s, mx)
    # concept card
    cx, cy, cw = mx, 136, 660
    s.rect(cx, cy, cw, 600, r=20)
    s.chip(cx + 24, cy + 20, "HOW DATA TRAVELS ACROSS THE INTERNET")
    s.text(cx + 24, cy + 64, "Messages are split into packets", 26, 800)
    s.lines(cx + 24, cy + 84, cw - 48, 3, 14, 0.5)
    s.line(cx + 24, cy + 146, cx + cw - 24, cy + 146, LINE, 1)
    s.circle(cx + 40, cy + 176, 16, fill=LIGHT, stroke=INK)
    s.text(cx + 40, cy + 181, "?", 14, 800, INK, "middle")
    s.text(cx + 68, cy + 174, "Apply it", 17, 800)
    s.badge(cx + 10, cy + 160, 3)
    s.text(cx + 68, cy + 196, "You send a message to a website. What happens to it before it arrives?", 13)
    ox, ow = cx + 68, cw - 92
    s.option(ox, cy + 212, ow, "(a) It goes as one big file directly to the website.")
    s.option(ox, cy + 260, ow, "(b) It is split into small packets that may take different routes.", selected=True)
    s.option(ox, cy + 308, ow, "(c) It is converted into a video and streamed.")
    s.button(ox, cy + 364, "Check understanding", True)
    # hint box
    hy = cy + 416
    s.rect(ox, hy, ow, 112, r=14, fill=PALE, stroke=MUTED, sw=1, dashed=True)
    s.badge(ox - 2, hy - 2, 4)
    s.text(ox + 16, hy + 24, "Not quite. Here's a hint", 13, 800, MUTED)
    s.lines(ox + 16, hy + 34, ow - 32, 2, 12, 0.7)
    s.text(ox + 16, hy + 76, "Another way to think about it", 13, 800, MUTED)
    s.lines(ox + 16, hy + 86, ow - 32, 2, 12, 0.6)
    s.button(ox, hy + 124, "Try again", True)
    s.text(ox + 120, hy + 147, "Attempt 1 of 3 before you can ask to see the answer.", 11, 600, MUTED)
    # right column
    rx = mx + cw + 32
    s.badge(rx + 136 - 44, 44, 1)
    ny = s.mascot_column(rx, 34, ["Hey! Let's figure this out together.", "Here's the idea. When you send a", "message, your computer cuts it into", "packets … Now you try."])
    s.badge(rx - 2, 34 + 86 + 24 + 80 + 44 + 14 - 2, 2)
    s.topic_list(rx, ny, ["Messages are split into packets", "Why small pieces beat one big block", "Every packet carries an address", "Routers choose the path"], current=1)
    s.notes([
        ("Mascot and bubble.", "Tutor or gimmick? Do they turn the voice on?"),
        ("Tutor Mode.", "Do they understand it narrates the whole topic and waits for them?"),
        ("Question.", "Do they read the explanation first, or go straight to the options?"),
        ("Hint instead of answer.", "Helpful or annoying? Is \"3 attempts before the answer\" fair?"),
    ])
    return s


def lesson_demo() -> Svg:
    s = Svg("4. Lesson with an interactive demo")
    s.sidebar()
    mx = SIDEBAR_W + 40
    lesson_header(s, mx, "Concept 1 of 5", 0.1)
    cx, cy, cw = mx, 136, 660
    s.rect(cx, cy, cw, 630, r=20)
    s.chip(cx + 24, cy + 20, "HOW DATA TRAVELS ACROSS THE INTERNET")
    s.text(cx + 24, cy + 66, "Messages are split into packets", 24, 800)
    s.lines(cx + 24, cy + 86, cw - 48, 2, 14, 0.6)
    # demo card
    dx, dy, dw = cx + 24, cy + 128, cw - 48
    s.rect(dx, dy, dw, 478, r=16, fill=PALE, stroke=LINE, sw=1)
    s.text(dx + 16, dy + 26, "Packet transmission", 14, 800)
    s.text(dx + dw - 16, dy + 26, "Step 3 of 5", 11, 700, MUTED, "end")
    # stage
    sx, sy, sw_, sh = dx + 12, dy + 40, dw - 24, 140
    s.rect(sx, sy, sw_, sh, r=12, fill=WHITE, stroke=LINE, sw=1)
    s.badge(sx - 2, sy - 2, 1)
    s.rect(sx + 20, sy + 50, 90, 60, r=12)
    s.text(sx + 65, sy + 128, "Sender", 11, 700, INK, "middle")
    s.rect(sx + sw_ - 110, sy + 50, 90, 60, r=12)
    s.text(sx + sw_ - 65, sy + 128, "Receiver", 11, 700, INK, "middle")
    midy = sy + 80
    s.line(sx + 110, midy, sx + 200, sy + 34, LINE, 1.5, True)
    s.line(sx + 200, sy + 34, sx + sw_ - 200, sy + 34, LINE, 1.5, True)
    s.line(sx + sw_ - 200, sy + 34, sx + sw_ - 110, midy, LINE, 1.5, True)
    s.line(sx + 110, midy, sx + sw_ / 2, sy + 128, LINE, 1.5, True)
    s.line(sx + sw_ / 2, sy + 128, sx + sw_ - 110, midy, LINE, 1.5, True)
    for (rx_, ry_, lab) in [(sx + 200, sy + 34, "R1"), (sx + sw_ - 200, sy + 34, "R2"), (sx + sw_ / 2, sy + 128, "R3")]:
        s.circle(rx_, ry_, 13, fill=LIGHT, stroke=INK)
        s.text(rx_, ry_ + 4, lab, 10, 700, INK, "middle")
    for (px, py, n) in [(sx + 150, sy + 50, "1"), (sx + sw_ - 300, sy + 18, "3"), (sx + sw_ / 2 - 60, sy + 96, "2")]:
        s.rect(px, py, 30, 18, r=5, fill=LIGHT, stroke=INK)
        s.text(px + 15, py + 13, n, 10, 700, INK, "middle")
    # caption and dots
    for i in range(5):
        s.circle(sx + 8 + i * 12, sy + sh + 20, 3, fill=INK if i == 2 else LIGHT, stroke=None)
    s.text(sx + 76, sy + sh + 24, "Each packet travels on its own. Routers forward them hop by hop, and packets can take different routes.", 12, 600)
    # prediction
    py0 = sy + sh + 40
    s.rect(sx, py0, sw_, 112, r=14, fill=WHITE, stroke=MUTED, sw=1, dashed=True)
    s.badge(sx - 2, py0 - 2, 2)
    s.text(sx + 14, py0 + 22, "Predict what happens next", 13, 800, MUTED)
    s.text(sx + 14, py0 + 42, "The packets took different routes. Will they arrive in the order they were sent?", 12)
    oy = py0 + 54
    for i, lab in enumerate(["(a) Always. The network keeps packets in order.", "(b) Not necessarily. The receiver uses the sequence numbers.", "(c) They arrive in reverse order."]):
        s.circle(sx + 22, oy + 10 + i * 20, 5, fill=WHITE, stroke=INK, sw=1.2)
        s.text(sx + 34, oy + 14 + i * 20, lab, 11.5, 600, MUTED)
    # controls
    ky = py0 + 126
    bx = sx
    bx += s.button(bx, ky, "Play", True, 70) + 8
    bx += s.button(bx, ky, "Step", False, 70) + 8
    s.text(bx + 10, ky + 23, "Reset", 13, 600, MUTED)
    # settings
    gy = ky + 58
    s.line(sx, gy - 8, sx + sw_, gy - 8, LINE, 1)
    s.badge(sx - 2, gy - 10, 4)
    s.text(sx + 10, gy + 10, "Packets", 11, 700, MUTED)
    s.text(sx + 250, gy + 10, "3", 11, 800, INK, "end")
    s.rect(sx + 10, gy + 18, 240, 6, r=3, fill=LIGHT, stroke=None)
    s.circle(sx + 10 + 60, gy + 21, 7, fill=INK, stroke=None)
    s.text(sx + 300, gy + 10, "Lose a packet", 11, 700, MUTED)
    s.rect(sx + 300, gy + 16, 200, 26, r=10, fill=WHITE, stroke=LINE, sw=1)
    s.text(sx + 312, gy + 34, "None", 12, 600)
    s.text(sx + 488, gy + 34, "▾", 12, 600, MUTED, "end")
    s.text(dx + 16, dy + 466, "▸ Read every step as text", 11, 700, MUTED)
    # right column
    rx = mx + cw + 32
    ny = s.mascot_column(rx, 34, ["Quick prediction before I show", "the next part. The packets took", "different routes. Will they arrive", "in the order they were sent?"], tutor_active=True, tutor_step="Your prediction")
    s.badge(rx - 2, 34 + 86 - 2, 3)
    s.topic_list(rx, ny + 6, ["Messages are split into packets", "Why small pieces beat one big block", "Every packet carries an address", "Routers choose the path"], current=0)
    s.notes([
        ("Animation.", "Does the picture explain more than the text? Are the captions read?"),
        ("Prediction stop.", "Do they realise the demo stopped on purpose, and that nothing is revealed until they answer?"),
        ("Mascot sync.", "Does the mascot saying the same thing as the demo help, or feel like noise?"),
        ("Sliders.", "Do they discover the settings? Do they try a second run?"),
    ])
    return s


def ask_funza() -> Svg:
    s = Svg("5. Ask Funza about this screen (and optional screen share)")
    s.sidebar()
    mx = SIDEBAR_W + 40
    lesson_header(s, mx)
    cx, cy, cw = mx, 136, 660
    s.rect(cx, cy, cw, 600, r=20, stroke=LINE, sw=1)
    s.chip(cx + 24, cy + 20, "HOW DATA TRAVELS ACROSS THE INTERNET")
    s.text(cx + 24, cy + 70, "Messages are split into packets", 26, 800, MUTED)
    s.lines(cx + 24, cy + 92, cw - 48, 4, 14, 0.5)
    s.text(cx + 24, cy + 198, "Apply it", 17, 800, MUTED)
    s.lines(cx + 24, cy + 214, cw - 48, 2, 14, 0.7)
    # modal overlay
    s.rect(0, 0, W, H, r=0, fill="#00000022", stroke=None)
    mw, mh = 520, 470
    mx0, my0 = SIDEBAR_W + (W - SIDEBAR_W - 272 - 32 - mw) / 2 + 20, 150
    s.rect(mx0, my0, mw, mh, r=22, fill=WHITE, stroke=INK)
    s.badge(mx0 - 2, my0 - 2, 5)
    s.text(mx0 + 24, my0 + 36, "Check this screenshot before it is sent", 17, 800)
    s.text(mx0 + 24, my0 + 58, "This is the only image that would leave your device, and only if you press Send.", 11.5, 400, MUTED)
    s.rect(mx0 + 24, my0 + 72, mw - 48, 150, r=12, fill=LIGHT, stroke=LINE, sw=1)
    s.text(mx0 + mw / 2, my0 + 152, "[ screenshot preview ]", 13, 600, MUTED, "middle")
    s.rect(mx0 + 24, my0 + 236, mw - 48, 62, r=12, fill=PALE, stroke=MUTED, sw=1)
    s.text(mx0 + 38, my0 + 258, "Look for anything private", 12.5, 800, MUTED)
    s.text(mx0 + 38, my0 + 278, "Names, messages, passwords, email, course material you may not share.", 11, 400, MUTED)
    s.text(mx0 + 24, my0 + 324, "Your question about this screenshot", 12.5, 700)
    s.rect(mx0 + 24, my0 + 334, mw - 48, 44, r=12, fill=WHITE, stroke=LINE, sw=1)
    s.text(mx0 + 38, my0 + 361, "What am I looking at here, and where should I start?", 12, 400, MUTED)
    s.check(mx0 + 24, my0 + 404, "I am allowed to share this content with the AI provider, and it shows nothing private.", 11.5)
    bx = mx0 + 24
    bx += s.button(bx, my0 + 418, "Send to Funza", True) + 8
    bx += s.button(bx, my0 + 418, "Retake", False) + 8
    s.text(bx + 8, my0 + 441, "Discard", 13, 600, MUTED)
    # right column
    rx = mx + cw + 32
    ny = s.mascot_column(rx, 34, ["You're in Computer Networks,", "concept 2 of 4. You've made one", "attempt. Want a hint, or shall I", "explain the diagram?"])
    s.badge(rx - 2, 34 + 86 - 2, 2)
    # ask panel
    ay, aw = ny - 10, 272
    s.rect(rx, ay, aw, 392, r=14)
    s.badge(rx - 2, ay - 2, 1)
    s.rect(rx + 12, ay + 12, 190, 30, r=15, fill=WHITE, stroke=LINE, sw=1)
    s.text(rx + 24, ay + 31, "Ask about this screen…", 11, 400, MUTED)
    s.button(rx + 210, ay + 9, "Ask", True, 50)
    cx2, cy2 = rx + 12, ay + 54
    for lab in ["What am I looking at?", "Explain the diagram", "Where did I go wrong?", "Give me a hint", "Show me another way"]:
        s.chip(cx2, cy2, lab)
        cy2 += 25
    sy2 = ay + 196
    s.line(rx + 12, sy2 - 8, rx + aw - 12, sy2 - 8, LINE, 1)
    s.text(rx + 12, sy2 + 8, "▾ Share a screen (optional)", 11.5, 700, MUTED)
    s.badge(rx + aw - 14, sy2 + 2, 3)
    s.rect(rx + 12, sy2 + 18, aw - 24, 132, r=12, fill=PALE, stroke=INK, sw=1)
    s.badge(rx + 10, sy2 + 16, 4)
    s.circle(rx + 28, sy2 + 36, 4, fill=INK, stroke=None)
    s.text(rx + 38, sy2 + 40, "Sharing a window", 11, 800)
    s.rect(rx + 22, sy2 + 48, aw - 44, 40, r=8, fill=LIGHT, stroke=LINE, sw=1)
    s.text(rx + aw / 2, sy2 + 72, "live thumbnail", 10, 600, MUTED, "middle")
    s.button(rx + 22, sy2 + 98, "Analyze screen", True, 130)
    s.button(rx + 158, sy2 + 98, "Stop sharing", False, 92)
    s.check(rx + 14, sy2 + 172, "Keep screenshots on this device", 11)
    s.notes([
        ("Ask box.", "Do they type, or use the buttons? Is it clear it knows the current question?"),
        ("Answer.", "Useful, or just repeating the screen? Does it give away answers?"),
        ("Opt-in sharing.", "Would they ever press this? What do they expect it to see?"),
        ("While sharing.", "Is the indicator reassuring enough? Is Stop easy to find?"),
        ("Review before send.", "Does the consent step feel like safety, or friction?"),
    ])
    return s


if __name__ == "__main__":
    here = pathlib.Path(__file__).resolve().parent
    for name, build in [("01_home", home), ("02_course_page", course), ("03_lesson", lesson), ("04_lesson_with_demo", lesson_demo), ("05_ask_funza", ask_funza)]:
        build().save(here / f"{name}.svg")
        print("wrote", f"{name}.svg")

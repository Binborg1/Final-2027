# Vlog 1 — Script

**Length:** about 8 minutes (limit is 15). **A** = Aubin, **C** = Chop.
Upload to YouTube (unlisted is fine), then add the link to the README **Vlogs** table and the URCourses wiki.

`[Show: …]` is what's on screen. `BAD` / `PMBOK` tags are lower-third captions naming the document.

| Vlog requirement | Part |
|---|---|
| Team, roles and responsibilities | 1 |
| Background, business need, what exists, how we're different | 2 |
| Reason (golden circle) | 3 |
| Impact and value statement | 4 |
| Who: audience, whose opinion matters, goals, pain points, where they are | 5 |
| What we'll create, constraints | 6 |
| How: tech stack, RACI, schedule, tracking success | 7 |

---

## 1. Team (0:00 – 0:50)

`[Show: both on camera, name lower thirds]` `PMBOK: Roles and Responsibilities`

**A:** Hi, I'm Aubin Chriss Izere.

**C:** And I'm Chop Kur. We're Software Systems Engineering students at the University of Regina, and this is our ENSE 400 capstone: the AI Learning Environment. The app is called Funza.

**A:** We're co-founders and we share project management. Each of us owns features. I own the PDF reader, the AI layer and the explanations, and in the winter, voice input and the iPad version.

**C:** I own storage, flashcards and quizzes, and in the winter, accounts, the Pro subscription and review planning. We review each other's code before anything is merged.

## 2. The problem (0:50 – 2:20)

`[Show: a course folder of PDFs, then pasting a passage into ChatGPT]` `BAD: Business Case`

**A:** Students study from files they already have: lecture slides and textbook PDFs from UR Courses. A lot of us also use ChatGPT to understand them.

**C:** But every session starts the same way. Upload the file, explain which course it's from, ask your question. The answer doesn't tell you which page it came from, so you can't check it. And if you want flashcards or a quiz, you make them yourself in another app.

`[Show: Linda's quote from the pitch deck]`

**A:** We heard this from Linda, a U of R student we interviewed. Paraphrasing her: it would be smoother if it could see the file she's studying and explain it.

`[Show: Competitor Analysis table]` `BAD: Competitor Analysis`

**C:** Tools exist. NotebookLM gives cited answers, but you upload every file first. Acrobat's AI works on one PDF at a time, with no practice. ChatGPT explains well, but you set up the context every time. Anki and Quizlet are great for review, but you make every card by hand.

**A:** None of them teach from the files already on your laptop, check that you actually understood, and turn it into practice. That's our opportunity.

## 3. Why we're building it (2:20 – 3:10)

`[Show: golden circle: Why / How / What]`

**C:** Our why: students should be able to learn from the material they already have, and trust the answers they get.

**A:** Our how: teach from your own course files, keep going until it clicks, and show where every answer came from.

**C:** Our what: Funza, an AI tutor for your course PDFs. It's free to start, and there's a Pro plan for stronger AI models.

**A:** Our unique value in one line: it explains the page you're reading, cites it and turns it into practice.

## 4. Impact (3:10 – 3:50)

`[Show: the impact statement as text]` `PMBOK: Project Charter`

**A:** When we're done, studying with AI that starts with re-uploading files and gives answers you can't check will become a tutor that already has your notes, teaches you until you understand, and shows you where each answer came from.

**C:** To get there, we need to test our prototype with students on October 20, prove the free AI models are good enough, and ship the first release by December 1.

## 5. Who (3:50 – 5:00)

`[Show: User Analysis table, then Stakeholder Analysis]` `BAD: User Analysis` `PMBOK: Stakeholder Analysis`

**C:** We're building it first for U of R undergraduates, mostly second to fourth year in engineering, science and business. They study from PDFs and already ask ChatGPT for help. They cram before midterms on a student budget. Their goal is to understand faster and walk into exams prepared. Graduate students are our second group.

**A:** They're right here on campus in Regina, so we can test with them between classes. They get their information online: UR Courses, ChatGPT, YouTube and each other. That's why word of mouth, starting with the classmates who test it, is how we'll reach them.

**C:** Whose opinion matters? Dr. Maciag, who grades every deliverable. Linda and our classmates who test it. Our capstone peers at the usability session. And the Cultivator HQ mentors who heard our pitch.

**A:** On the business side, our pain points are a crowded market of free tools, students who don't like subscriptions, and free AI tiers that can change their limits. So it's free to start, Pro pays for the expensive models, and the whole project is self-funded on up to 150 US dollars.

## 6. What we're building (5:00 – 6:15)

`[Show: Funza prototype: add a course, attach a PDF, the tutor teaching a concept]` `PMBOK: Requirements, Scope Statement`

**C:** This is our prototype. You add a course and attach your PDFs. The tutor teaches one concept at a time. It explains, asks you a question, and checks your reasoning. If you're wrong, you get a hint. If you're still wrong, it explains it a different way and asks a new question before moving on. It can also read the lesson out loud.

**A:** By December 1, Release 1 adds answers that cite the page, a model picker from cheapest to most expensive, and flashcards and quizzes from your notes. In the winter, Release 2 adds accounts and Pro, review planned around your exam dates, voice input, and an iPad version.

`[Show: exclusions and constraints list]` `PMBOK: Risks`

**C:** Our constraints. There are two of us, at eight to ten hours a week. The free AI tiers have rate limits. Scanned PDFs have no text to read. We have one validated interview so far. And course material belongs to instructors, so your files stay on your device, and the app only sends the text it needs and asks first.

## 7. How (6:15 – 7:45)

`[Show: architecture sketch]`

**A:** The prototype is built with Next.js and React. PDF.js reads the PDFs and everything is stored on your device. A small server route holds the AI keys, so they're never in the app. It works with Gemini, Groq and OpenRouter on their free tiers, and Claude for paid models. We'll package it with Electron as a desktop app for Windows and macOS.

`[Show: RACI chart]` `PMBOK: RACI Chart`

**C:** Our RACI is simple. Whoever owns a feature is accountable and responsible. The other is consulted. Dr. Maciag is informed.

`[Show: Gantt chart, then the Kanban board]` `PMBOK: Schedule` `BAD: KPIs`

**A:** Key dates: October 20, usability testing with at least five students. October 27, development starts. November 24, bazaar day demo. December 1, Release 1. Then the winter release and a pilot with fifteen students by April. The winter dates are tentative.

**C:** We track the work on GitHub. Every task is an issue on our Kanban board, and we review progress weekly. We track success with three numbers: at least 85 percent of answers accurate to the page, half the setup time compared with ChatGPT, and a usability score of 70 or more.

## 8. Close (7:45 – 8:00)

`[Show: end card with the GitHub link]`

**A:** All our documents are on GitHub. The link is in the description.

**C:** On December 1, we'll show you Release 1. Thanks for watching.

---

## Before recording

- **Name:** the script uses "AI Learning Environment" for the project and "Funza" for the app. Drop one if you've settled on a name.
- **What gets sent to the AI:** the requirements say only the selected passage is sent. The prototype sends the PDF's text when it plans lessons, after asking. Part 6 says "only sends the text it needs and asks first", which is true of both.
- Say "one validated interview so far". Everything else in the user tables is still to be tested with students.

## Upload checklist

1. Export at 1080p and check it's under 15:00.
2. Upload to YouTube as unlisted: "AI Learning Environment — ENSE 400 Vlog 1 (Izere, Kur)".
3. Description: one-line summary plus `https://github.com/Binborg1/Final-2027`.
4. Add the link to the README **Vlogs** table and the URCourses wiki.

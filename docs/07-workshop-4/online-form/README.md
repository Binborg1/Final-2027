# Online questionnaire (Google Form)

`Code.gs` builds the same questionnaire as `Folio Usability Questionnaire.pdf` as a Google Form. Anyone can answer it without signing in. Every response is saved to a Google Sheet, scored automatically, and emailed to whoever ran the setup.

## Set it up once (about 2 minutes)

1. Go to <https://script.google.com> and click **New project**.
2. Delete what is in `Code.gs`, paste in this folder's `Code.gs`, and press **Save**.
3. Choose **setup** in the function list and press **Run**. Google asks you to allow access to Forms, Sheets and Gmail: allow it.
4. Open **Execution log**. It prints three links:
   - the link to share (a short `forms.gle` link),
   - the responses spreadsheet,
   - the form editor.

Running **setup** again does not create a second form. It prints the same links again.

## What you get

| Tab in the spreadsheet | What it shows |
|---|---|
| Summary | Number of responses, average SUS (target 70+), share of people at 70+, average Funza score, Net Promoter Score, tasks done alone, task ease, Task 2 accuracy |
| Scores | One scored row per person: task results, SUS 0–100, Funza score 1–5, recommend group |
| Form Responses 1 | Every raw answer, added by Google Forms |
| Links | The share link, the editor and the prototype |

Each new response also sends an email with its SUS score and what the person liked and found confusing.

## Put the online QR code on the PDF

From the `source` folder, run the build with the share link:

```
node build.mjs https://forms.gle/your-link
```

This writes a new `Folio Usability Questionnaire.pdf` one folder up. Its cover then has a second QR code labelled "Prefer to answer online?". Building without a link gives the paper-only version. The build needs Node, Microsoft Edge and ffmpeg, which are already on Aubin's laptop.

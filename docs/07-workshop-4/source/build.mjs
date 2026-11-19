// Assemble folio-usability.html + questionnaire.html -> build.html, print to PDF with Edge,
// and render page PNGs (page-1.png ...) for visual QA.
// Usage:  node build.mjs                      paper version (prototype QR only)
//         node build.mjs https://forms.gle/x  adds the "answer online" QR to the cover
//         (or put the form link in form-url.txt next to this file)
import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const PROTO_URL = "https://www.figma.com/proto/LgelYSqawCinmTbTsKRmIg/Folio?node-id=9-348&starting-point-node-id=9%3A348&scaling=scale-down&content-scaling=fixed";
const urlFile = path.join(dir, "form-url.txt");
const FORM_URL = (process.argv[2] || (fs.existsSync(urlFile) ? fs.readFileSync(urlFile, "utf8") : "")).trim();
if (FORM_URL && !/^https:\/\/\S+$/.test(FORM_URL)) throw new Error("Form link must start with https:// — got: " + FORM_URL);

let formBlock = "";
if (FORM_URL) {
  const out = path.join(dir, "img", "qr-form.svg");
  execSync(`npx --yes qrcode@1.5.4 -t svg -e M -d "#252525" -l "#FFFFFF" -q 1 -o "${out}" "${FORM_URL}"`, { stdio: "ignore" });
  formBlock = `<div class="online"><img src="img/qr-form.svg" alt="QR code for the online questionnaire"><div><div class="eyebrow">Prefer to answer online?</div><b>Scan this code to answer the same questions on your phone or laptop.</b><span>Your answers go straight to the Folio team. No sign-in needed, and you can skip the paper pages.</span><div class="url">${FORM_URL}</div></div></div>`;
}

const shell = fs.readFileSync(path.join(dir, "folio-usability.html"), "utf8");
const qPath = path.join(dir, "questionnaire.html");
const q = fs.existsSync(qPath) ? fs.readFileSync(qPath, "utf8") : "";
let html = shell.replace("<!--QUESTIONNAIRE-->", q).replace("<!--FORMQR-->", formBlock).replaceAll("__PROTO_URL__", PROTO_URL);
if (FORM_URL) {
  // Online version: drop the "What you'll need" strip (pen advice) to make room, and point step 3 online.
  html = html.replace(/<!--NEED-->[\s\S]*?<!--\/NEED-->/, "")
    .replace(/<!--STEP3-->[\s\S]*?<!--\/STEP3-->/, "Answer online with the code below, or on paper on pages 5 to 7 and hand it back.");
}
const buildHtml = path.join(dir, "build.html");
fs.writeFileSync(buildHtml, html);

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const url = "file:///" + buildHtml.split(path.sep).join("/");
const pdf = path.join(dir, "..", "Folio Usability Questionnaire.pdf");
const common = ["--headless", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--virtual-time-budget=10000", "--user-data-dir=" + path.join(dir, ".edge-profile")];
execFileSync(edge, [...common, "--no-pdf-header-footer", "--print-to-pdf=" + pdf, url], { stdio: "ignore" });

const pages = (html.match(/<section class="page[ "]/g) || []).length;
const S = 1.5, W = Math.round(816 * S), H = Math.round(1056 * S);
const shot = path.join(dir, "pages.png");
execFileSync(edge, [...common, `--force-device-scale-factor=${S}`, `--window-size=816,${1056 * pages}`, "--screenshot=" + shot, url], { stdio: "ignore" });
for (let i = 0; i < pages; i++) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", shot, "-vf", `crop=${W}:${H}:0:${i * H}`, path.join(dir, `page-${i + 1}.png`)]);
}
const size = fs.statSync(pdf).size;
console.log(JSON.stringify({ pages, onlineForm: FORM_URL || null, pdf, pdfBytes: size }));

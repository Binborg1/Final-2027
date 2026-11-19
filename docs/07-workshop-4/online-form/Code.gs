/**
 * Folio usability study: online questionnaire
 *
 * Creates the same questionnaire as the printed PDF as a Google Form, links a
 * response spreadsheet that scores every submission (SUS, Funza score,
 * recommend score, task results), and emails you a summary of each new response.
 *
 * One-time setup (about 2 minutes):
 *   1. Go to https://script.google.com and click "New project".
 *   2. Replace everything in Code.gs with this file and press Save.
 *   3. Pick "setup" in the function list and press Run. Allow access when Google asks.
 *   4. Open "Execution log": it prints the link to share (also saved in the
 *      spreadsheet's "Links" tab). Send that link to the Folio team for the QR code.
 *
 * Running setup again does not make a second form; it prints the existing links.
 */

const PROTOTYPE_URL = 'https://www.figma.com/proto/LgelYSqawCinmTbTsKRmIg/Folio?node-id=9-348&starting-point-node-id=9%3A348&scaling=scale-down&content-scaling=fixed';
const NOTIFY_EMAIL = ''; // Leave blank to send notifications to the Google account that runs setup.

const AGREE = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const RESULT = ['Did it on my own', 'Needed a hint', "Couldn't do it"];
const RESULT_SHORT = { 'Did it on my own': 'Own', 'Needed a hint': 'Hint', "Couldn't do it": 'Failed' };

const TASKS = [
  { n: 1, title: 'Get started', text: 'Choose who Folio is for, then open the Biology 101 folder.', start: 'the first screen' },
  { n: 2, title: 'Ask about the reading', text: "Chapter 3 is open and a paragraph is highlighted. Find Funza's explanation and the page it came from.", start: 'the workspace with Chapter 3 open' },
  { n: 3, title: 'Make flashcards', text: 'Make 10 flashcards from pages 3 to 5 and let Funza save them.', start: 'the workspace with Chapter 3 open' },
  { n: 4, title: 'Switch to dark mode', text: 'Turn on dark mode, then switch back to light.', start: 'the workspace with Chapter 3 open' },
  { n: 5, title: 'Talk to the Tutor', text: 'Open the Tutor, tap the microphone and listen to Funza. Then stop it.', start: 'the workspace' },
  { n: 6, title: 'Find the Pro plan', text: 'Find out how much Pro costs and where you would pay for it.', start: 'the workspace' },
];

const T = {
  consent: 'Consent',
  pid: 'Participant ID (optional)',
  role: 'I am',
  age: 'Age',
  comfort: 'How comfortable are you with computers?',
  chat: 'How often do you use chat helpers like ChatGPT?',
  device: 'What are you using for this test?',
  result: (n) => `Task ${n}: How did it go?`,
  ease: (n) => `Task ${n}: How easy was it?`,
  confusing: (n) => `Task ${n}: Anything confusing?`,
  t2page: 'Task 2: Page number Funza gave',
  t3ask: 'Task 3: What did Funza ask you before saving?',
  t5clear: 'Task 5: Could you tell when Funza was listening and when it was talking?',
  t6price: 'Task 6: Price of Pro, and where you would pay for it',
  sus: 'Using Folio',
  funza: 'Funza and the look of Folio',
  mode: 'Which mode would you use?',
  nps: 'How likely are you to recommend Folio to a friend?',
  liked: 'What did you like most?',
  confused: 'What was confusing or annoying?',
  useFor: 'What would you use Folio for?',
  change: 'If you could change one thing, what would it be?',
  pay: 'Would you pay $5 a month for Pro (unlimited help, Deep answers, voice)?',
  payWhy: 'Why?',
  email: 'Can we contact you for a 15-minute follow-up? Email (optional)',
};

const SUS_ROWS = [
  'I think that I would like to use Folio frequently.',
  'I found Folio unnecessarily complex.',
  'I thought Folio was easy to use.',
  'I think that I would need the support of a technical person to be able to use Folio.',
  'I found the various functions in Folio were well integrated.',
  'I thought there was too much inconsistency in Folio.',
  'I would imagine that most people would learn to use Folio very quickly.',
  'I found Folio very cumbersome to use.',
  'I felt very confident using Folio.',
  'I needed to learn a lot of things before I could get going with Folio.',
];

const FUNZA_ROWS = [
  "Funza's answers were easy to understand.",
  "Seeing the page number made me trust Funza's answer more.",
  'I always knew what Funza was about to do before it did it.',
  'When Funza asked permission, I felt in control of my files.',
  'The one-tap buttons (Explain, Flashcards, Quiz) were easier than typing a request.',
  'Talking with the Tutor felt natural.',
  'The moving bars made it clear when Funza was listening or talking.',
  'Folio looks friendly and inviting.',
  'The brain mascot made Funza feel approachable.',
  'The screen was comfortable to read in both light and dark mode.',
];

const SCORE_HEAD = [
  'Submitted', 'Participant ID', 'I am', 'Age', 'Device', 'Mode they would use',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6',
  'Tasks done alone (of 6)', 'Average task ease (1-7)', 'SUS (0-100)', 'Funza score (1-5)',
  'Recommend (0-10)', 'Recommend group', 'Would pay $5/month', 'T2 page correct',
];

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_ID')) {
    const existing = FormApp.openById(props.getProperty('FORM_ID'));
    Logger.log('Already set up. Share this link: ' + (props.getProperty('SHORT_URL') || existing.getPublishedUrl()));
    Logger.log('Responses: ' + SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getUrl());
    return;
  }

  const form = FormApp.create('Folio usability study');
  form.setDescription(
    'Folio is a desktop app for people who don\'t code. You open a folder from your computer and everything in it opens in one window: PDFs, documents, notes and drawings. ' +
    'Funza, the helper on the right, explains what you\'re reading in plain words, tells you which page the answer came from, and makes flashcards, quizzes or documents with one button. ' +
    'Funza always asks before it changes anything in your folder.\n\n' +
    'This takes about 10 minutes. We\'re testing the app, not you. There are no right or wrong answers.\n\n' +
    'Open the Folio prototype here (best on a laptop or tablet):\n' + PROTOTYPE_URL
  );
  form.setProgressBar(true)
    .setAllowResponseEdits(false)
    .setCollectEmail(false)
    .setConfirmationMessage('Thank you! Your answers have been sent to the Folio team.');
  try { form.setRequireLogin(false); } catch (err) { /* only applies to Google Workspace accounts */ }

  // Page 1: consent
  form.addCheckboxItem().setTitle(T.consent)
    .setHelpText('Taking part is voluntary and you can stop at any time. You must be 18 or older. We don\'t need your name. Your answers are used only to improve Folio for our ENSE 400 capstone project and are never shared outside the team.')
    .setChoiceValues(['I am 18 or older and agree to take part']).setRequired(true);
  form.addTextItem().setTitle(T.pid).setHelpText('Only if the person running your session gave you one.');

  // Page 2: about you
  form.addPageBreakItem().setTitle('About you');
  form.addMultipleChoiceItem().setTitle(T.role).setChoiceValues(['Student', 'Working', 'Retired']).showOtherOption(true).setRequired(true);
  form.addMultipleChoiceItem().setTitle(T.age).setChoiceValues(['18–24', '25–34', '35–54', '55+']).setRequired(true);
  form.addScaleItem().setTitle(T.comfort).setBounds(1, 5).setLabels('Not at all', 'Very').setRequired(true);
  form.addMultipleChoiceItem().setTitle(T.chat).setChoiceValues(['Never', 'A few times', 'Weekly', 'Daily']).setRequired(true);
  form.addMultipleChoiceItem().setTitle(T.device).setChoiceValues(['Laptop or desktop', 'Tablet', 'Phone']).setRequired(true);

  // Page 3: tasks
  form.addPageBreakItem().setTitle('Try Folio: six short tasks')
    .setHelpText('Open Folio here (it starts on its first screen):\n' + PROTOTYPE_URL + '\n\nDo each task in the prototype, then come back and tell us how it went. It\'s fine to get stuck. This is a clickable prototype, so Funza\'s answers are written in advance and some buttons don\'t do anything yet.');
  TASKS.forEach((task) => {
    form.addSectionHeaderItem().setTitle(`Task ${task.n}: ${task.title}`).setHelpText(`${task.text}\nStarts on: ${task.start}.`);
    form.addMultipleChoiceItem().setTitle(T.result(task.n)).setChoiceValues(RESULT).setRequired(true);
    form.addScaleItem().setTitle(T.ease(task.n)).setBounds(1, 7).setLabels('Very hard', 'Very easy').setRequired(true);
    if (task.n === 2) form.addTextItem().setTitle(T.t2page);
    if (task.n === 3) form.addTextItem().setTitle(T.t3ask);
    if (task.n === 5) form.addMultipleChoiceItem().setTitle(T.t5clear).setChoiceValues(['Yes', 'Not sure', 'No']);
    if (task.n === 6) form.addTextItem().setTitle(T.t6price);
    form.addTextItem().setTitle(T.confusing(task.n));
  });

  // Page 4: SUS
  form.addPageBreakItem().setTitle('How easy was Folio to use?').setHelpText('Pick one answer per row. Go with your first reaction.');
  form.addGridItem().setTitle(T.sus).setRows(SUS_ROWS).setColumns(AGREE).setRequired(true);

  // Page 5: Funza and the look
  form.addPageBreakItem().setTitle('About Funza and the look of Folio');
  form.addGridItem().setTitle(T.funza).setRows(FUNZA_ROWS).setColumns(AGREE).setRequired(true);
  form.addMultipleChoiceItem().setTitle(T.mode).setChoiceValues(['Student', 'Everyday', 'Both', 'Neither']).setRequired(true);
  form.addScaleItem().setTitle(T.nps).setBounds(0, 10).setLabels('Not at all likely', 'Extremely likely').setRequired(true);

  // Page 6: in your own words
  form.addPageBreakItem().setTitle('In your own words');
  form.addParagraphTextItem().setTitle(T.liked);
  form.addParagraphTextItem().setTitle(T.confused);
  form.addParagraphTextItem().setTitle(T.useFor);
  form.addParagraphTextItem().setTitle(T.change);
  form.addMultipleChoiceItem().setTitle(T.pay).setChoiceValues(['Yes', 'Maybe', 'No']);
  form.addParagraphTextItem().setTitle(T.payWhy);
  form.addTextItem().setTitle(T.email)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('Please enter an email address, or leave this blank.').build());

  // Responses spreadsheet with a scored copy of every submission
  const ss = SpreadsheetApp.create('Folio usability study: responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  const scores = ss.insertSheet('Scores', 0);
  scores.appendRow(SCORE_HEAD);
  scores.setFrozenRows(1);
  scores.getRange(1, 1, 1, SCORE_HEAD.length).setFontWeight('bold').setBackground('#FFE3D3');

  const summary = ss.insertSheet('Summary', 0);
  summary.getRange('A1:B9').setValues([
    ['Folio usability study', ''],
    ['Responses', '=COUNTA(Scores!A2:A)'],
    ['Average SUS (target 70+)', '=IFERROR(ROUND(AVERAGE(Scores!O2:O),1),"-")'],
    ['Share of people at SUS 70+', '=IFERROR(COUNTIF(Scores!O2:O,">=70")/COUNT(Scores!O2:O),"-")'],
    ['Average Funza score (1-5)', '=IFERROR(ROUND(AVERAGE(Scores!P2:P),2),"-")'],
    ['Net Promoter Score', '=IFERROR(ROUND((COUNTIF(Scores!R2:R,"Promoter")-COUNTIF(Scores!R2:R,"Detractor"))/COUNTA(Scores!R2:R)*100,0),"-")'],
    ['Average tasks done alone (of 6)', '=IFERROR(ROUND(AVERAGE(Scores!M2:M),1),"-")'],
    ['Average task ease (1-7)', '=IFERROR(ROUND(AVERAGE(Scores!N2:N),1),"-")'],
    ['Task 2 page answered correctly', '=IFERROR(COUNTIF(Scores!T2:T,"Yes")/COUNTA(Scores!T2:T),"-")'],
  ]);
  summary.getRange('A1').setFontWeight('bold').setFontSize(14);
  summary.getRange('B4').setNumberFormat('0%');
  summary.getRange('B9').setNumberFormat('0%');
  summary.setColumnWidth(1, 260);
  const blank = ss.getSheetByName('Sheet1');
  if (blank) ss.deleteSheet(blank);

  let shortUrl = form.getPublishedUrl();
  try { shortUrl = form.shortenFormUrl(form.getPublishedUrl()); } catch (err) { /* keep the long link */ }

  const links = ss.insertSheet('Links');
  links.getRange('A1:B4').setValues([
    ['Share this link (and put it in the QR code)', shortUrl],
    ['Form editor', form.getEditUrl()],
    ['Prototype', PROTOTYPE_URL],
    ['Responses spreadsheet', ss.getUrl()],
  ]);
  links.setColumnWidth(1, 300);

  props.setProperties({
    FORM_ID: form.getId(),
    SHEET_ID: ss.getId(),
    SHORT_URL: shortUrl,
    NOTIFY: NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
  });
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();

  Logger.log('Done. Share this link: ' + shortUrl);
  Logger.log('Responses and scores: ' + ss.getUrl());
  Logger.log('Edit the form: ' + form.getEditUrl());
}

function onFormSubmit(e) {
  const props = PropertiesService.getScriptProperties();
  const a = {};
  e.response.getItemResponses().forEach((r) => { a[r.getItem().getTitle()] = r.getResponse(); });

  const toScore = (label) => AGREE.indexOf(label) + 1; // 1..5, 0 if missing
  let sus = '';
  const susAnswers = a[T.sus];
  if (Array.isArray(susAnswers) && susAnswers.length === 10 && susAnswers.every((x) => x)) {
    const total = susAnswers.map(toScore).reduce((sum, v, i) => sum + (i % 2 === 0 ? v - 1 : 5 - v), 0);
    sus = total * 2.5;
  }
  let funza = '';
  const funzaAnswers = a[T.funza];
  if (Array.isArray(funzaAnswers) && funzaAnswers.every((x) => x)) {
    funza = Math.round((funzaAnswers.map(toScore).reduce((s, v) => s + v, 0) / funzaAnswers.length) * 100) / 100;
  }
  const nps = a[T.nps] === undefined ? '' : Number(a[T.nps]);
  const npsGroup = nps === '' ? '' : nps >= 9 ? 'Promoter' : nps >= 7 ? 'Passive' : 'Detractor';
  const results = TASKS.map((t) => RESULT_SHORT[a[T.result(t.n)]] || '');
  const ease = TASKS.map((t) => Number(a[T.ease(t.n)])).filter((x) => x > 0);
  const avgEase = ease.length ? Math.round((ease.reduce((s, v) => s + v, 0) / ease.length) * 10) / 10 : '';
  const t2 = String(a[T.t2page] || '').replace(/[^0-9]/g, '');
  const t2Correct = t2 === '' ? '' : (t2 === '12' ? 'Yes' : 'No');

  const row = [
    e.response.getTimestamp(), a[T.pid] || '', a[T.role] || '', a[T.age] || '', a[T.device] || '', a[T.mode] || '',
    ...results,
    results.filter((r) => r === 'Own').length, avgEase, sus, funza, nps, npsGroup, a[T.pay] || '', t2Correct,
  ];
  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  ss.getSheetByName('Scores').appendRow(row);

  const to = props.getProperty('NOTIFY');
  if (to) {
    const body = [
      'A new Folio usability response arrived.',
      '',
      'SUS: ' + (sus === '' ? 'incomplete' : sus + ' / 100'),
      'Funza score: ' + (funza === '' ? 'incomplete' : funza + ' / 5'),
      'Recommend: ' + (nps === '' ? '-' : nps + ' / 10 (' + npsGroup + ')'),
      'Tasks done alone: ' + results.filter((r) => r === 'Own').length + ' of 6 (' + results.join(', ') + ')',
      'Liked most: ' + (a[T.liked] || '-'),
      'Confusing: ' + (a[T.confused] || '-'),
      '',
      'All responses and running averages: ' + ss.getUrl(),
    ].join('\n');
    MailApp.sendEmail(to, 'New Folio test response' + (sus === '' ? '' : ' (SUS ' + sus + ')'), body);
  }
}

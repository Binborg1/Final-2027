/** A step-by-step plan for a question, chosen by the kind of task it asks for. No answers, only structure. */

export type Scaffold = { type: string; steps: string[] };

const plans: { type: string; test: RegExp; steps: string[] }[] = [
  {
    type: "calculation",
    test: /\b(calculate|compute|determine|find|evaluate|estimate|solve|how (many|much|far|long|fast))\b/i,
    steps: [
      "Write down every value the question gives you, with its units.",
      "Write down exactly what you are asked to find, and its units.",
      "Choose the relationship or formula that links what you have to what you need.",
      "Substitute step by step; keep the units through every line.",
      "Check the size and sign of the result against common sense.",
    ],
  },
  {
    type: "proof",
    test: /\b(prove|show that|derive|demonstrate|verify)\b/i,
    steps: [
      "State precisely what must be shown.",
      "List the definitions, givens and known results you may use.",
      "Pick a strategy: direct argument, contradiction, induction or construction.",
      "Write each step with the reason that justifies it.",
      "Finish by stating that the claim has been shown.",
    ],
  },
  {
    type: "comparison",
    test: /\b(compare|contrast|difference|differences|versus|vs\.?|distinguish|advantages?|disadvantages?)\b/i,
    steps: [
      "Choose two or three criteria that matter for this topic.",
      "For each criterion, say how each option behaves.",
      "Give a concrete situation where each option is the better choice.",
      "Close with a one-sentence judgement.",
    ],
  },
  {
    type: "definition",
    test: /\b(define|what is|what are|meaning of|term)\b/i,
    steps: [
      "Give the definition in one clear sentence.",
      "Name the key property that makes it what it is.",
      "Give one concrete example.",
    ],
  },
  {
    type: "explanation",
    test: /\b(explain|describe|discuss|why|how does|how do|outline|justify|account for)\b/i,
    steps: [
      "Define the key term or terms in the question.",
      "Explain the mechanism or cause, step by step.",
      "Give one concrete example or case.",
      "Link your explanation back to what the question asked.",
    ],
  },
  {
    type: "design",
    test: /\b(design|draw|sketch|write (a|an|the) (program|function|algorithm|code)|implement|construct)\b/i,
    steps: [
      "List the inputs, outputs and constraints.",
      "Break the task into two to four parts.",
      "Build or draw each part, simplest first.",
      "Walk through one example from start to finish to check it.",
    ],
  },
];

const fallback: Scaffold = {
  type: "general",
  steps: [
    "Restate the question in your own words.",
    "List what you already know that relates to it.",
    "Decide the order you will tackle it in.",
    "Write your answer, then reread the question to check you answered all of it.",
  ],
};

export function scaffoldFor(questionText: string): Scaffold {
  for (const plan of plans) if (plan.test.test(questionText)) return { type: plan.type, steps: plan.steps };
  return fallback;
}

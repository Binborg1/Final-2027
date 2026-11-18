import type { BlockKind, BlockItem, CurriculumBlock } from "@/lib/curriculum/lesson";

/**
 * Funza's starter lesson for SCI10-FM2, used when no AI provider is set up or
 * AI drafting fails. This is Funza's own teaching content, not curriculum
 * text: the only official wording in a lesson is the outcome statement, which
 * comes from the catalog. Every calculation carries a fact the checks recompute.
 */

export const SCI10_FM2_TITLE = "Motion at a constant speed";

const OUTCOME = "sk-sci10-fm2";

function item(id: string, prompt: string, options: string[], correct: number, hints: string[], whyCorrect: string, fact: BlockItem["fact"]): BlockItem {
  return {
    id,
    prompt,
    options: options.map((text, i) => ({ id: String.fromCharCode(97 + i), text })),
    correctOptionId: String.fromCharCode(97 + correct),
    hints,
    whyCorrect,
    fact,
  };
}

function block(kind: BlockKind, fields: Omit<CurriculumBlock, "id" | "kind" | "outcomeIds" | "indicatorIds" | "origin" | "acknowledged" | "approvedFingerprint">): CurriculumBlock {
  return {
    id: `b-${kind}`,
    kind,
    outcomeIds: [OUTCOME],
    indicatorIds: [],
    origin: "template",
    acknowledged: null,
    approvedFingerprint: null,
    ...fields,
  };
}

export function sci10Fm2Template(): CurriculumBlock[] {
  return [
    block("objective", {
      title: "What you will learn",
      body: "By the end of this lesson you will be able to describe motion at a constant speed in a straight line, read and draw distance-time graphs for it, and use speed = distance ÷ time to make predictions. Constant speed means an object covers the same distance in every second.",
      secondLook: "Think of a car on cruise control on a straight highway: the speedometer needle stays still, so every second the car covers the same number of metres.",
      teaches: "Sets the goal: describing and representing constant-speed motion in a straight line.",
      evidence: "Students identify what constant speed means before the investigation starts.",
      motion: null,
      items: [
        item(
          "q1",
          "An object moves at a constant speed in a straight line. Which statement is true?",
          ["It covers the same distance in every second.", "It covers more distance in every second.", "It must be standing still.", "Its direction keeps changing."],
          0,
          ["Constant means unchanging. What stays the same from one second to the next?", "Compare the distance covered in the first second with the distance covered in the second."],
          "Constant speed means the distance covered each second never changes, so equal times give equal distances.",
          null,
        ),
      ],
    }),
    block("explanation", {
      title: "Speed, distance and time",
      body: "Speed tells you how far an object travels each second: speed = distance ÷ time, measured in metres per second (m/s). If a cyclist rides at 5 m/s for 4 s, the distance is 5 × 4 = 20 m. At a constant speed, distance grows by the same amount every second, so a graph of distance against time is a straight line. The steeper the line, the faster the object.",
      secondLook: "Picture adding one equal stack of metres for every second that passes. A faster object adds bigger stacks, so its total grows more steeply.",
      teaches: "The relationship speed = distance ÷ time, and why constant speed gives a straight distance-time graph.",
      evidence: "Students calculate a distance from a speed and a time.",
      motion: null,
      items: [
        item(
          "q1",
          "A skateboarder moves at a constant 3 m/s for 6 s. How far does the skateboarder travel?",
          ["9 m", "18 m", "2 m", "0.5 m"],
          1,
          ["Distance = speed × time.", "Multiply 3 m/s by 6 s."],
          "Distance = speed × time = 3 m/s × 6 s = 18 m.",
          { kind: "distance", speed: 3, time: 6 },
        ),
      ],
    }),
    block("graph", {
      title: "Two cyclists on a distance-time graph",
      body: "Ava rides at 4 m/s and Ben rides at 2 m/s, both starting from the same place. Play the graph and compare their lines. Each line is straight because each speed is constant, and the slope of each line is the speed.",
      secondLook: "Slope is rise over run: how many metres the line climbs for each second. A line that climbs 4 m every second is steeper than one that climbs 2 m.",
      teaches: "Representing constant-speed motion on a distance-time graph, and reading speed from the slope.",
      evidence: "Students compare slopes to decide which object is faster.",
      motion: { objects: [{ label: "Ava", speed: 4 }, { label: "Ben", speed: 2 }], duration: 10, askTime: null },
      items: [
        item(
          "q1",
          "Which cyclist is moving faster?",
          ["Ava, because her line is steeper", "Ben, because his line is less steep", "They move at the same speed because both lines are straight", "You cannot tell from a distance-time graph"],
          0,
          ["The slope of a distance-time line is the speed.", "Which line climbs more metres for each second?"],
          "Ava's line climbs 4 m every second and Ben's climbs 2 m, so Ava's steeper line shows the greater speed.",
          { kind: "fastest" },
        ),
      ],
    }),
    block("prediction", {
      title: "Predict where the cart will be",
      body: "A cart rolls along a straight track at a constant 3 m/s. Before the graph shows it, predict how far the cart will have travelled after 5 s. Then check your prediction against the graph.",
      secondLook: "Each second adds another 3 m. Count up 3, 6, 9 and so on until you reach 5 seconds.",
      teaches: "Using the constant-speed relationship to predict a future position, then testing the prediction against a graph.",
      evidence: "Students make a quantitative prediction and check it against the representation.",
      motion: { objects: [{ label: "Cart", speed: 3 }], duration: 8, askTime: 5 },
      items: [
        item(
          "q1",
          "The cart moves at a constant 3 m/s. How far has it travelled after 5 s?",
          ["8 m", "15 m", "1.67 m", "0.6 m"],
          1,
          ["The cart adds 3 m every second.", "Multiply the speed by the time: 3 × 5."],
          "At a constant 3 m/s, 5 s gives 3 × 5 = 15 m, which is where the graph shows the cart.",
          { kind: "distance", speed: 3, time: 5 },
        ),
      ],
    }),
    block("assessment", {
      title: "Check your understanding",
      body: "Answer these questions about motion at a constant speed. Use what you know about speed, distance, time and distance-time graphs.",
      secondLook: "Remember: speed = distance ÷ time, a straight distance-time line means a constant speed, and a flat line means the object has stopped.",
      teaches: "Applying the constant-speed relationship and interpreting distance-time graphs.",
      evidence: "Students answer calculation and graph-reading questions without help.",
      motion: null,
      items: [
        item(
          "q1",
          "A runner covers 100 m in 20 s at a constant speed. What is the runner's speed?",
          ["5 m/s", "2000 m/s", "0.2 m/s", "120 m/s"],
          0,
          ["Speed = distance ÷ time.", "Divide 100 m by 20 s."],
          "Speed = 100 m ÷ 20 s = 5 m/s.",
          { kind: "speed", distance: 100, time: 20 },
        ),
        item(
          "q2",
          "On a distance-time graph, what does a horizontal line show?",
          ["The object is moving at a constant speed", "The object has stopped", "The object is speeding up", "The object is moving backwards"],
          1,
          ["A horizontal line means the distance stays the same.", "If distance does not change as time passes, how fast is the object moving?"],
          "A flat line means the distance is not changing, so the speed is zero: the object has stopped.",
          null,
        ),
        item(
          "q3",
          "A bus travels at a constant 12 m/s. How long does it take to travel 60 m?",
          ["5 s", "720 s", "0.2 s", "48 s"],
          0,
          ["Time = distance ÷ speed.", "Divide 60 m by 12 m/s."],
          "Time = 60 m ÷ 12 m/s = 5 s.",
          { kind: "time", distance: 60, speed: 12 },
        ),
      ],
    }),
  ];
}

export function sci10Fm2TemplateBlock(kind: BlockKind): CurriculumBlock {
  const found = sci10Fm2Template().find((b) => b.kind === kind);
  if (!found) throw new Error(`No template block for ${kind}`);
  return found;
}

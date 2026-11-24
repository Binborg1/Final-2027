import type { BankItem } from "@/lib/resources/types";

/**
 * Funza's starter bank: questions and notes written by hand
 * by the Funza team for Saskatchewan Science 10, Force and Motion (SCI10-FM2
 * and FM3), with the physics checked. It is the no-AI path: when no AI provider
 * is configured, or the teacher prefers it, a draft is assembled from here and
 * marked "From Funza's question bank". It is never presented as AI output, and
 * every part still goes through the teacher's review.
 */

const FM2 = "sk-63-110477"; // SCI10-FM2
const FM3 = "sk-63-110487"; // SCI10-FM3

/* ---------- questions ---------- */

type P = Partial<BankItem> & Pick<BankItem, "id" | "type" | "prompt" | "outcomeIds" | "difficulty">;
const item = (p: P): BankItem => ({ options: [], correctId: null, tf: null, answer: "", pairs: [], calc: null, solution: "", verbs: [], rubricLines: [], ...p });
const opts = (...texts: string[]) => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));

export const BANK: BankItem[] = [
  /* SCI10-FM2 */
  item({
    id: "f2-mc1",
    type: "mcq",
    prompt: "A distance–time graph is a straight line rising from the origin. What does it show?",
    options: opts("The object is speeding up", "The object is moving at a constant speed", "The object is moving uphill", "The object is not moving"),
    correctId: "b",
    solution: "A straight line means equal distances in equal times, so the speed is constant. The graph is not a picture of the path.",
    outcomeIds: [FM2],
    difficulty: "foundational",
    verbs: ["represent"],
  }),
  item({
    id: "f2-mc2",
    type: "mcq",
    prompt: "On one distance–time graph, line A is steeper than line B. Which object is faster?",
    options: opts("Object A", "Object B", "Neither: both lines are straight, so the speeds are equal", "You cannot tell from a distance–time graph"),
    correctId: "a",
    solution: "The slope of a distance–time graph is the speed, so the steeper line belongs to the faster object.",
    outcomeIds: [FM2],
    difficulty: "foundational",
    verbs: ["represent"],
  }),
  item({
    id: "f2-mc3",
    type: "mcq",
    prompt: "A horizontal line on a distance–time graph means the object is…",
    options: opts("moving at a constant speed", "stopped", "moving backwards", "speeding up"),
    correctId: "b",
    solution: "The distance does not change as time passes, so the object is not moving.",
    outcomeIds: [FM2],
    difficulty: "foundational",
    verbs: ["represent"],
  }),
  item({
    id: "f2-mc4",
    type: "mcq",
    prompt: "A cart moves at a constant 3 m/s for 4 s. How far does it travel?",
    options: opts("7 m", "0.75 m", "12 m", "1.33 m"),
    correctId: "c",
    calc: { expr: "v*t", vars: { v: 3, t: 4 }, unit: "m", show: "3 m/s × 4 s" },
    solution: "d = v × t = 3 m/s × 4 s = 12 m",
    outcomeIds: [FM2],
    difficulty: "grade",
  }),
  item({
    id: "f2-mc5",
    type: "mcq",
    prompt: "Which equation relates distance (d), speed (v) and time (t) for an object in uniform motion?",
    options: opts("d = v × t", "d = v ÷ t", "d = v + t", "d = t ÷ v"),
    correctId: "a",
    solution: "Speed is distance per unit of time, v = d ÷ t, so d = v × t.",
    outcomeIds: [FM2],
    difficulty: "foundational",
  }),
  item({
    id: "f2-mc6",
    type: "mcq",
    prompt: "A runner covers 100 m in 20 s at a constant speed. What is the runner's speed?",
    options: opts("5 m/s", "0.2 m/s", "120 m/s", "2000 m/s"),
    correctId: "a",
    calc: { expr: "d/t", vars: { d: 100, t: 20 }, unit: "m/s", show: "100 m ÷ 20 s" },
    solution: "v = d ÷ t = 100 m ÷ 20 s = 5 m/s",
    outcomeIds: [FM2],
    difficulty: "grade",
  }),
  item({ id: "f2-tf1", type: "tf", prompt: "An object travelling at a constant speed covers equal distances in equal time intervals.", tf: true, outcomeIds: [FM2], difficulty: "foundational" }),
  item({
    id: "f2-tf2",
    type: "tf",
    prompt: "A steeper line on a distance–time graph means a slower object.",
    tf: false,
    solution: "A steeper line means more distance each second: a faster object.",
    outcomeIds: [FM2],
    difficulty: "foundational",
    verbs: ["represent"],
  }),
  item({
    id: "f2-tf3",
    type: "tf",
    prompt: "Speed is a vector quantity.",
    tf: false,
    solution: "Speed has size only, so it is a scalar. Velocity, which has a direction, is the vector.",
    outcomeIds: [FM2],
    difficulty: "grade",
  }),
  item({
    id: "f2-tf4",
    type: "tf",
    prompt: "If a distance–time graph is a horizontal line, the object's speed is zero.",
    tf: true,
    outcomeIds: [FM2],
    difficulty: "foundational",
    verbs: ["represent"],
  }),
  item({ id: "f2-fi1", type: "fill", prompt: "Speed is the ______ travelled per unit of time.", answer: "distance", outcomeIds: [FM2], difficulty: "foundational" }),
  item({
    id: "f2-fi2",
    type: "fill",
    prompt: "On a distance–time graph, the ______ of the line is equal to the speed.",
    answer: "slope (also accept: gradient)",
    outcomeIds: [FM2],
    difficulty: "grade",
    verbs: ["represent"],
  }),
  item({
    id: "f2-ma1",
    type: "match",
    prompt: "Match each distance–time graph to the motion it shows.",
    pairs: [
      { left: "A straight line rising steeply", right: "Moving quickly at a constant speed" },
      { left: "A straight line rising gently", right: "Moving slowly at a constant speed" },
      { left: "A horizontal line", right: "Not moving" },
    ],
    outcomeIds: [FM2],
    difficulty: "grade",
    verbs: ["represent"],
  }),
  item({
    id: "f2-ca1",
    type: "calc",
    prompt: "A cyclist rides at a constant 6 m/s. How long does it take her to travel 150 m?",
    answer: "25 s",
    calc: { expr: "d/v", vars: { d: 150, v: 6 }, unit: "s", show: "150 m ÷ 6 m/s" },
    solution: "t = d ÷ v = 150 m ÷ 6 m/s = 25 s",
    outcomeIds: [FM2],
    difficulty: "grade",
  }),
  item({
    id: "f2-ca2",
    type: "calc",
    prompt: "A train travels 420 km in 3.5 h at a constant speed. What is its speed?",
    answer: "120 km/h",
    calc: { expr: "d/t", vars: { d: 420, t: 3.5 }, unit: "km/h", show: "420 km ÷ 3.5 h" },
    solution: "v = d ÷ t = 420 km ÷ 3.5 h = 120 km/h",
    outcomeIds: [FM2],
    difficulty: "grade",
  }),
  item({
    id: "f2-ca3",
    type: "calc",
    prompt: "Maya walks 1.2 km to school at a constant 1.5 m/s. How many minutes does the walk take?",
    answer: "13.3 min",
    calc: { expr: "d*1000/v/60", vars: { d: 1.2, v: 1.5 }, unit: "min", show: "1200 m ÷ 1.5 m/s ÷ 60 s/min" },
    solution: "t = 1200 m ÷ 1.5 m/s = 800 s, and 800 s ÷ 60 = 13.3 min",
    outcomeIds: [FM2],
    difficulty: "extending",
  }),
  item({
    id: "f2-ca4",
    type: "calc",
    prompt: "A survey drone flies at a constant 12 m/s for 45 s. How far does it travel?",
    answer: "540 m",
    calc: { expr: "v*t", vars: { v: 12, t: 45 }, unit: "m", show: "12 m/s × 45 s" },
    solution: "d = v × t = 12 m/s × 45 s = 540 m",
    outcomeIds: [FM2],
    difficulty: "foundational",
  }),
  item({
    id: "f2-sh1",
    type: "short",
    prompt: "Two students walk home at constant speeds. Describe how you would show, on one distance–time graph, that Student A walks faster than Student B.",
    rubricLines: [
      "Labels the axes: time (s) across, distance (m) up",
      "Draws both lines straight, starting at the origin",
      "Draws Student A's line steeper than Student B's",
      "Explains that the slope of each line is that student's speed",
    ],
    outcomeIds: [FM2],
    difficulty: "extending",
    verbs: ["represent"],
  }),
  item({
    id: "f2-sh2",
    type: "short",
    prompt: "A classmate says, “The line on a distance–time graph shows the path the object took.” Explain why this is not correct.",
    rubricLines: [
      "States that the graph shows distance against time, not a map of the path",
      "Points out that the horizontal axis is time",
      "Gives an example, such as a straight road and a winding road giving the same graph at the same speed",
    ],
    outcomeIds: [FM2],
    difficulty: "grade",
    verbs: ["represent"],
  }),
  item({
    id: "f2-lo1",
    type: "long",
    prompt:
      "Plan an investigation to test whether a toy car moves at a constant speed. Describe what you would measure, the equipment you would use, and how you would represent your results.",
    rubricLines: [
      "Identifies distance and time as the measurements",
      "Chooses suitable equipment, such as tape marks, a metre stick and a stopwatch or motion detector",
      "Takes repeated measurements at equal distance or time intervals",
      "Organizes results in a data table with units",
      "Plots a distance–time graph with labelled axes",
      "Explains that a straight line would show a constant speed",
    ],
    outcomeIds: [FM2],
    difficulty: "extending",
    verbs: ["investigate", "represent"],
  }),

  /* SCI10-FM3 */
  item({
    id: "f3-mc1",
    type: "mcq",
    prompt: "A car speeds up from rest to 20 m/s in 4 s. What is its acceleration?",
    options: opts("80 m/s²", "5 m/s²", "0.2 m/s²", "24 m/s²"),
    correctId: "b",
    calc: { expr: "dv/t", vars: { dv: 20, t: 4 }, unit: "m/s²", show: "20 m/s ÷ 4 s" },
    solution: "a = Δv ÷ Δt = 20 m/s ÷ 4 s = 5 m/s²",
    outcomeIds: [FM3],
    difficulty: "grade",
  }),
  item({
    id: "f3-mc2",
    type: "mcq",
    prompt: "On a speed–time graph, a straight line rising from the origin shows…",
    options: opts("constant acceleration", "constant speed", "an object at rest", "an object slowing down"),
    correctId: "a",
    solution: "Speed increases by the same amount each second: a constant acceleration.",
    outcomeIds: [FM3],
    difficulty: "grade",
    verbs: ["represent"],
  }),
  item({
    id: "f3-mc3",
    type: "mcq",
    prompt: "Which of these is a unit of acceleration?",
    options: opts("m/s", "m/s²", "s/m", "m"),
    correctId: "b",
    outcomeIds: [FM3],
    difficulty: "foundational",
  }),
  item({ id: "f3-tf1", type: "tf", prompt: "An object moving at a constant speed in a straight line has zero acceleration.", tf: true, outcomeIds: [FM3], difficulty: "grade" }),
  item({ id: "f3-fi1", type: "fill", prompt: "Acceleration is the rate of change of ______.", answer: "velocity", outcomeIds: [FM3], difficulty: "foundational" }),
  item({
    id: "f3-ca1",
    type: "calc",
    prompt: "A cyclist speeds up from 2 m/s to 8 m/s in 3 s. What is her acceleration?",
    answer: "2 m/s²",
    calc: { expr: "(v2-v1)/t", vars: { v1: 2, v2: 8, t: 3 }, unit: "m/s²", show: "(8 m/s − 2 m/s) ÷ 3 s" },
    solution: "a = Δv ÷ Δt = (8 − 2) m/s ÷ 3 s = 2 m/s²",
    outcomeIds: [FM3],
    difficulty: "grade",
  }),
  item({
    id: "f3-ca2",
    type: "calc",
    prompt: "A ball rolling at 6 m/s slows down evenly and stops in 2 s. What is its acceleration?",
    answer: "−3 m/s²",
    calc: { expr: "(v2-v1)/t", vars: { v1: 6, v2: 0, t: 2 }, unit: "m/s²", show: "(0 − 6 m/s) ÷ 2 s" },
    solution: "a = Δv ÷ Δt = (0 − 6) m/s ÷ 2 s = −3 m/s²; the minus sign means the ball is slowing down.",
    outcomeIds: [FM3],
    difficulty: "extending",
  }),
  item({
    id: "f3-sh1",
    type: "short",
    prompt: "Explain the difference between speed and acceleration. Use an example from everyday life.",
    rubricLines: [
      "Defines speed as distance travelled per unit of time",
      "Defines acceleration as the change in velocity per unit of time",
      "Gives a correct everyday example of acceleration",
    ],
    outcomeIds: [FM3],
    difficulty: "grade",
  }),
];

/* ---------- notes ---------- */

export const NOTES: Record<string, { title: string; body: string; claim?: { expr: string; vars: Record<string, number>; unit: string; show: string; stated: string } }[]> = {
  [FM2]: [
    {
      title: "What uniform motion means",
      body: "An object is in uniform motion when it travels at a constant speed in a straight line. It covers equal distances in equal intervals of time.\n- A car on cruise control on a straight, flat highway is close to uniform motion.\n- A puck sliding across smooth ice is close to uniform motion until friction slows it down.",
    },
    {
      title: "Speed, distance and time",
      body: "Speed tells you how much distance an object covers each second: v = d ÷ t. Rearranged, d = v × t and t = d ÷ v.\n- Speed is a scalar: it has a size but no direction.\n- Units: metres per second (m/s), or kilometres per hour (km/h) for longer trips.",
    },
    {
      title: "Distance–time graphs",
      body: "Time goes on the horizontal axis and distance on the vertical axis.\n- Uniform motion gives a straight line.\n- The slope of the line is the speed: a steeper line means a faster object.\n- A horizontal line means the object is not moving.",
    },
    {
      title: "Worked example",
      body: "A cyclist rides at a constant 6 m/s for 25 s. How far does she travel?\nd = v × t = 6 m/s × 25 s = 150 m",
      claim: { expr: "v*t", vars: { v: 6, t: 25 }, unit: "m", show: "6 m/s × 25 s", stated: "150 m" },
    },
  ],
  [FM3]: [
    { title: "What acceleration means", body: "Acceleration is the rate at which velocity changes. An object accelerates when it speeds up, slows down or changes direction." },
    {
      title: "Calculating acceleration",
      body: "a = Δv ÷ Δt, measured in m/s².\nA cyclist speeds up from 2 m/s to 8 m/s in 3 s: a = (8 − 2) m/s ÷ 3 s = 2 m/s².",
      claim: { expr: "(v2-v1)/t", vars: { v1: 2, v2: 8, t: 3 }, unit: "m/s²", show: "(8 − 2) m/s ÷ 3 s", stated: "2 m/s²" },
    },
    { title: "Speed–time graphs", body: "On a speed–time graph, a straight rising line shows constant acceleration. Its slope is the acceleration." },
  ],
};

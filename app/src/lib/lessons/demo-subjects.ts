import type { Topic } from "@/lib/types";
import { checkVisualization } from "@/lib/visualizations/registry";
import type { VisualizationConfig } from "@/lib/visualizations/types";
import { tcpIpTopics } from "./demo-tcpip";
import { SAMPLE_COURSE_ID } from "./sample";

/**
 * Built-in lessons for subjects other than networking. They exist to show that
 * one visualization engine serves mathematics, physics, computer science and
 * biology: each concept below asks for a generic visualization type with its
 * own content, exactly as an AI-planned lesson would.
 */

/** Validates authored demo content once, at load, so a mistake fails fast instead of rendering nothing. */
function viz(raw: { type: string; params: Record<string, unknown> }): VisualizationConfig {
  const result = checkVisualization(raw);
  if (!result.ok) throw new Error(`Invalid sample visualization: ${result.reason}`);
  return result.config;
}

/* ---------- mathematics ---------- */

export const mathematicsTopics: Topic[] = [
  {
    id: "quadratics",
    title: "Quadratic functions",
    summary: "y = ax² + bx + c draws a parabola. The sign of a sets its direction, and the vertex and roots can be read from the coefficients.",
    whyItMatters:
      "Parabolas describe thrown balls, bridge cables and profit curves. Reading the vertex and the roots straight from the equation is the first step in solving any of those problems.",
    concepts: [
      {
        id: "parabola-shape",
        title: "The shape of a parabola",
        explanation:
          "A quadratic function y = ax² + bx + c draws a parabola. The coefficient a decides which way it opens: positive a opens upwards, negative a opens downwards, and a bigger size of a makes it narrower. The turning point is the vertex, at x = -b / (2a). Where the curve crosses the x axis (if it does), y = 0; those x values are the roots.",
        alternateExplanation:
          "Think of a ball thrown in the air: its height over time is a parabola that opens downwards, and the vertex is the highest point. Flip the sign of a and you get the shape of a hanging cable instead: the same curve, opening upwards.",
        visualization: viz({
          type: "function-graph",
          params: {
            title: "y = ax² + bx + c",
            observe: "Watch which way the parabola opens as a changes, and where the vertex sits.",
            xLabel: "x",
            yLabel: "y",
            xRange: [-6, 6],
            yRange: [-10, 10],
            parameters: [
              { key: "a", label: "a", min: -3, max: 3, step: 1, value: 1 },
              { key: "b", label: "b", min: -6, max: 6, step: 1, value: -2 },
              { key: "c", label: "c", min: -8, max: 8, step: 1, value: -3 },
            ],
            curves: [{ id: "f", label: "y = ax² + bx + c", expression: "a*x^2 + b*x + c" }],
            stages: [
              { id: "shape", caption: "This is y = {a}x² + {b}x + {c}. With a = {a} the parabola opens upwards, like a cup." },
              {
                id: "vertex",
                caption: "The turning point is the vertex, at x = -b / (2a) = {-b/(2*a)}, where y = {c - b^2/(4*a)}. Everything is symmetric about that x.",
                set: { a: 1, b: -2, c: -3 },
                marker: { curve: "f", x: "-b/(2*a)" },
                guides: true,
              },
              {
                id: "roots",
                caption: "Where the curve crosses the x axis, y = 0. Those crossings are the roots: here x = {(-b - sqrt(b^2 - 4*a*c))/(2*a)} and x = {(-b + sqrt(b^2 - 4*a*c))/(2*a)}.",
                set: { a: 1, b: -2, c: -3 },
                marker: { curve: "f", x: "(-b - sqrt(b^2 - 4*a*c))/(2*a)" },
                guides: true,
              },
              {
                id: "flip",
                caption: "Now a = -1. The parabola opens downwards, and the vertex at x = {-b/(2*a)} is the highest point instead of the lowest.",
                set: { a: -1, b: -2, c: -3 },
                marker: { curve: "f", x: "-b/(2*a)" },
                guides: true,
              },
              {
                id: "narrow",
                caption: "A bigger size of a makes the parabola narrower: with a = 3 the curve climbs much faster away from the vertex.",
                set: { a: 3, b: -2, c: -3 },
                marker: { curve: "f", x: "-b/(2*a)" },
                guides: false,
              },
            ],
            checkpoints: [
              {
                beforeStage: 3,
                prompt: "The coefficient a is about to change from 1 to -1. What happens to the parabola?",
                options: [
                  { id: "a", text: "It flips to open downwards, and the vertex becomes the highest point." },
                  { id: "b", text: "It moves to the left but keeps the same shape." },
                  { id: "c", text: "Nothing changes; a only affects where the curve crosses the y axis." },
                ],
                correctId: "a",
                whenRight: "Right. The sign of a decides which way the parabola opens; b and c only move it around.",
                whenWrong: "Not quite. The y intercept is c, not a. The sign of a decides the direction: a negative a opens downwards.",
              },
            ],
          },
        }),
        question: {
          kind: "mcq",
          prompt: "For y = 2x² - 4x + 1, which way does the parabola open, and where is its vertex?",
          options: [
            { id: "a", text: "Upwards, with the vertex at x = 1." },
            { id: "b", text: "Downwards, with the vertex at x = 1." },
            { id: "c", text: "Upwards, with the vertex at x = -1." },
            { id: "d", text: "Downwards, with the vertex at x = 2." },
          ],
          correctOptionId: "a",
        },
        whyCorrect: "a = 2 is positive, so the parabola opens upwards, and the vertex is at x = -b / (2a) = 4 / 4 = 1.",
        hints: ["Look at the sign of a first. Then use x = -b / (2a) for the vertex.", "Here a = 2 and b = -4, so -b / (2a) = 4 / 4."],
      },
      {
        id: "transformations",
        title: "Transformations: sliding, turning and scaling",
        explanation:
          "A transformation moves or changes a shape. A translation slides every point the same distance, a rotation turns the shape about a point, and both keep every length the same. Scaling (an enlargement) multiplies every length by a factor k, so the area is multiplied by k × k.",
        alternateExplanation:
          "Picture a paper triangle on a desk. Sliding it or turning it leaves it the same size. Only a photocopier set to 200 per cent changes its size, and the copy covers four times the paper, not two.",
        visualization: viz({
          type: "geometry-scene",
          params: {
            title: "Moving a triangle",
            observe: "Watch which transformations change the size of the shape and which only move it.",
            range: [0, 10],
            parameters: [
              { key: "dx", label: "Slide right", min: 0, max: 5, step: 1, value: 3 },
              { key: "k", label: "Scale factor", min: 1.5, max: 3, step: 0.5, value: 2 },
            ],
            shapes: [
              {
                id: "tri",
                kind: "polygon",
                points: [
                  [1, 1],
                  [4, 1],
                  [2, 4],
                ],
                label: "T",
              },
              { id: "origin", kind: "point", center: [0, 0], label: "O" },
            ],
            stages: [
              { id: "start", caption: "Triangle T has corners at (1, 1), (4, 1) and (2, 4). Its base runs from (1, 1) to (4, 1), 3 units long.", measures: [{ from: [1, 1], to: [4, 1], label: "3" }] },
              {
                id: "translate",
                caption: "A translation slides every point the same way: here {dx} units to the right. Shape and size do not change, so the base is still 3 units.",
                transforms: { tri: { translate: ["dx", 0] } },
                measures: [{ from: ["1+dx", 1], to: ["4+dx", 1], label: "still 3" }],
              },
              {
                id: "rotate",
                caption: "A rotation turns the shape about a point, here 90 degrees counter-clockwise about its own centre. Every length stays the same.",
                transforms: { tri: { translate: ["dx", 0], rotate: 90 } },
              },
              {
                id: "scale",
                caption: "Scaling by {k} multiplies every length by {k}: the base becomes {3*k} units, and the area becomes {k*k} times as large.",
                transforms: { tri: { translate: ["dx", 0], scale: "k" } },
              },
            ],
            checkpoints: [
              {
                beforeStage: 3,
                prompt: "The triangle is about to be scaled by a factor of {k}. Its base is 3 units long. What happens to the base and to the area?",
                options: [
                  { id: "a", text: "Base {3*k} units; area {k} times as large." },
                  { id: "b", text: "Base {3*k} units; area {k*k} times as large." },
                  { id: "c", text: "Base still 3 units; only the position changes." },
                ],
                correctId: "b",
                whenRight: "Exactly. Lengths scale by k, and area is length times length, so it scales by k squared.",
                whenWrong: "Not quite. Every length is multiplied by k, and area is made of two lengths, so it is multiplied by k × k.",
              },
            ],
          },
        }),
        question: {
          kind: "mcq",
          prompt: "A shape with an area of 6 cm² is enlarged by a scale factor of 3. What is the area of the enlargement?",
          options: [
            { id: "a", text: "9 cm²" },
            { id: "b", text: "18 cm²" },
            { id: "c", text: "54 cm²" },
            { id: "d", text: "6 cm², because enlargements keep the area." },
          ],
          correctOptionId: "c",
        },
        whyCorrect: "Every length is multiplied by 3, so the area is multiplied by 3 × 3 = 9: 6 × 9 = 54 cm².",
        hints: ["Area has two dimensions. What happens to each of them?", "Multiply the area by the scale factor twice."],
      },
    ],
  },
];

/* ---------- physics ---------- */

export const physicsTopics: Topic[] = [
  {
    id: "kinematics",
    title: "Speed, distance and time",
    summary: "At a steady speed, distance grows in proportion to time: distance = speed × time, and a distance-time graph is a straight line whose slope is the speed.",
    whyItMatters: "Every journey estimate, every speed limit and every collision calculation starts from this one relationship and its graph.",
    concepts: [
      {
        id: "distance-speed-time",
        title: "Distance = speed × time",
        explanation:
          "Speed is how much distance is covered each second. At a steady speed v, the distance after a time t is d = v × t: every extra second adds the same v metres. Double the speed and the same time covers twice the distance; double the time and it does too.",
        alternateExplanation:
          "A tap filling a bucket works the same way. The flow rate is the speed, the water collected is the distance, and leaving the tap on twice as long collects twice as much.",
        visualization: viz({
          type: "quantity-model",
          params: {
            title: "d = v × t",
            observe: "Watch the distance bar grow in equal steps while the speed bar stays the same.",
            parameters: [
              { key: "v", label: "Speed", min: 1, max: 20, step: 1, value: 5, unit: "m/s" },
              { key: "t", label: "Time", min: 0, max: 10, step: 1, value: 4, unit: "s" },
            ],
            quantities: [
              { id: "v", label: "Speed", unit: "m/s", expression: "v" },
              { id: "t", label: "Time", unit: "s", expression: "t" },
              { id: "d", label: "Distance", unit: "m", expression: "v*t" },
            ],
            stages: [
              { id: "start", caption: "A cyclist rides at a steady {v} m/s. At t = 0 no distance has been covered yet.", set: { t: 0 }, highlight: ["v"] },
              { id: "one", caption: "After 1 second the cyclist has gone {v} metres: distance = speed × time = {v} × 1.", set: { t: 1 }, highlight: ["d"] },
              { id: "two", caption: "After 2 seconds: {v} × 2 = {2*v} metres. Each second adds the same {v} metres.", set: { t: 2 }, highlight: ["d"] },
              { id: "four", caption: "After 4 seconds the distance is {v} × 4 = {4*v} metres. The bar grows in equal steps because the speed never changes.", set: { t: 4 }, highlight: ["d"] },
              { id: "faster", caption: "A faster rider at {v} m/s covers {v*t} metres in the same {t} seconds: more speed, more distance in the same time.", set: { v: 10, t: 4 }, highlight: ["v", "d"] },
            ],
            checkpoints: [
              {
                beforeStage: 3,
                prompt: "The cyclist keeps going at {v} m/s. How far will they have gone after 4 seconds?",
                options: [
                  { id: "a", text: "{4*v} m" },
                  { id: "b", text: "{v + 4} m" },
                  { id: "c", text: "{2*v} m" },
                ],
                correctId: "a",
                whenRight: "Yes: distance = speed × time = {v} × 4 = {4*v} m.",
                whenWrong: "Not quite. Multiply, do not add: {v} m/s for 4 s is {v} × 4 = {4*v} m.",
              },
            ],
          },
        }),
        question: {
          kind: "mcq",
          prompt: "A train travels at a steady 30 m/s. How far does it go in 2 minutes?",
          options: [
            { id: "a", text: "60 m" },
            { id: "b", text: "900 m" },
            { id: "c", text: "3600 m" },
            { id: "d", text: "1800 m" },
          ],
          correctOptionId: "c",
        },
        whyCorrect: "Two minutes is 120 seconds, and 30 m/s × 120 s = 3600 m.",
        hints: ["Convert the time to seconds first, because the speed is in metres per second.", "2 minutes = 120 seconds. Now multiply by the speed."],
      },
      {
        id: "distance-time-graph",
        title: "Reading a distance-time graph",
        explanation:
          "A distance-time graph plots distance covered against time. A steady speed gives a straight line, and the slope of that line (rise over run) is the speed. A steeper line means a faster object; a flat line means it has stopped.",
        alternateExplanation:
          "Imagine two runners on a track photographed every second. The faster one is further along in every photo, so the line joining their positions rises more steeply.",
        visualization: viz({
          type: "function-graph",
          params: {
            title: "Distance against time",
            observe: "Watch the marker climb the line at a steady rate, and compare the slope of the two riders.",
            xLabel: "time (s)",
            yLabel: "distance (m)",
            xRange: [0, 10],
            yRange: null,
            parameters: [{ key: "v", label: "Speed of rider A", min: 1, max: 10, step: 1, value: 4, unit: "m/s" }],
            curves: [
              { id: "one", label: "Rider A", expression: "v*x" },
              { id: "two", label: "Rider B, twice as fast", expression: "2*v*x" },
            ],
            stages: [
              { id: "line", caption: "Rider A moves at {v} m/s. On a distance-time graph that is a straight line: every second adds {v} metres.", show: ["one"], marker: { curve: "one", x: 0 } },
              { id: "three", caption: "After 3 seconds rider A has covered {3*v} m. The point (3, {3*v}) sits on the line.", show: ["one"], marker: { curve: "one", x: 3 }, guides: true },
              { id: "eight", caption: "After 8 seconds: {8*v} m. The slope of the line, rise over run, is {8*v} / 8 = {v}: the speed.", show: ["one"], marker: { curve: "one", x: 8 }, guides: true },
              { id: "both", caption: "Rider B goes twice as fast, {2*v} m/s. The line is steeper: at 8 s rider B has covered {16*v} m, twice as far.", marker: { curve: "two", x: 8 }, guides: true },
            ],
            checkpoints: [
              {
                beforeStage: 3,
                prompt: "A second rider, B, goes twice as fast as rider A. How will the line for rider B compare?",
                options: [
                  { id: "a", text: "Steeper: twice the distance at every moment." },
                  { id: "b", text: "The same slope, but starting higher up." },
                  { id: "c", text: "Less steep, because rider B finishes sooner." },
                ],
                correctId: "a",
                whenRight: "Right. The slope is the speed, so twice the speed means a line twice as steep.",
                whenWrong: "Not quite. Both riders start at distance 0; what differs is how fast the distance grows, which is the slope of the line.",
              },
            ],
          },
        }),
        question: {
          kind: "mcq",
          prompt: "On a distance-time graph, what does a horizontal (flat) section of the line mean?",
          options: [
            { id: "a", text: "The object is moving at a steady speed." },
            { id: "b", text: "The object has stopped." },
            { id: "c", text: "The object is speeding up." },
            { id: "d", text: "The object is moving backwards." },
          ],
          correctOptionId: "b",
        },
        whyCorrect: "A flat line means the distance is not changing as time passes: the object is standing still. The slope is the speed, and a slope of zero is a speed of zero.",
        hints: ["The slope of the line is the speed. What is the slope of a flat line?", "If distance stays the same while time passes, how fast is the object moving?"],
      },
    ],
  },
];

/* ---------- computer science ---------- */

/** Runs bubble sort and records a stage per comparison, so the demo shows exactly what the algorithm does. */
function bubbleSortStages(values: number[]) {
  const ids = values.map((_, i) => `p${i}`);
  const arr = [...values];
  const snapshot = () => Object.fromEntries(ids.map((id, i) => [id, arr[i]]));
  const stages: { id: string; caption: string; values: Record<string, number>; highlight: string[] }[] = [
    {
      id: "start",
      caption: `The list is ${arr.join(", ")}. Bubble sort walks along it comparing each pair of neighbours and swapping them when the left one is bigger.`,
      values: snapshot(),
      highlight: [],
    },
  ];
  let firstPassDone = -1;
  for (let pass = 0; pass < arr.length - 1; pass++) {
    for (let i = 0; i < arr.length - 1 - pass; i++) {
      const a = arr[i];
      const b = arr[i + 1];
      const swap = a > b;
      if (swap) [arr[i], arr[i + 1]] = [b, a];
      stages.push({
        id: `pass${pass + 1}-compare${i + 1}`,
        caption: swap ? `Compare ${a} and ${b}: ${a} is bigger, so they swap.` : `Compare ${a} and ${b}: already in order, so they stay.`,
        values: snapshot(),
        highlight: [ids[i], ids[i + 1]],
      });
    }
    if (pass === 0) firstPassDone = stages.length;
    stages.push({
      id: `pass${pass + 1}-done`,
      caption: `Pass ${pass + 1} is done: ${arr[arr.length - 1 - pass]} has bubbled up to position ${arr.length - pass}, and that spot is now final.`,
      values: snapshot(),
      highlight: [ids[arr.length - 1 - pass]],
    });
  }
  stages.push({
    id: "sorted",
    caption: `Sorted: ${arr.join(", ")}. Each pass fixed one more value at the end, so ${values.length - 1} passes were enough.`,
    values: snapshot(),
    highlight: ids,
  });
  return { ids, stages, firstPassDone };
}

const bubble = bubbleSortStages([5, 3, 8, 1, 6]);

export const computerScienceTopics: Topic[] = [
  {
    id: "sorting",
    title: "Sorting an array",
    summary: "Bubble sort puts a list in order by repeatedly comparing neighbours and swapping the ones that are the wrong way round.",
    whyItMatters: "Sorting is the first algorithm most programmers study closely: it shows how a simple rule, repeated, produces order, and why some algorithms are much slower than others.",
    concepts: [
      {
        id: "bubble-sort",
        title: "Bubble sort, pass by pass",
        explanation:
          "Bubble sort makes passes over the list. In each pass it compares every pair of neighbours from left to right and swaps them when the left value is bigger. After the first pass the largest value has bubbled up to the end; after the second, the second largest is in place; and so on. For a list of n values, n - 1 passes are enough.",
        alternateExplanation:
          "Think of the biggest bubble in a glass: compare it with its neighbour above, swap if it is bigger, and it rises until it reaches the top. Then the next biggest rises to just below it.",
        visualization: viz({
          type: "quantity-model",
          params: {
            title: "Bubble sort on 5 values",
            observe: "Watch the highlighted pair at each comparison and see the largest value reach the right end after one pass.",
            quantities: bubble.ids.map((id, i) => ({ id, label: `[${i}]`, value: [5, 3, 8, 1, 6][i] })),
            max: 10,
            stages: bubble.stages,
            checkpoints: [
              {
                beforeStage: bubble.firstPassDone,
                prompt: "The first pass is about to finish. Where will the largest value, 8, end up?",
                options: [
                  { id: "a", text: "At the far right: each comparison carries the biggest value so far one step further." },
                  { id: "b", text: "At the far left, because the pass starts there." },
                  { id: "c", text: "Where it started; a single pass only swaps one pair." },
                ],
                correctId: "a",
                whenRight: "Exactly. Once 8 is compared it wins every comparison after it, so it rides along to the end of the list.",
                whenWrong: "Not quite. Follow 8: it is bigger than everything after it, so each comparison swaps it one step to the right until it reaches the end.",
              },
            ],
          },
        }),
        question: {
          kind: "mcq",
          prompt: "Bubble sort is run on the list 4, 2, 5, 1. What does the list look like after the first full pass?",
          options: [
            { id: "a", text: "2, 4, 1, 5" },
            { id: "b", text: "1, 2, 4, 5" },
            { id: "c", text: "4, 2, 5, 1" },
            { id: "d", text: "2, 1, 4, 5" },
          ],
          correctOptionId: "a",
        },
        whyCorrect: "Compare 4 and 2: swap (2, 4, 5, 1). Compare 4 and 5: stay. Compare 5 and 1: swap (2, 4, 1, 5). One pass moves the largest value, 5, to the end; the rest is not sorted yet.",
        hints: ["Work through the three comparisons one at a time, swapping only when the left value is bigger.", "After one pass only the largest value is guaranteed to be in its final place."],
      },
    ],
  },
];

/* ---------- biology ---------- */

export const biologyTopics: Topic[] = [
  {
    id: "cells",
    title: "Photosynthesis and the cell cycle",
    summary: "Plants build glucose from light, water and carbon dioxide, and every cell copies itself through an ordered cycle of stages.",
    whyItMatters: "Photosynthesis feeds almost every food chain on Earth, and the cell cycle is how you grew from a single cell; errors in it are what cancer is.",
    concepts: [
      {
        id: "photosynthesis",
        title: "Photosynthesis: inputs and outputs",
        explanation:
          "Photosynthesis happens in the chloroplasts of leaf cells. It takes in three things: light energy from the sun, carbon dioxide from the air through tiny pores, and water carried up from the roots. Using the light energy, the chloroplast combines carbon dioxide and water into glucose, and releases oxygen as a by-product: 6 CO2 + 6 H2O + light gives C6H12O6 + 6 O2.",
        alternateExplanation:
          "A leaf is a solar-powered kitchen. Sunlight is the energy, water and carbon dioxide are the ingredients, glucose is the meal the plant stores, and oxygen is the steam that escapes out of the window.",
        visualization: viz({
          type: "node-diagram",
          params: {
            title: "Photosynthesis in a leaf",
            observe: "Watch the three inputs arrive at the leaf and the two outputs leave it.",
            layout: "free",
            nodes: [
              { id: "sun", label: "Sun", kind: "circle", x: 10, y: 12 },
              { id: "air", label: "CO2 from the air", kind: "box", x: 10, y: 50 },
              { id: "roots", label: "Water from roots", kind: "box", x: 10, y: 90 },
              { id: "leaf", label: "Leaf", kind: "circle", x: 50, y: 52 },
              { id: "glucose", label: "Glucose", kind: "box", x: 90, y: 30 },
              { id: "oxygen", label: "Oxygen", kind: "box", x: 90, y: 74 },
            ],
            edges: [
              { from: "sun", to: "leaf", label: "light" },
              { from: "air", to: "leaf", label: "CO2" },
              { from: "roots", to: "leaf", label: "H2O" },
              { from: "leaf", to: "glucose", label: "stored" },
              { from: "leaf", to: "oxygen", label: "released" },
            ],
            stages: [
              { id: "inputs", caption: "A leaf needs three inputs: light from the sun, carbon dioxide from the air and water from the roots.", highlight: ["sun", "air", "roots"] },
              {
                id: "light",
                caption: "Light energy reaches the chloroplasts inside the leaf cells.",
                highlight: ["sun", "leaf"],
                highlightEdges: [["sun", "leaf"]],
                tokens: [{ id: "light", label: "light", edge: ["sun", "leaf"], t: 0.6 }],
              },
              {
                id: "intake",
                caption: "Carbon dioxide enters through tiny pores in the leaf, and water travels up from the roots through the stem.",
                highlight: ["air", "roots", "leaf"],
                highlightEdges: [
                  ["air", "leaf"],
                  ["roots", "leaf"],
                ],
                tokens: [
                  { id: "light", label: "light", at: "leaf" },
                  { id: "co2", label: "CO2", edge: ["air", "leaf"], t: 0.6 },
                  { id: "h2o", label: "H2O", edge: ["roots", "leaf"], t: 0.6 },
                ],
              },
              {
                id: "react",
                caption: "Inside the chloroplast the light energy drives the reaction: carbon dioxide and water are combined into glucose, and oxygen is left over.",
                highlight: ["leaf"],
                tokens: [
                  { id: "light", label: "light", at: "leaf" },
                  { id: "co2", label: "CO2", at: "leaf" },
                  { id: "h2o", label: "H2O", at: "leaf" },
                ],
              },
              {
                id: "outputs",
                caption: "Glucose is stored or used for energy, and oxygen is released into the air through the same pores.",
                highlight: ["glucose", "oxygen"],
                highlightEdges: [
                  ["leaf", "glucose"],
                  ["leaf", "oxygen"],
                ],
                tokens: [
                  { id: "glucose", label: "glucose", edge: ["leaf", "glucose"], t: 0.7 },
                  { id: "o2", label: "O2", edge: ["leaf", "oxygen"], t: 0.7 },
                ],
              },
              { id: "dark", caption: "Take the light away and the reaction stops: no glucose and no oxygen, however much water and carbon dioxide there is.", highlight: ["sun"] },
            ],
            checkpoints: [
              {
                beforeStage: 4,
                prompt: "The inputs have combined inside the chloroplast. What comes out of the leaf?",
                options: [
                  { id: "a", text: "Glucose and oxygen." },
                  { id: "b", text: "Carbon dioxide and water." },
                  { id: "c", text: "Only oxygen; the glucose is taken in from the soil." },
                ],
                correctId: "a",
                whenRight: "Right. Carbon dioxide and water go in; glucose and oxygen come out.",
                whenWrong: "Not quite. Carbon dioxide and water are the inputs. The leaf makes glucose from them and releases oxygen.",
              },
            ],
          },
        }),
        question: {
          kind: "mcq",
          prompt: "Which of these is NOT an input to photosynthesis?",
          options: [
            { id: "a", text: "Light" },
            { id: "b", text: "Carbon dioxide" },
            { id: "c", text: "Oxygen" },
            { id: "d", text: "Water" },
          ],
          correctOptionId: "c",
        },
        whyCorrect: "Oxygen is an output: it is released when water and carbon dioxide are combined into glucose using light energy.",
        hints: ["Three things go in and two come out. Which of the options is one of the things that comes out?", "Think about what animals breathe in that plants give off."],
      },
      {
        id: "cell-cycle",
        title: "The cell cycle",
        explanation:
          "A cell copies itself through an ordered cycle. During interphase it grows and copies its DNA. In mitosis the copied chromosomes condense (prophase), line up across the middle (metaphase), are pulled apart to opposite ends (anaphase), and two new nuclei form (telophase). Finally the cytoplasm divides (cytokinesis), leaving two identical cells.",
        alternateExplanation:
          "It is like photocopying a document and sharing out the pages: first make the copy (interphase), then line the two sets up (metaphase), pull them to opposite sides of the desk (anaphase) and put each set in its own folder (telophase and cytokinesis).",
        visualization: viz({
          type: "process-sequence",
          params: {
            title: "The cell cycle",
            observe: "Watch the order of the stages and notice when the DNA is copied and when the copies are separated.",
            stages: [
              { id: "interphase", title: "Interphase", caption: "Interphase: the cell grows, works, and copies its DNA so there are two complete sets.", facts: [{ label: "DNA", value: "copied" }, { label: "Cell", value: "grows" }] },
              { id: "prophase", title: "Prophase", caption: "Prophase: the copied chromosomes condense and become visible, and the nuclear envelope breaks down.", facts: [{ label: "Chromosomes", value: "condense, visible" }, { label: "Nuclear envelope", value: "breaks down" }] },
              { id: "metaphase", title: "Metaphase", caption: "Metaphase: the chromosomes line up across the middle of the cell, attached to spindle fibres.", facts: [{ label: "Chromosomes", value: "lined up at the centre" }] },
              { id: "anaphase", title: "Anaphase", caption: "Anaphase: the sister chromatids are pulled apart to opposite ends of the cell.", facts: [{ label: "Sister chromatids", value: "pulled to opposite ends" }] },
              { id: "telophase", title: "Telophase", caption: "Telophase: a nuclear envelope forms around each set of chromosomes, so there are two nuclei.", facts: [{ label: "Nuclear envelopes", value: "re-form around each set" }] },
              { id: "cytokinesis", title: "Cytokinesis", caption: "Cytokinesis: the cytoplasm divides, leaving two identical cells that each start interphase again.", facts: [{ label: "Cytoplasm", value: "divides" }, { label: "Result", value: "two identical cells" }] },
            ],
            checkpoints: [
              {
                beforeStage: 3,
                prompt: "The chromosomes are lined up across the middle of the cell. What happens next?",
                options: [
                  { id: "a", text: "The sister chromatids are pulled apart to opposite ends of the cell." },
                  { id: "b", text: "The cell immediately splits into two." },
                  { id: "c", text: "The DNA is copied again to make a spare set." },
                ],
                correctId: "a",
                whenRight: "Right. That is anaphase: the two copies are separated before anything else happens.",
                whenWrong: "Not quite. The DNA was copied back in interphase, and the cell cannot split until each side has a full set, so the copies are pulled apart first.",
              },
            ],
          },
        }),
        question: {
          kind: "mcq",
          prompt: "During which stage of the cell cycle is the DNA copied?",
          options: [
            { id: "a", text: "Interphase" },
            { id: "b", text: "Prophase" },
            { id: "c", text: "Metaphase" },
            { id: "d", text: "Anaphase" },
          ],
          correctOptionId: "a",
        },
        whyCorrect: "The DNA is copied during interphase, before mitosis starts. The stages of mitosis then sort and separate the copies; they do not make new ones.",
        hints: ["The copying has to happen before the chromosomes can be shared out.", "Which stage comes before all the stages of mitosis?"],
      },
    ],
  },
];

/* ---------- the built-in courses ---------- */

const topicsByCourse: Record<string, Topic[]> = {
  [SAMPLE_COURSE_ID]: tcpIpTopics,
  "sample-mathematics": mathematicsTopics,
  "sample-physics": physicsTopics,
  "sample-computer-science": computerScienceTopics,
  "sample-biology": biologyTopics,
};

export function sampleTopics(courseId: string): Topic[] {
  return topicsByCourse[courseId] ?? [];
}

import { oneOf, type DiagramEdge, type DiagramNode, type DiagramStage, type DiagramToken, type NodeDiagramParams, type VisualizationDefinition } from "../types";
import { bool, fail, genericApplyControl, genericCheckpoints, genericControls, genericDescribe, genericSteps, id, isRecord, LIMITS, list, num, optText, readBase, rec, text } from "./common";

export const DIAGRAM_LIMITS = { nodes: 12, edges: 24, tokens: 8 } as const;

function readEdgeRef(v: unknown, nodeIds: Set<string>, what: string): [string, string] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [from, to] = v as unknown[];
  if (typeof from !== "string" || typeof to !== "string" || !nodeIds.has(from) || !nodeIds.has(to)) fail(`${what} must name two existing nodes`);
  return [from as string, to as string];
}

export function normalizeNodeDiagram(raw: Record<string, unknown>): NodeDiagramParams {
  const layout = oneOf(raw.layout, ["row", "ring", "tree", "free"] as const, "row");
  const nodeIds = new Set<string>();
  const nodes: DiagramNode[] = list(raw.nodes, "nodes", DIAGRAM_LIMITS.nodes, 1).map((n, i) => {
    const nr = rec(n, `nodes[${i}]`);
    let nid = id(nr.id, "node id", `n${i + 1}`);
    while (nodeIds.has(nid)) nid = `${nid}-${i + 1}`;
    nodeIds.add(nid);
    return {
      id: nid,
      label: text(nr.label, `nodes[${i}].label`, LIMITS.label, nid),
      kind: oneOf(nr.kind, ["box", "circle"] as const, "box"),
      x: typeof nr.x === "number" ? num(nr.x, "node x", 0, 100) : null,
      y: typeof nr.y === "number" ? num(nr.y, "node y", 0, 100) : null,
    };
  });
  const edges: DiagramEdge[] = list(raw.edges, "edges", DIAGRAM_LIMITS.edges).map((e, i) => {
    const er = rec(e, `edges[${i}]`);
    if (typeof er.from !== "string" || typeof er.to !== "string" || !nodeIds.has(er.from) || !nodeIds.has(er.to)) fail(`edges[${i}] must join two existing nodes`);
    return { from: er.from as string, to: er.to as string, label: optText(er.label, LIMITS.label), directed: bool(er.directed, true) };
  });

  const base = readBase<DiagramStage>(raw, (s, i) => {
    const highlight = list(s.highlight, "highlight", DIAGRAM_LIMITS.nodes).filter((x): x is string => typeof x === "string" && nodeIds.has(x));
    const highlightEdges = list(s.highlightEdges, "highlightEdges", DIAGRAM_LIMITS.edges)
      .map((e) => readEdgeRef(e, nodeIds, `stages[${i}].highlightEdges`))
      .filter((e): e is [string, string] => e !== null);
    const tokenIds = new Set<string>();
    const tokens: DiagramToken[] = list(s.tokens, "tokens", DIAGRAM_LIMITS.tokens).map((t, j) => {
      const tr = rec(t, `stages[${i}].tokens[${j}]`);
      let tid = id(tr.id, "token id", `t${j + 1}`);
      while (tokenIds.has(tid)) tid = `${tid}-${j + 1}`;
      tokenIds.add(tid);
      const at = typeof tr.at === "string" && nodeIds.has(tr.at) ? tr.at : null;
      const edge = isRecord(tr) && Array.isArray(tr.edge) ? readEdgeRef(tr.edge, nodeIds, `stages[${i}].tokens[${j}].edge`) : null;
      if (!at && !edge) fail(`stages[${i}].tokens[${j}] needs "at" (a node id) or "edge" ([from, to])`);
      return { id: tid, label: text(tr.label, "token label", 24, tid), at: edge ? null : at, edge, t: num(tr.t, "token t", 0, 1, 0.5) };
    });
    return { highlight, highlightEdges, tokens };
  });
  return { ...base, layout, nodes, edges };
}

export const nodeDiagram: VisualizationDefinition<NodeDiagramParams> = {
  type: "node-diagram",
  family: "generic",
  title: "Diagram",
  summary: "Labelled nodes joined by connections, with items that move between them and parts that light up as the explanation goes on.",
  useWhen: "relationships between parts, flows of material, energy or information between components, hierarchies and trees, cycles, or systems with inputs and outputs",
  schemaDoc: `"layout": "row" | "ring" | "tree" | "free" (free uses each node's "x","y" in 0-100), "nodes": 2 to ${DIAGRAM_LIMITS.nodes} [{"id", "label", "kind"?: "box" | "circle", "x"?, "y"?}], "edges": [{"from", "to", "label"?, "directed"?: true}], and per stage: "highlight"?: [node ids], "highlightEdges"?: [[from, to], ...], "tokens"?: up to ${DIAGRAM_LIMITS.tokens} moving items [{"id", "label", "at": node id} or {"id", "label", "edge": [from, to], "t": 0-1 along the edge}]. Keep the same token ids across stages so they are seen to move.`,
  defaults: {
    title: null,
    observe: null,
    parameters: [],
    stages: [{ id: "stage-1", caption: "The parts and how they connect.", highlight: [], highlightEdges: [], tokens: [] }],
    checkpoints: [],
    layout: "row",
    nodes: [
      { id: "a", label: "A", kind: "box", x: null, y: null },
      { id: "b", label: "B", kind: "box", x: null, y: null },
    ],
    edges: [{ from: "a", to: "b", label: null, directed: true }],
  },
  normalize: normalizeNodeDiagram,
  controls: genericControls,
  applyControl: genericApplyControl,
  steps: genericSteps,
  checkpoints: genericCheckpoints,
  describe: (p) => genericDescribe(p, "Diagram", `A diagram of ${p.nodes.map((n) => n.label).join(", ")} and how they connect.`),
};

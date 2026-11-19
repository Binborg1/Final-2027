import { formatNumber } from "@/lib/visualizations/expr";
import { validateVisualization } from "@/lib/visualizations/registry";
import type { VisualizationConfig } from "@/lib/visualizations/types";
import type { MotionSetup } from "@/lib/resources/types";

const plain = (s: string) => s.replace(/[{}]/g, "").trim();

/**
 * A distance–time graph for objects at constant speeds, built as the existing
 * `function-graph` visualization and validated by the registry. Null when the
 * setup cannot make a valid graph.
 */
export function motionGraph(m: MotionSetup | null): VisualizationConfig | null {
  if (!m || m.objects.length === 0 || !(m.duration > 0) || m.objects.some((o) => !(o.speed > 0) || !o.label.trim())) return null;
  const T = m.duration;
  const curves = m.objects.map((o, i) => ({ id: `o${i + 1}`, label: `${plain(o.label)} (${formatNumber(o.speed)} m/s)`.slice(0, 60), expression: `${o.speed}*x` }));
  const stages = [
    ...m.objects.map((o, i) => ({
      id: `obj${i + 1}`,
      caption: `${plain(o.label)} moves at ${formatNumber(o.speed)} m/s, so every second adds ${formatNumber(o.speed)} m. After ${formatNumber(T)} s that is ${formatNumber(o.speed * T)} m.`,
      show: curves.slice(0, i + 1).map((c) => c.id),
      marker: { curve: `o${i + 1}`, x: T },
      guides: true,
    })),
    { id: "compare", caption: "Each line is straight because each speed is constant. Compare their slopes: which line climbs more metres each second?", show: curves.map((c) => c.id), marker: null, guides: false },
  ];
  return validateVisualization({
    type: "function-graph",
    params: {
      title: "Distance against time",
      observe: "Each straight line is one object at a constant speed. The steeper the line, the faster the object.",
      xLabel: "time (s)",
      yLabel: "distance (m)",
      xRange: [0, T],
      yRange: null,
      parameters: [],
      curves,
      stages,
      checkpoints: [],
    },
  });
}

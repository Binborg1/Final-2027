"use client";

import { LearningVisualization } from "@/components/visualizations/LearningVisualization";
import type { VisualizationConfig } from "@/lib/visualizations/types";
import type { Player } from "@/lib/visualizations/usePlayer";

/**
 * Where an interactive activity renders, in the lesson builder's preview and in
 * the student lesson. Today every activity is a registered visualization drawn
 * by `LearningVisualization` (2D SVG). This is the single place a future
 * renderer (for example a lazily loaded 3D simulation, see
 * docs/architecture-evolution/04_simulation_engine.md) would be chosen, by the
 * config's type, without changing the screens that show activities.
 *
 * No 3D renderer exists yet, so nothing here offers 3D controls.
 */
export function ActivityStage({ config, player, className = "" }: { config?: VisualizationConfig | null; player?: Player; className?: string }) {
  return <LearningVisualization config={config ?? null} player={player} className={className} />;
}

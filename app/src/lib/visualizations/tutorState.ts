import type { PlayerStatus } from "./player";
import type { VisualizationCheckpoint } from "./types";
import type { Player } from "./usePlayer";

/** What the tutor script needs to know about a concept's visualization. */
export type VisualizationTutorState = {
  title: string;
  summary: string;
  status: PlayerStatus;
  /** The demo has been run or stepped at least once for this concept. */
  started: boolean;
  /** Caption of the step on screen. */
  caption: string;
  /** Caption of the final step, said when the demo finishes. */
  lastCaption: string;
  /** The prediction question the demo is stopped at, if any. */
  checkpoint: VisualizationCheckpoint | null;
  checkpointIndex: number | null;
  answerRight: boolean | null;
};

export function tutorStateOf(player: Player): VisualizationTutorState | null {
  if (!player.type || !player.definition) return null;
  const { title, summary } = player.definition.describe(player.params);
  return {
    title,
    summary,
    status: player.status,
    started: player.state.started,
    caption: player.current?.caption ?? "",
    lastCaption: player.steps[player.steps.length - 1]?.caption ?? "",
    checkpoint: player.checkpoint,
    checkpointIndex: player.checkpointIndex,
    answerRight: player.answerRight,
  };
}

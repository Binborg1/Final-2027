"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { Button } from "@/components/Button";
import type {
  FunctionGraphParams,
  GeometrySceneParams,
  NodeDiagramParams,
  PacketTransmissionParams,
  ParamControl,
  PcmSamplingParams,
  ProcessSequenceParams,
  ProtocolLayersParams,
  QuantityModelParams,
  VisualizationConfig,
} from "@/lib/visualizations/types";
import { usePlayer, type Player } from "@/lib/visualizations/usePlayer";
import { FunctionGraphScene } from "./scenes/FunctionGraphScene";
import { GeometryScene } from "./scenes/GeometryScene";
import { NodeDiagramScene } from "./scenes/NodeDiagramScene";
import { PacketTransmissionScene } from "./scenes/PacketTransmissionScene";
import { PcmSamplingScene } from "./scenes/PcmSamplingScene";
import { ProcessSequenceScene } from "./scenes/ProcessSequenceScene";
import { ProtocolLayersScene } from "./scenes/ProtocolLayersScene";
import { QuantityModelScene } from "./scenes/QuantityModelScene";

type Props = {
  /** What to show. Ignored when a `player` is given. */
  config?: VisualizationConfig | null;
  /** A player owned by the lesson, so the tutor can drive it and react to it. */
  player?: Player;
  className?: string;
};

const small = "px-3.5 py-1.5 text-xs";

/**
 * Renders any registered visualization from a validated config: the animated
 * scene, a caption for the current step, play / pause / step / reset, the
 * prediction question at a checkpoint, and the parameters the student can change.
 * Nothing here is generated at run time; the scenes are hand-written components
 * that read structured data.
 */
export function LearningVisualization({ config = null, player: given, className = "" }: Props) {
  const own = usePlayer(given ? null : config);
  const player = given ?? own;
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const { definition, steps, state, status, current, checkpoint } = player;
  if (!player.type || !definition) return null;

  const total = steps.length;
  const controls = definition.controls(player.params);
  const { title, summary } = definition.describe(player.params);
  const atGate = status === "checkpoint";
  const answered = status === "answered";
  const playLabel = state.playing ? "Pause" : answered ? "Continue" : status === "done" ? "Replay" : state.started && state.step > 0 ? "Resume" : "Play";
  const canReset = !(state.step === 0 && !state.playing && state.gate === null);

  return (
    <figure aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`} className={`rounded-2xl border border-line bg-sand p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-extrabold">
          {title}
        </h3>
        <span className="text-[11px] font-bold text-smoke" aria-live="off">
          Step {Math.min(state.step + 1, total)} of {total}
        </span>
      </div>
      <p id={`${id}-summary`} className="sr-only">
        {summary}
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white p-2">
        <Scene player={player} reduce={reduce} />
      </div>

      <div className="mt-3 flex items-start gap-2.5">
        <ol className="mt-1.5 flex max-w-24 shrink-0 flex-wrap gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i < state.step ? "bg-coral/40" : i === state.step ? "bg-coral" : "bg-line"}`}
            />
          ))}
        </ol>
        <figcaption aria-live="polite" className="min-h-10 min-w-0 flex-1 text-sm leading-5 font-semibold text-charcoal">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={current?.id ?? "none"}
              className="block"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
            >
              {current?.caption}
            </motion.span>
          </AnimatePresence>
        </figcaption>
      </div>

      <AnimatePresence initial={false}>
        {checkpoint && (
          <motion.div
            key={`checkpoint-${player.checkpointIndex}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: "easeOut" }}
            role="group"
            aria-labelledby={`${id}-predict`}
            className="mt-3 rounded-2xl border border-sky bg-sky/60 px-4 py-3.5 text-sm leading-6"
          >
            <p id={`${id}-predict`} className="font-extrabold text-sky-dark">
              Predict what happens next
            </p>
            <p className="mt-1 text-charcoal">{checkpoint.prompt}</p>
            <div role="radiogroup" aria-label={checkpoint.prompt} className="mt-3 grid gap-2">
              {checkpoint.options.map((o) => {
                const selected = player.chosen === o.id;
                const right = answered && o.id === checkpoint.correctId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={answered}
                    onClick={() => player.answer(o.id)}
                    className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:ring-4 focus-visible:ring-coral/30 focus-visible:outline-none disabled:cursor-default ${
                      right ? "border-mint-dark bg-mint" : selected ? "border-coral bg-peach/70" : "border-line bg-white enabled:hover:border-coral/60 enabled:hover:bg-sand"
                    }`}
                  >
                    <span className="font-extrabold text-smoke">({o.id})</span>
                    <span>{o.text}</span>
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className={`mt-3 rounded-xl px-3 py-2.5 ${player.answerRight ? "bg-mint text-mint-dark" : "bg-peach/70 text-peach-dark"}`} aria-live="polite">
                <p className="font-bold">{player.answerRight ? checkpoint.whenRight : checkpoint.whenWrong}</p>
                <div className="mt-2">
                  <Button className={small} onClick={player.play}>
                    Continue the demo
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={`${title} controls`}>
        <Button
          className={small}
          onClick={state.playing ? player.pause : player.play}
          disabled={atGate}
          aria-pressed={state.playing}
          title={atGate ? "Make your prediction first" : undefined}
        >
          {playLabel}
        </Button>
        <Button variant="secondary" className={small} onClick={player.forward} disabled={atGate || status === "done"} aria-label="Step forward">
          Step
        </Button>
        <Button variant="ghost" className={small} onClick={player.reset} disabled={!canReset}>
          Reset
        </Button>
      </div>

      {controls.length > 0 && (
        <fieldset className="mt-3 grid gap-2.5 border-t border-line pt-3 sm:grid-cols-2">
          <legend className="sr-only">Try it with different settings</legend>
          {controls.map((control) => (
            <ParamField key={control.key} control={control} player={player} id={`${id}-${control.key}`} />
          ))}
        </fieldset>
      )}

      <details className="mt-3 text-xs text-smoke">
        <summary className="cursor-pointer font-bold">Read every step as text</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 leading-5">
          {steps.map((s) => (
            <li key={s.id}>{s.caption}</li>
          ))}
        </ol>
      </details>
    </figure>
  );
}

/** Picks the hand-written scene for the type of the config. Every scene is a pure function of (params, step). */
function Scene({ player, reduce }: { player: Player; reduce: boolean }) {
  const step = player.state.step;
  switch (player.type) {
    case "function-graph":
      return <FunctionGraphScene params={player.params as FunctionGraphParams} step={step} reduce={reduce} />;
    case "node-diagram":
      return <NodeDiagramScene params={player.params as NodeDiagramParams} step={step} reduce={reduce} />;
    case "process-sequence":
      return <ProcessSequenceScene params={player.params as ProcessSequenceParams} step={step} reduce={reduce} />;
    case "quantity-model":
      return <QuantityModelScene params={player.params as QuantityModelParams} step={step} reduce={reduce} />;
    case "geometry-scene":
      return <GeometryScene params={player.params as GeometrySceneParams} step={step} reduce={reduce} />;
    case "packet-transmission":
      return <PacketTransmissionScene params={player.params as PacketTransmissionParams} step={step} reduce={reduce} />;
    case "pcm-sampling":
      return <PcmSamplingScene params={player.params as PcmSamplingParams} step={step} reduce={reduce} />;
    case "protocol-layers":
      return <ProtocolLayersScene params={player.params as ProtocolLayersParams} step={step} reduce={reduce} />;
    default:
      return null;
  }
}

/** The current value of a control: a top-level param (networking types) or an entry in `parameters` (generic types). */
function controlValue(player: Player, key: string): unknown {
  if (key in player.params) return player.params[key];
  const parameters = player.params.parameters;
  if (Array.isArray(parameters)) return (parameters as { key: string; value: unknown }[]).find((p) => p.key === key)?.value;
  return undefined;
}

function ParamField({ control, player, id }: { control: ParamControl; player: Player; id: string }) {
  const value = controlValue(player, control.key);
  if (control.kind === "range") {
    const n = typeof value === "number" ? value : control.min;
    return (
      <label htmlFor={id} className="block text-xs font-bold text-smoke">
        <span className="flex justify-between">
          <span>{control.label}</span>
          <output htmlFor={id} className="font-extrabold text-charcoal">
            {n}
            {control.unit ? ` ${control.unit}` : ""}
          </output>
        </span>
        <input
          id={id}
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={n}
          onChange={(e) => player.setParam(control.key, Number(e.target.value))}
          className="mt-1 w-full accent-coral"
        />
      </label>
    );
  }
  const options = control.options;
  const current = value === null || value === undefined ? "none" : String(value);
  return (
    <label htmlFor={id} className="block text-xs font-bold text-smoke">
      {control.label}
      <select
        id={id}
        value={options.some((o) => o.value === current) ? current : (options[0]?.value ?? "")}
        onChange={(e) => player.setParam(control.key, e.target.value)}
        className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-semibold text-charcoal shadow-track outline-none focus:border-coral focus:ring-4 focus:ring-coral/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

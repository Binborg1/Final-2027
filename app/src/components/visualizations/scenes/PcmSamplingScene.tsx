"use client";

import { motion } from "framer-motion";
import { pcmSamples, pcmSteps, signalAt } from "@/lib/visualizations/pcmSampling";
import type { PcmSamplingParams } from "@/lib/visualizations/types";
import { fade, move, palette, svgProps, type SceneProps } from "./shared";

/* Plot area: time 0..1 s across, amplitude -1..1 up. */
const X0 = 44;
const X1 = 500;
const Y_MID = 96;
const AMP = 60;
const Y_CODES = 184;

const xOf = (t: number) => X0 + t * (X1 - X0);
const yOf = (v: number) => Y_MID - v * AMP;

function signalPath(signalHz: number): string {
  const n = 240;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return `${i === 0 ? "M" : "L"}${xOf(t).toFixed(1)} ${yOf(signalAt(signalHz, t)).toFixed(1)}`;
  }).join(" ");
}

export function PcmSamplingScene({ params, step, reduce }: SceneProps<PcmSamplingParams>) {
  const steps = pcmSteps(params);
  const stepId = steps[Math.min(step, steps.length - 1)]?.id ?? "analog";
  const stage = ["analog", "sample", "quantize", "encode", "rebuild"].indexOf(stepId);
  const samples = pcmSamples(params);
  const levels = 2 ** params.bits;
  const showLevels = stage >= 2;
  const showCodes = stage >= 3 && (X1 - X0) / params.sampleRate >= params.bits * 6 + 8;
  const rebuilt = samples.map((s) => `${xOf(s.t).toFixed(1)},${yOf(s.quantized).toFixed(1)}`).join(" ");

  return (
    <svg {...svgProps} viewBox="0 0 520 200" fontSize={9}>
      {/* axes */}
      <line x1={X0} y1={yOf(1) - 6} x2={X0} y2={yOf(-1) + 6} stroke={palette.line} strokeWidth="1.5" />
      <line x1={X0} y1={Y_MID} x2={X1} y2={Y_MID} stroke={palette.lineSoft} strokeWidth="1.5" />
      <text x={X0 - 6} y={yOf(1) + 3} textAnchor="end" fill={palette.muted}>
        +1
      </text>
      <text x={X0 - 6} y={yOf(-1) + 3} textAnchor="end" fill={palette.muted}>
        -1
      </text>
      <text x={X0} y={yOf(-1) + 20} textAnchor="middle" fill={palette.muted}>
        0 s
      </text>
      <text x={X1} y={yOf(-1) + 20} textAnchor="middle" fill={palette.muted}>
        1 s
      </text>

      {/* quantization levels */}
      <motion.g initial={false} animate={{ opacity: showLevels ? 1 : 0 }} transition={fade(reduce)}>
        {Array.from({ length: levels }, (_, j) => {
          const v = -1 + (j + 0.5) * (2 / levels);
          return (
            <g key={j}>
              <line x1={X0} y1={yOf(v)} x2={X1} y2={yOf(v)} stroke={palette.lavenderDark} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
              {params.bits <= 3 && (
                <text x={X1 + 4} y={yOf(v) + 3} fill={palette.lavenderDark} fontSize={8}>
                  {j.toString(2).padStart(params.bits, "0")}
                </text>
              )}
            </g>
          );
        })}
      </motion.g>

      {/* the analog signal */}
      <motion.path
        d={signalPath(params.signalHz)}
        fill="none"
        stroke={palette.ink}
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ opacity: stage >= 4 ? 0.28 : 1 }}
        transition={fade(reduce)}
      />

      {/* samples: stem and dot; the dot moves to its level when quantized */}
      {samples.map((s, k) => {
        const yValue = yOf(s.value);
        const yStored = stage >= 2 ? yOf(s.quantized) : yValue;
        const visible = stage >= 1 ? 1 : 0;
        return (
          <g key={k}>
            <motion.line
              x1={xOf(s.t)}
              x2={xOf(s.t)}
              y1={Y_MID}
              initial={false}
              animate={{ y2: yStored, opacity: visible * 0.6 }}
              transition={move(reduce)}
              stroke={palette.coral}
              strokeWidth="1.5"
            />
            <motion.circle
              cx={xOf(s.t)}
              r="3.2"
              initial={false}
              animate={{ cy: yValue, opacity: stage >= 2 ? visible * 0.35 : 0 }}
              transition={fade(reduce)}
              fill="none"
              stroke={palette.coralDark}
              strokeWidth="1.2"
            />
            <motion.circle
              cx={xOf(s.t)}
              r="3.6"
              initial={false}
              animate={{ cy: yStored, opacity: visible }}
              transition={move(reduce)}
              fill={palette.coral}
              stroke={palette.white}
              strokeWidth="1.2"
            />
            {showCodes && (
              <motion.text
                x={xOf(s.t)}
                y={Y_CODES}
                textAnchor="middle"
                fill={palette.lavenderDark}
                fontSize={8}
                initial={false}
                animate={{ opacity: 1 }}
                transition={fade(reduce)}
              >
                {s.code}
              </motion.text>
            )}
          </g>
        );
      })}
      {stage >= 3 && !showCodes && (
        <text x={(X0 + X1) / 2} y={Y_CODES} textAnchor="middle" fill={palette.lavenderDark} fontSize={8}>
          {`${samples.length} codes of ${params.bits} bit${params.bits === 1 ? "" : "s"}: ${samples
            .slice(0, 6)
            .map((s) => s.code)
            .join(" ")} ...`}
        </text>
      )}

      {/* the rebuilt signal */}
      <motion.polyline
        points={rebuilt}
        fill="none"
        stroke={palette.coralDark}
        strokeWidth="2.2"
        strokeLinejoin="round"
        initial={false}
        animate={{ opacity: stage >= 4 ? 1 : 0 }}
        transition={fade(reduce)}
      />
    </svg>
  );
}

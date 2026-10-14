import { clampInt, type PcmSamplingParams, type VisualizationCheckpoint, type VisualizationDefinition, type VisualizationStep } from "./types";

export const PCM_LIMITS = { signalHz: [1, 4], sampleRate: [2, 24], bits: [1, 4] } as const;

export function normalizePcmSampling(raw: Record<string, unknown>): PcmSamplingParams {
  return {
    signalHz: clampInt(raw.signalHz, PCM_LIMITS.signalHz[0], PCM_LIMITS.signalHz[1], 2),
    sampleRate: clampInt(raw.sampleRate, PCM_LIMITS.sampleRate[0], PCM_LIMITS.sampleRate[1], 12),
    bits: clampInt(raw.bits, PCM_LIMITS.bits[0], PCM_LIMITS.bits[1], 3),
  };
}

/** The analog signal: a sine wave with amplitude 1, over a one-second window. */
export function signalAt(signalHz: number, t: number): number {
  return Math.sin(2 * Math.PI * signalHz * t);
}

export type PcmSample = {
  /** Time in seconds. */
  t: number;
  value: number;
  /** Index of the quantization level, 0 .. 2^bits - 1. */
  level: number;
  /** The level's value, which is what gets stored. */
  quantized: number;
  code: string;
};

/** Samples at t = k / sampleRate for k = 0 .. sampleRate, quantized to 2^bits mid-rise levels in [-1, 1]. */
export function pcmSamples({ signalHz, sampleRate, bits }: PcmSamplingParams): PcmSample[] {
  const levels = 2 ** bits;
  const width = 2 / levels;
  return Array.from({ length: sampleRate + 1 }, (_, k) => {
    const t = k / sampleRate;
    const value = signalAt(signalHz, t);
    const level = Math.min(levels - 1, Math.max(0, Math.floor((value + 1) / width)));
    return { t, value, level, quantized: -1 + (level + 0.5) * width, code: level.toString(2).padStart(bits, "0") };
  });
}

/** Nyquist: the shape survives only when the sample rate is above twice the signal frequency. */
export function keepsShape({ signalHz, sampleRate }: PcmSamplingParams): boolean {
  return sampleRate > 2 * signalHz;
}

export function pcmSteps(params: PcmSamplingParams): VisualizationStep[] {
  const { signalHz, sampleRate, bits } = params;
  const levels = 2 ** bits;
  const codes = pcmSamples(params)
    .slice(0, 4)
    .map((s) => s.code)
    .join(" ");
  const keeps = keepsShape(params);
  return [
    {
      id: "analog",
      caption: `An analog signal changes smoothly. This is a ${signalHz} Hz wave over one second. A computer cannot store a smooth curve, only numbers.`,
    },
    {
      id: "sample",
      caption: `Sampling: measure the signal ${sampleRate} times per second. Each dot is one sample, about ${Math.round(1000 / sampleRate)} ms after the last.`,
    },
    {
      id: "quantize",
      caption: `Quantizing: with ${bits} bit${bits === 1 ? "" : "s"} per sample there are ${levels} levels, so each sample is rounded to the nearest level.`,
    },
    {
      id: "encode",
      caption: `Encoding: each level has a ${bits}-bit code, so the signal becomes a stream of bits: ${codes} ... That is ${sampleRate * bits} bits per second here.`,
      hold: 3400,
    },
    {
      id: "rebuild",
      caption: keeps
        ? `Rebuilding: the receiver joins the samples back up. ${sampleRate} samples per second is more than twice ${signalHz} Hz, so the shape survives, with small steps from quantizing.`
        : `Rebuilding: the receiver joins the samples back up. ${sampleRate} samples per second is not more than twice ${signalHz} Hz, so whole swings were missed and the shape is lost. That is aliasing.`,
      hold: 3600,
    },
  ];
}

export function pcmCheckpoints(params: PcmSamplingParams): VisualizationCheckpoint[] {
  const { signalHz, sampleRate } = params;
  const keeps = keepsShape(params);
  const nyquist = 2 * signalHz;
  return [
    {
      beforeStep: pcmSteps(params).findIndex((s) => s.id === "rebuild"),
      prompt: `We are taking ${sampleRate} samples per second of a ${signalHz} Hz wave. When the receiver rebuilds the signal from those samples, will it keep the original shape?`,
      options: [
        { id: "a", text: "Yes. The samples are frequent enough to catch every rise and fall." },
        { id: "b", text: "No. The samples are too far apart, so they miss swings and the rebuilt wave looks different." },
        { id: "c", text: "Sampling never changes the shape, whatever the rate." },
      ],
      correctId: keeps ? "a" : "b",
      whenRight: keeps
        ? `Right. The rule is to sample faster than twice the highest frequency: 2 times ${signalHz} is ${nyquist}, and ${sampleRate} is above that.`
        : `Right. Sampling must be faster than twice the signal frequency: 2 times ${signalHz} is ${nyquist}, and ${sampleRate} is not above that, so swings are missed.`,
      whenWrong: `Not quite. The Nyquist rule says to sample faster than twice the highest frequency. Here 2 times ${signalHz} is ${nyquist} and we take ${sampleRate} samples per second, so the shape ${keeps ? "survives" : "is lost"}.`,
    },
  ];
}

export const pcmSampling: VisualizationDefinition<PcmSamplingParams> = {
  type: "pcm-sampling",
  family: "specialized",
  title: "PCM sampling",
  summary:
    "An analog wave is sampled at regular instants, each sample is rounded to one of a fixed set of levels, each level becomes a binary code, and the receiver rebuilds the wave from the samples.",
  useWhen: "analog-to-digital conversion, pulse code modulation, sampling rate, quantization, bits per sample, or the Nyquist rate and aliasing",
  schemaDoc: `"signalHz": integer ${PCM_LIMITS.signalHz[0]} to ${PCM_LIMITS.signalHz[1]}; "sampleRate": integer ${PCM_LIMITS.sampleRate[0]} to ${PCM_LIMITS.sampleRate[1]} samples per second; "bits": integer ${PCM_LIMITS.bits[0]} to ${PCM_LIMITS.bits[1]} bits per sample`,
  defaults: { signalHz: 2, sampleRate: 12, bits: 3 },
  controls: () => [
    { kind: "range", key: "signalHz", label: "Signal frequency", min: PCM_LIMITS.signalHz[0], max: PCM_LIMITS.signalHz[1], step: 1, unit: "Hz" },
    { kind: "range", key: "sampleRate", label: "Sample rate", min: PCM_LIMITS.sampleRate[0], max: PCM_LIMITS.sampleRate[1], step: 1, unit: "samples/s" },
    { kind: "range", key: "bits", label: "Bits per sample", min: PCM_LIMITS.bits[0], max: PCM_LIMITS.bits[1], step: 1 },
  ],
  applyControl: (p, key, value) => normalizePcmSampling({ ...p, [key]: value }),
  normalize: normalizePcmSampling,
  steps: pcmSteps,
  checkpoints: pcmCheckpoints,
  describe: () => ({ title: pcmSampling.title, summary: pcmSampling.summary }),
};

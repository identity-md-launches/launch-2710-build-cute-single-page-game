/** Tiny WebAudio synth for squeaks. No audio files are loaded. */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (on) unlockAudio();
}

/** Must run inside a user gesture so browsers allow playback. */
export function unlockAudio(): void {
  if (!enabled) return;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(
  points: Array<[time: number, freq: number]>,
  { type = "sine", volume = 0.12 }: { type?: OscillatorType; volume?: number } = {},
): void {
  if (!enabled || !ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  const end = points[points.length - 1][0];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(points[0][1], t0);
  for (const [t, f] of points.slice(1)) osc.frequency.exponentialRampToValueAtTime(f, t0 + t);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + end);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + end + 0.02);
}

export const sfx = {
  squeak(): void {
    const base = 1700 + Math.random() * 600;
    tone([[0, base], [0.05, base * 1.45], [0.13, base * 0.9]], { volume: 0.09 });
  },
  jump(): void {
    tone([[0, 700], [0.09, 1500]], { type: "triangle", volume: 0.1 });
  },
  seed(combo: number): void {
    const f = 880 * Math.pow(1.06, Math.min(combo, 12));
    tone([[0, f], [0.06, f * 1.5]], { type: "square", volume: 0.05 });
  },
  milestone(): void {
    tone([[0, 990], [0.08, 1320], [0.2, 1980]], { type: "triangle", volume: 0.08 });
  },
  crash(): void {
    tone([[0, 420], [0.35, 70]], { type: "square", volume: 0.07 });
    window.setTimeout(() => sfx.squeak(), 120);
  },
  snore(): void {
    tone([[0, 150], [0.5, 210], [0.9, 140]], { type: "sine", volume: 0.035 });
  },
};

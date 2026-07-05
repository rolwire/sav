/**
 * Procedural sound effects — synthesized from scratch into WAV files, so the
 * videos need no licensed audio assets. Three little cues:
 *   whoosh — filtered noise sweep, plays on each map zoom / segment start
 *   pop    — pitch-dropping blip, plays when a photo pops in
 *   ding   — soft two-partial chime, plays when the place label lands
 */
import * as fs from "fs";
import * as path from "path";
import { ensureDir } from "./util";

const SAMPLE_RATE = 44100;

const writeWav = (file: string, samples: Float32Array): void => {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
};

/** Deterministic pseudo-random (so re-runs produce identical files). */
const makeRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
};

const synthWhoosh = (): Float32Array => {
  const dur = 1.15;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rng = makeRng(1234567);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Low-pass cutoff sweeps up then down — the "passing by" feel.
    const cutoff = 250 + 2800 * Math.sin(Math.PI * Math.pow(t, 0.8));
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
    lp += alpha * (rng() * 2 - lp);
    const env = Math.pow(Math.sin(Math.PI * t), 1.6);
    out[i] = lp * env * 1.6;
  }
  return out;
};

const synthPop = (): Float32Array => {
  const dur = 0.22;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = 560 * Math.exp(-t * 14) + 140;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const env = Math.exp(-t * 26);
    out[i] = Math.sin(phase) * env * 0.9;
  }
  return out;
};

const synthDing = (): Float32Array => {
  const dur = 0.9;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 5.5);
    out[i] =
      (Math.sin(2 * Math.PI * 987 * t) * 0.6 +
        Math.sin(2 * Math.PI * 1480 * t) * 0.3 +
        Math.sin(2 * Math.PI * 1975 * t) * 0.12) *
      env *
      0.7;
  }
  return out;
};

export interface SfxPaths {
  whoosh: string;
  pop: string;
  ding: string;
}

/** Write the three SFX WAVs into public/mapreel/sfx/ (idempotent). */
export const ensureSfx = (publicDir: string): SfxPaths => {
  const dir = path.join(publicDir, "sfx");
  ensureDir(dir);
  const files: [keyof SfxPaths, () => Float32Array][] = [
    ["whoosh", synthWhoosh],
    ["pop", synthPop],
    ["ding", synthDing],
  ];
  const out = {} as SfxPaths;
  for (const [name, synth] of files) {
    const file = path.join(dir, `${name}.wav`);
    if (!fs.existsSync(file)) writeWav(file, synth());
    out[name] = `mapreel/sfx/${name}.wav`;
  }
  return out;
};

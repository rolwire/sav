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
  // Deep cinematic whoosh: noise through two cascaded low-passes whose
  // cutoff peaks well below 1 kHz (no hiss), plus a soft sub-bass swell.
  const dur = 1.4;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rng = makeRng(1234567);
  let lp1 = 0;
  let lp2 = 0;
  let subPhase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const cutoff = 80 + 620 * Math.sin(Math.PI * Math.pow(t, 0.85));
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
    lp1 += alpha * (rng() * 2 - lp1);
    lp2 += alpha * (lp1 - lp2); // second pole = steeper rolloff, darker
    const env = Math.pow(Math.sin(Math.PI * t), 1.4);
    const subF = 55 - 22 * t; // sinking sub note under the sweep
    subPhase += (2 * Math.PI * subF) / SAMPLE_RATE;
    out[i] = (lp2 * 3.2 + Math.sin(subPhase) * 0.28 * env) * env;
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

/**
 * Gentle ambient music bed: slow-attack sine-stack pads walking through a
 * i–VI–III–VII progression (A minor), low-passed and quiet. Good enough for
 * demos and as a fallback when no --music track is provided.
 */
const synthAmbientPad = (durSec: number): Float32Array => {
  const n = Math.floor(durSec * SAMPLE_RATE);
  const out = new Float32Array(n);
  // Chord roots in Hz (A2, F2, C3, G2), each chord = root + fifth + octave + third
  const chords = [
    [110.0, 164.81, 220.0, 261.63],
    [87.31, 130.81, 174.61, 220.0],
    [130.81, 196.0, 261.63, 329.63],
    [98.0, 146.83, 196.0, 246.94],
  ];
  const chordDur = 4; // seconds per chord
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const idx = Math.floor(t / chordDur) % chords.length;
    const tin = (t % chordDur) / chordDur;
    // Crossfade between chords so changes breathe instead of clicking.
    const env = Math.sin(Math.PI * Math.min(1, Math.max(0, tin))) * 0.8 + 0.2;
    let v = 0;
    for (const [k, f] of chords[idx].entries()) {
      v +=
        Math.sin(2 * Math.PI * f * t) *
        (0.3 - k * 0.05) *
        (1 + 0.12 * Math.sin(2 * Math.PI * 0.13 * t + k));
    }
    // Master fade in/out at the ends of the bed
    const master =
      Math.min(1, t / 2) * Math.min(1, Math.max(0, (durSec - t) / 2.5));
    out[i] = v * env * master * 0.35;
  }
  return out;
};

/** Write a demo/fallback music bed WAV; returns its staticFile path. */
export const ensureDemoMusic = (publicDir: string, durSec: number): string => {
  const dir = path.join(publicDir, "sfx");
  ensureDir(dir);
  writeWav(path.join(dir, "music.wav"), synthAmbientPad(durSec));
  return "mapreel/sfx/music.wav";
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
    // Always rewrite: synthesis is deterministic and cheap, and this keeps
    // the files in sync when the sound design changes.
    writeWav(path.join(dir, `${name}.wav`), synth());
    out[name] = `mapreel/sfx/${name}.wav`;
  }
  return out;
};

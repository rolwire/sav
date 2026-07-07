import { execFileSync, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface Word {
  text: string;
  startSec: number;
  endSec: number;
}

const WHISPER_DIR = path.join(process.cwd(), ".whisper");
const WHISPER_VERSION = "1.5.5";

/** Convert any audio file to the 16 kHz mono WAV whisper.cpp expects. */
const toWav16k = (input: string, output: string): void => {
  const args = `-y -i "${input}" -ar 16000 -ac 1 -c:a pcm_s16le "${output}"`;
  try {
    execSync(`ffmpeg ${args}`, { stdio: "pipe" });
    return;
  } catch {
    // Fall back to the ffmpeg bundled with Remotion
    execSync(`npx remotion ffmpeg ${args}`, { stdio: "pipe" });
  }
};

/**
 * Transcribe a voiceover with whisper.cpp (word-level timestamps).
 * Downloads + builds whisper.cpp and the model into .whisper/ on first run.
 */
export const transcribeVO = async (
  voPath: string,
  model = "base.en"
): Promise<Word[]> => {
  // Lazy import so the demo pipeline never needs this dependency installed.
  const whisper = await import("@remotion/install-whisper-cpp");

  console.log("  installing whisper.cpp (cached after first run)...");
  await whisper.installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });
  await whisper.downloadWhisperModel({
    model: model as never,
    folder: WHISPER_DIR,
  });

  const wavPath = path.join(WHISPER_DIR, "vo-16k.wav");
  console.log("  converting audio to 16kHz wav...");
  toWav16k(voPath, wavPath);

  console.log("  transcribing...");
  const result = await whisper.transcribe({
    inputPath: wavPath,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: model as never,
    tokenLevelTimestamps: true,
  });

  return whisperOutputToWords(result as unknown as WhisperOutput);
};

interface WhisperToken {
  text: string;
  offsets?: { from: number; to: number };
}
interface WhisperSegment {
  text: string;
  offsets: { from: number; to: number };
  tokens?: WhisperToken[];
}
export interface WhisperOutput {
  transcription: WhisperSegment[];
}

/**
 * Merge whisper.cpp tokens into words. Tokens beginning with a space start a
 * new word; special tokens like [_BEG_] are dropped. Falls back to spreading
 * a segment's words evenly across its time span when tokens are missing.
 */
export const whisperOutputToWords = (out: WhisperOutput): Word[] => {
  const words: Word[] = [];

  for (const seg of out.transcription ?? []) {
    const tokens = (seg.tokens ?? []).filter(
      (t) => t.text && !t.text.startsWith("[_")
    );

    if (tokens.length > 0 && tokens.every((t) => t.offsets)) {
      let current: Word | null = null;
      for (const tok of tokens) {
        const startsWord = tok.text.startsWith(" ") || current === null;
        if (startsWord) {
          if (current && current.text) words.push(current);
          current = {
            text: tok.text.trim(),
            startSec: tok.offsets!.from / 1000,
            endSec: tok.offsets!.to / 1000,
          };
        } else if (current) {
          current.text += tok.text;
          current.endSec = tok.offsets!.to / 1000;
        }
      }
      if (current && current.text) words.push(current);
    } else {
      // Segment-level fallback: distribute words evenly.
      const parts = seg.text.trim().split(/\s+/).filter(Boolean);
      const t0 = seg.offsets.from / 1000;
      const t1 = seg.offsets.to / 1000;
      const step = (t1 - t0) / Math.max(1, parts.length);
      parts.forEach((p, i) =>
        words.push({ text: p, startSec: t0 + i * step, endSec: t0 + (i + 1) * step })
      );
    }
  }

  return words.filter((w) => w.text.length > 0);
};

/**
 * Load a transcript the user supplies directly (skips whisper).
 * Accepts either our own Word[] JSON or raw whisper.cpp JSON output.
 */
export const loadTranscript = (file: string): Word[] => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(data)) return data as Word[];
  if (data.transcription) return whisperOutputToWords(data as WhisperOutput);
  throw new Error(
    `Unrecognized transcript format in ${file} — expected Word[] or whisper.cpp JSON`
  );
};

/** Duration of an audio file in seconds (ffprobe, with graceful fallback). */
export const audioDurationSec = (file: string): number | null => {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file,
      ],
      { encoding: "utf8" }
    );
    const d = parseFloat(out.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
};

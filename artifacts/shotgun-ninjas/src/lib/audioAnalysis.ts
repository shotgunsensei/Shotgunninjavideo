// Browser-side audio analysis using the Web Audio API.
// - Decodes any format the browser supports (MP3, WAV, M4A/AAC, FLAC, OGG)
// - Detects BPM via autocorrelation of the onset envelope
// - Builds an energy/loudness curve (RMS, ~100ms hops)
// - Detects beat timestamps from onset peaks
// - Picks structural boundaries via novelty/change-point detection
// - Heuristically labels intro/verse/pre_chorus/chorus/bridge/breakdown/outro
// - Estimates a key from a 12-bin chroma histogram (Krumhansl-style match)
// - Builds a 33-point emotional valence/arousal map

export type SectionLabel =
  | "intro"
  | "verse"
  | "pre_chorus"
  | "chorus"
  | "bridge"
  | "drop"
  | "breakdown"
  | "outro";

export interface AnalyzedSegment {
  index: number;
  startSec: number;
  endSec: number;
  section: SectionLabel;
  intensity: number;
  emotion: string;
  bpm: number;
}

export interface AnalysisOutput {
  durationSec: number;
  bpm: number;
  keySignature: string;
  energy: number;
  loudnessDb: number;
  beats: number[];
  segments: AnalyzedSegment[];
  emotionalMap: { timeSec: number; valence: number; arousal: number; label: string }[];
}

export type AnalysisStage =
  | "decoding"
  | "downmix"
  | "energy"
  | "bpm"
  | "beats"
  | "sections"
  | "key"
  | "emotion"
  | "done";

export type ProgressFn = (stage: AnalysisStage, pct: number, detail?: string) => void;

const HOP_SEC = 0.1; // 100ms energy frames

function pickEmotion(section: SectionLabel, intensity: number): string {
  const high = intensity > 0.7;
  const mid = intensity > 0.4;
  switch (section) {
    case "intro":
      return high ? "ominous" : "anticipation";
    case "verse":
      return mid ? "smouldering" : "wistful";
    case "pre_chorus":
      return "rising tension";
    case "chorus":
      return high ? "ecstatic release" : "triumphant";
    case "bridge":
      return "yearning";
    case "drop":
      return "explosive";
    case "breakdown":
      return "fractured calm";
    case "outro":
      return "fading echo";
  }
}

function downmixToMono(buf: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buf;
  const out = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] += data[i]! / numberOfChannels;
  }
  return out;
}

function buildEnergyCurve(mono: Float32Array, sampleRate: number): Float32Array {
  const winSize = Math.max(1, Math.floor(sampleRate * HOP_SEC));
  const frames = Math.floor(mono.length / winSize);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const start = f * winSize;
    let sum = 0;
    for (let j = 0; j < winSize; j++) {
      const v = mono[start + j]!;
      sum += v * v;
    }
    out[f] = Math.sqrt(sum / winSize);
  }
  return out;
}

function smooth(arr: Float32Array, window: number): Float32Array {
  const out = new Float32Array(arr.length);
  const half = Math.max(1, Math.floor(window / 2));
  let runningSum = 0;
  for (let i = 0; i < Math.min(half, arr.length); i++) runningSum += arr[i]!;
  for (let i = 0; i < arr.length; i++) {
    const addIdx = i + half;
    const removeIdx = i - half - 1;
    if (addIdx < arr.length) runningSum += arr[addIdx]!;
    if (removeIdx >= 0) runningSum -= arr[removeIdx]!;
    const lo = Math.max(0, i - half);
    const hi = Math.min(arr.length - 1, i + half);
    out[i] = runningSum / (hi - lo + 1);
  }
  return out;
}

function onsetEnvelope(energy: Float32Array): Float32Array {
  const out = new Float32Array(energy.length);
  out[0] = 0;
  for (let i = 1; i < energy.length; i++) {
    out[i] = Math.max(0, energy[i]! - energy[i - 1]!);
  }
  return out;
}

function detectBpm(onset: Float32Array): number {
  // BPM range 70–180. lag in frames; bpm = 60 / (lag * HOP_SEC)
  const minBpm = 70;
  const maxBpm = 180;
  const minLag = Math.floor(60 / (maxBpm * HOP_SEC));
  const maxLag = Math.floor(60 / (minBpm * HOP_SEC));

  // mean-subtract for cleaner correlation
  let mean = 0;
  for (let i = 0; i < onset.length; i++) mean += onset[i]!;
  mean /= onset.length;
  const sig = new Float32Array(onset.length);
  for (let i = 0; i < onset.length; i++) sig[i] = onset[i]! - mean;

  let bestLag = minLag;
  let bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const N = sig.length - lag;
    for (let i = 0; i < N; i++) corr += sig[i]! * sig[i + lag]!;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  return 60 / (bestLag * HOP_SEC);
}

function detectBeats(onset: Float32Array, bpm: number): number[] {
  // Adaptive threshold + minimum spacing tied to detected tempo
  const beats: number[] = [];
  const beatPeriod = 60 / bpm;
  const minSpacingFrames = Math.max(2, Math.floor((beatPeriod * 0.7) / HOP_SEC));

  let mean = 0;
  for (let i = 0; i < onset.length; i++) mean += onset[i]!;
  mean /= onset.length;
  let variance = 0;
  for (let i = 0; i < onset.length; i++) variance += (onset[i]! - mean) ** 2;
  const std = Math.sqrt(variance / onset.length);
  const threshold = mean + std * 0.6;

  let lastBeat = -minSpacingFrames;
  for (let i = 1; i < onset.length - 1; i++) {
    if (
      onset[i]! > threshold &&
      onset[i]! >= onset[i - 1]! &&
      onset[i]! >= onset[i + 1]! &&
      i - lastBeat >= minSpacingFrames
    ) {
      beats.push(+(i * HOP_SEC).toFixed(3));
      lastBeat = i;
    }
  }
  return beats;
}

interface RawSegment {
  startSec: number;
  endSec: number;
  intensity: number;
}

function detectSegments(smoothed: Float32Array, durationSec: number): RawSegment[] {
  // Aim for ~9 segments, scaled by song length (4–11)
  const target = Math.max(4, Math.min(11, Math.round(durationSec / 22)));
  const lookahead = Math.max(5, Math.floor(1.5 / HOP_SEC));

  const novelty = new Float32Array(smoothed.length);
  for (let i = 0; i < smoothed.length; i++) {
    const left = smoothed[Math.max(0, i - lookahead)]!;
    const right = smoothed[Math.min(smoothed.length - 1, i + lookahead)]!;
    novelty[i] = Math.abs(right - left);
  }

  const minSpacing = Math.floor((durationSec / target) * 0.45 / HOP_SEC);
  const candidates = Array.from(novelty, (val, idx) => ({ idx, val }));
  candidates.sort((a, b) => b.val - a.val);

  const cuts: number[] = [0];
  for (const c of candidates) {
    if (cuts.length >= target) break;
    if (c.idx <= 1 || c.idx >= smoothed.length - 1) continue;
    const tooClose = cuts.some((b) => Math.abs(b - c.idx) < minSpacing);
    if (!tooClose) cuts.push(c.idx);
  }
  cuts.sort((a, b) => a - b);
  cuts.push(smoothed.length);

  // Compute max energy for normalization
  let maxE = 1e-9;
  for (let i = 0; i < smoothed.length; i++) if (smoothed[i]! > maxE) maxE = smoothed[i]!;

  const segs: RawSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]!;
    const b = cuts[i + 1]!;
    if (b - a < 2) continue;
    let sum = 0;
    for (let j = a; j < b; j++) sum += smoothed[j]!;
    const avg = sum / (b - a);
    segs.push({
      startSec: +(a * HOP_SEC).toFixed(2),
      endSec: +Math.min(durationSec, b * HOP_SEC).toFixed(2),
      intensity: +Math.min(1, avg / maxE).toFixed(3),
    });
  }
  return segs;
}

function labelSegments(rawSegs: RawSegment[]): AnalyzedSegment[] {
  const n = rawSegs.length;
  if (n === 0) return [];
  const sorted = [...rawSegs].map((s) => s.intensity).sort((a, b) => b - a);
  const highCutoff = sorted[Math.floor(n * 0.35)] ?? 0.7;
  const lowCutoff = sorted[Math.floor(n * 0.7)] ?? 0.3;

  // Find bridge candidate: lowest-energy segment in middle third
  const midStart = Math.floor(n / 3);
  const midEnd = Math.floor((2 * n) / 3);
  let bridgeIdx = -1;
  let bridgeMin = Infinity;
  for (let i = midStart; i < midEnd; i++) {
    const v = rawSegs[i]!.intensity;
    if (v < bridgeMin && v < lowCutoff) {
      bridgeMin = v;
      bridgeIdx = i;
    }
  }

  return rawSegs.map((s, i): AnalyzedSegment => {
    let section: SectionLabel;
    if (i === 0) section = "intro";
    else if (i === n - 1) section = "outro";
    else if (i === bridgeIdx) section = "bridge";
    else if (s.intensity >= highCutoff) section = "chorus";
    else if (s.intensity <= lowCutoff) section = "verse";
    else section = "pre_chorus";
    return {
      index: i,
      startSec: s.startSec,
      endSec: s.endSec,
      section,
      intensity: s.intensity,
      emotion: pickEmotion(section, s.intensity),
      bpm: 0,
    };
  });
}

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function detectKey(mono: Float32Array, sampleRate: number): string {
  // Simple chroma extraction via Goertzel-style energy at note frequencies across octaves.
  // Use a single 4-second window from the middle of the track for a stable estimate.
  const winSec = Math.min(4, mono.length / sampleRate);
  const startIdx = Math.floor(mono.length / 2 - (winSec * sampleRate) / 2);
  const win = mono.subarray(Math.max(0, startIdx), Math.min(mono.length, startIdx + Math.floor(winSec * sampleRate)));
  const chroma = new Array(12).fill(0);
  // Notes C2..C6 (midi 36..84 = 4 octaves)
  for (let midi = 36; midi <= 84; midi++) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const omega = (2 * Math.PI * freq) / sampleRate;
    const cosOmega = Math.cos(omega);
    const coeff = 2 * cosOmega;
    let q0 = 0, q1 = 0, q2 = 0;
    const stride = Math.max(1, Math.floor(win.length / 4096));
    for (let i = 0; i < win.length; i += stride) {
      q0 = coeff * q1 - q2 + win[i]!;
      q2 = q1;
      q1 = q0;
    }
    const power = q1 * q1 + q2 * q2 - q1 * q2 * coeff;
    chroma[midi % 12] += Math.sqrt(Math.max(0, power));
  }
  // Normalize
  const sum = chroma.reduce((a, b) => a + b, 0) || 1;
  const norm = chroma.map((v) => v / sum);

  // Correlate with all 24 keys
  let best = { score: -Infinity, name: "C" };
  for (let root = 0; root < 12; root++) {
    for (const profile of [MAJOR_PROFILE, MINOR_PROFILE]) {
      let score = 0;
      for (let i = 0; i < 12; i++) score += norm[(i + root) % 12]! * profile[i]!;
      if (score > best.score) {
        best = {
          score,
          name: `${NOTE_NAMES[root]} ${profile === MAJOR_PROFILE ? "maj" : "min"}`,
        };
      }
    }
  }
  return best.name;
}

function buildEmotionalMap(
  smoothed: Float32Array,
  durationSec: number,
  segments: AnalyzedSegment[],
): { timeSec: number; valence: number; arousal: number; label: string }[] {
  const points = 32;
  let maxE = 1e-9;
  for (let i = 0; i < smoothed.length; i++) if (smoothed[i]! > maxE) maxE = smoothed[i]!;
  const out: { timeSec: number; valence: number; arousal: number; label: string }[] = [];
  for (let i = 0; i <= points; i++) {
    const t = (durationSec * i) / points;
    const idx = Math.min(smoothed.length - 1, Math.floor(t / HOP_SEC));
    const arousal = Math.max(0, Math.min(1, smoothed[idx]! / maxE));
    // Find current segment to derive valence (chorus = positive, verse/breakdown = darker)
    const seg = segments.find((s) => t >= s.startSec && t <= s.endSec) ?? segments[0]!;
    let baseValence = 0.5;
    switch (seg.section) {
      case "chorus":
      case "drop":
        baseValence = 0.78;
        break;
      case "pre_chorus":
        baseValence = 0.62;
        break;
      case "intro":
      case "verse":
        baseValence = 0.4;
        break;
      case "bridge":
      case "breakdown":
        baseValence = 0.3;
        break;
      case "outro":
        baseValence = 0.45;
        break;
    }
    const valence = Math.max(0, Math.min(1, baseValence + (arousal - 0.5) * 0.2));
    const label = arousal > 0.75 ? "peak" : arousal > 0.5 ? "build" : arousal > 0.25 ? "groove" : "rest";
    out.push({
      timeSec: +t.toFixed(2),
      valence: +valence.toFixed(3),
      arousal: +arousal.toFixed(3),
      label,
    });
  }
  return out;
}

export async function analyzeAudioFile(
  blob: Blob,
  onProgress: ProgressFn = () => {},
): Promise<AnalysisOutput> {
  onProgress("decoding", 5, "Reading file");
  const arrayBuffer = await blob.arrayBuffer();
  const Ctor: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new Ctor();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    audioCtx.close();
    throw new Error(
      `Decode failed: this browser couldn't read the file. ${err instanceof Error ? err.message : ""}`.trim(),
    );
  }

  const sampleRate = audioBuffer.sampleRate;
  const durationSec = audioBuffer.duration;

  onProgress("downmix", 15, "Mixing channels to mono");
  const mono = downmixToMono(audioBuffer);

  onProgress("energy", 30, "Building energy envelope");
  const energy = buildEnergyCurve(mono, sampleRate);
  const smoothed = smooth(energy, Math.max(4, Math.floor(2 / HOP_SEC)));

  // Overall RMS
  let rmsSum = 0;
  for (let i = 0; i < mono.length; i++) rmsSum += mono[i]! * mono[i]!;
  const overallRms = Math.sqrt(rmsSum / mono.length);
  const loudnessDb = 20 * Math.log10(Math.max(overallRms, 1e-10));
  const overallEnergy = Math.max(0, Math.min(1, overallRms * 4));

  onProgress("bpm", 45, "Detecting tempo");
  const onset = onsetEnvelope(energy);
  const bpmRaw = detectBpm(onset);
  const bpm = Math.round(bpmRaw);

  onProgress("beats", 60, "Locating beats");
  const beats = detectBeats(onset, bpmRaw);

  onProgress("sections", 75, "Finding section boundaries");
  const rawSegs = detectSegments(smoothed, durationSec);
  const labeled = labelSegments(rawSegs).map((s) => ({ ...s, bpm }));

  onProgress("key", 88, "Estimating musical key");
  const keySignature = detectKey(mono, sampleRate);

  onProgress("emotion", 95, "Mapping emotional arc");
  const emotionalMap = buildEmotionalMap(smoothed, durationSec, labeled);

  audioCtx.close();
  onProgress("done", 100, "Complete");

  return {
    durationSec,
    bpm,
    keySignature,
    energy: overallEnergy,
    loudnessDb,
    beats,
    segments: labeled,
    emotionalMap,
  };
}

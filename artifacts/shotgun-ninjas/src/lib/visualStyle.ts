import type { AnalysisResult, EmotionalPoint } from "@workspace/api-client-react";

export interface VisualStyleRecommendation {
  headline: string;
  palette: string;
  lensing: string;
  pacing: string;
  descriptors: string[];
}

export interface EmotionalArcSummary {
  peak: number;
  build: number;
  groove: number;
  rest: number;
  total: number;
  activationPct: number;
  atmospherePct: number;
  arcShape: "rising" | "falling" | "dome" | "valley" | "steady";
}

export function recommendVisualStyle(analysis: AnalysisResult): VisualStyleRecommendation {
  const isMinor = /min/i.test(analysis.keySignature);
  const fast = analysis.bpm >= 130;
  const slow = analysis.bpm < 95;
  const segs = analysis.segments;
  const chorusEnergies = segs.filter((s) => s.section === "chorus").map((s) => s.intensity);
  const chorusEnergy = chorusEnergies.length ? Math.max(...chorusEnergies) : 0;
  const hasDrop = segs.some((s) => s.section === "drop");
  const hasBreakdown = segs.some((s) => s.section === "breakdown");
  const lowOverallEnergy = analysis.energy < 0.35;

  let headline: string;
  if (isMinor && fast && hasDrop) headline = "Neo-noir kinetic";
  else if (isMinor && fast) headline = "Industrial pulse";
  else if (isMinor && slow) headline = "Slow-burn cinematic";
  else if (!isMinor && fast) headline = "Saturated euphoric";
  else if (!isMinor && slow) headline = "Sun-bleached intimate";
  else headline = "Cinematic indie";

  const palette = isMinor
    ? lowOverallEnergy
      ? "Crimson neon over wet cobalt asphalt"
      : "Magenta and oxblood low-key chromatics"
    : lowOverallEnergy
      ? "Faded amber and bone film stock"
      : "Saturated tangerine and blown highlights";

  const lensing = fast
    ? "Wide anamorphic with shallow depth, hard lens flares on transients"
    : slow
      ? "Long takes on a 50mm dolly with subtle handheld drift"
      : "Mixed glass: 35mm intimate inserts, 24mm chorus reveals";

  const pacing = fast
    ? `Cut on the kick at ${analysis.bpm} BPM, strobe pulses on the snare`
    : slow
      ? `Hold each shot ~${(60 / analysis.bpm * 4).toFixed(1)}s; one cut per bar`
      : `Edit on the downbeat; double-time inserts on the hi-hat`;

  const descriptors: string[] = [];
  if (chorusEnergy > 0.7) descriptors.push("Hold wide chorus reveals; full-frame energy");
  if (hasDrop) descriptors.push("Hard cuts and lens flares on every drop");
  if (hasBreakdown) descriptors.push("Quiet isolation moments during breakdowns");
  if (isMinor) descriptors.push("Rim light only; let blacks crush");
  else descriptors.push("Backlit highlights, lift the shadows");
  descriptors.push(`${analysis.bpm} BPM grid drives all cut points`);

  return { headline, palette, lensing, pacing, descriptors };
}

export function summarizeEmotionalArc(map: EmotionalPoint[]): EmotionalArcSummary {
  const counts = { peak: 0, build: 0, groove: 0, rest: 0 };
  for (const p of map) {
    const k = p.label as keyof typeof counts;
    if (k in counts) counts[k]++;
  }
  const total = Math.max(1, map.length);
  const activation = counts.peak + counts.build;
  const atmosphere = counts.rest + counts.groove;

  // Arc shape: compare arousal in first/middle/last thirds
  const third = Math.floor(map.length / 3);
  const avg = (a: number, b: number) =>
    map.slice(a, b).reduce((s, p) => s + p.arousal, 0) / Math.max(1, b - a);
  const a1 = avg(0, third);
  const a2 = avg(third, 2 * third);
  const a3 = avg(2 * third, map.length);
  let arcShape: EmotionalArcSummary["arcShape"] = "steady";
  if (a3 > a1 + 0.1 && a2 > a1) arcShape = "rising";
  else if (a1 > a3 + 0.1 && a2 > a3) arcShape = "falling";
  else if (a2 > a1 + 0.05 && a2 > a3 + 0.05) arcShape = "dome";
  else if (a2 < a1 - 0.05 && a2 < a3 - 0.05) arcShape = "valley";

  return {
    ...counts,
    total,
    activationPct: Math.round((activation / total) * 100),
    atmospherePct: Math.round((atmosphere / total) * 100),
    arcShape,
  };
}

export function describeArcShape(s: EmotionalArcSummary["arcShape"]): string {
  switch (s) {
    case "rising":
      return "Steady ascent into a final peak";
    case "falling":
      return "Front-loaded; settles into reflection";
    case "dome":
      return "Builds to a central crest, then releases";
    case "valley":
      return "Bookended energy, intimate middle";
    case "steady":
      return "Consistent intensity throughout";
  }
}

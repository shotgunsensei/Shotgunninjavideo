/**
 * Parse raw lyrics text into structured lines with optional timestamps.
 *
 * Recognised formats (the third group's separator disambiguates):
 *   [mm:ss]      e.g. [01:23]
 *   [mm:ss.cs]   e.g. [01:23.45]   (period -> centiseconds, standard LRC)
 *   [hh:mm:ss]   e.g. [01:02:03]   (colon -> seconds)
 *
 * Multiple bracketed timestamps may prefix a single line — each produces a copy of that line.
 * Lines without a timestamp are still returned (timestampSec = null).
 * Blank lines and pure metadata tags ([by:...], [ar:...], [ti:...], [length:...]) are skipped.
 */

export interface ParsedLyricLine {
  index: number;
  text: string;
  timestampSec: number | null;
}

// Capture the separator before the third group so we can disambiguate
// [mm:ss.cs] (period -> centiseconds) from [hh:mm:ss] (colon -> seconds).
const TIMESTAMP_RE = /\[(\d{1,3}):(\d{1,2})(?:([.:])(\d{1,3}))?\]/g;
const META_TAG_RE = /^\[(?:by|ar|ti|al|au|length|offset|re|ve|id|ac|tool):/i;

export function parseLyrics(raw: string): ParsedLyricLine[] {
  const out: ParsedLyricLine[] = [];
  if (!raw) return out;

  const sourceLines = raw.split(/\r?\n/);
  let idx = 0;

  for (const rawLine of sourceLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (META_TAG_RE.test(line)) continue;

    // Collect every leading [mm:ss(.cs)] timestamp on this line
    const stamps: number[] = [];
    TIMESTAMP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    while ((m = TIMESTAMP_RE.exec(line)) !== null) {
      // only treat as timestamp if it's at the start of the remaining string
      if (m.index !== lastEnd) break;
      const a = parseInt(m[1] ?? "0", 10);
      const b = parseInt(m[2] ?? "0", 10);
      const sep = m[3]; // "." or ":" or undefined
      const cRaw = m[4];

      let totalSec: number;
      if (sep === ":" && cRaw !== undefined) {
        // [hh:mm:ss] — three colon-separated integer fields
        totalSec = a * 3600 + b * 60 + parseInt(cRaw, 10);
      } else {
        // [mm:ss] or [mm:ss.cs] — first field is minutes
        let frac = 0;
        if (cRaw !== undefined) {
          if (cRaw.length === 3) frac = parseInt(cRaw, 10) / 1000;
          else if (cRaw.length === 2) frac = parseInt(cRaw, 10) / 100;
          else if (cRaw.length === 1) frac = parseInt(cRaw, 10) / 10;
        }
        totalSec = a * 60 + b + frac;
      }
      stamps.push(totalSec);
      lastEnd = m.index + m[0].length;
    }

    const text = line.slice(lastEnd).trim();
    if (!text && stamps.length === 0) continue;
    if (!text) continue; // bare timestamp with no lyric text — skip

    if (stamps.length === 0) {
      out.push({ index: idx++, text, timestampSec: null });
    } else {
      for (const ts of stamps) {
        out.push({ index: idx++, text, timestampSec: ts });
      }
    }
  }

  // Sort: lines with timestamps first by time, then untimed lines preserved in source order at end
  const timed = out.filter((l) => l.timestampSec !== null);
  const untimed = out.filter((l) => l.timestampSec === null);
  timed.sort((a, b) => (a.timestampSec ?? 0) - (b.timestampSec ?? 0));
  const ordered = [...timed, ...untimed];
  return ordered.map((l, i) => ({ ...l, index: i }));
}

export function hasTimestamps(lines: ParsedLyricLine[]): boolean {
  return lines.some((l) => l.timestampSec !== null);
}

/**
 * Match lyric lines to a scene.
 *
 * Precedence (single source of truth used by backend + frontend):
 *   1. If a line has an explicit `sceneId`, it ALWAYS belongs to that scene
 *      (manual assignment overrides any timestamp).
 *   2. Otherwise, if the line has a `timestampSec`, include it when the
 *      timestamp falls inside [startSec, endSec) of the scene.
 *   3. Lines with neither sceneId nor timestamp are not matched anywhere.
 */
export function lyricsForScene<
  T extends { timestampSec: number | null; sceneId?: string | null },
>(lines: T[], scene: { id: string; startSec: number; endSec: number }): T[] {
  return lines.filter((l) => {
    if (l.sceneId) return l.sceneId === scene.id;
    if (l.timestampSec !== null && l.timestampSec !== undefined) {
      return l.timestampSec >= scene.startSec && l.timestampSec < scene.endSec;
    }
    return false;
  });
}

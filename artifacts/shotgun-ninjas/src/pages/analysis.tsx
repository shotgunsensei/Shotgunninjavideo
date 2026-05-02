import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Zap,
  Loader2,
  RefreshCw,
  FileAudio,
  Cpu,
  Volume2,
  Brain,
  ChevronRight,
  Clapperboard,
  ArrowDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAnalysis,
  useAnalyzeAudio,
  getGetAnalysisQueryKey,
  useGetProject,
  getGetProjectQueryKey,
  type AnalysisResult,
} from "@workspace/api-client-react";
import { analyzeAudioFile, type AnalysisStage } from "@/lib/audioAnalysis";
import { getAudio } from "@/lib/audioStorage";
import { SegmentEditor } from "@/components/SegmentEditor";
import {
  DeepThinkingFlow,
  initialDeepStages,
  type DeepStageId,
  type DeepStageState,
} from "@/components/DeepThinkingFlow";
import {
  recommendVisualStyle,
  summarizeEmotionalArc,
  describeArcShape,
} from "@/lib/visualStyle";

const SECTION_COLORS: Record<string, string> = {
  intro: "#52525b",
  verse: "#4338ca",
  pre_chorus: "#7e22ce",
  chorus: "hsl(var(--primary))",
  bridge: "hsl(var(--accent))",
  drop: "#dc2626",
  breakdown: "#a16207",
  outro: "#3f3f46",
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function intensityLabel(i: number): "Low" | "Medium" | "High" {
  if (i >= 0.7) return "High";
  if (i >= 0.4) return "Medium";
  return "Low";
}

function visualIntensity(i: number): number {
  return Math.max(1, Math.min(5, Math.round(i * 5)));
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

const SONG_SUBSTEPS: AnalysisStage[] = [
  "decoding",
  "downmix",
  "energy",
  "bpm",
  "beats",
  "key",
];
const EMOTION_SUBSTEPS: AnalysisStage[] = ["sections", "emotion"];

const STAGE_DETAIL: Partial<Record<AnalysisStage, string>> = {
  decoding: "Decoding audio container",
  downmix: "Downmixing channels to mono",
  energy: "Building 100 ms RMS energy envelope",
  bpm: "Analyzing rhythm patterns…",
  beats: "Locating beat onsets",
  key: "Estimating musical key",
  sections: "Mapping energy transitions…",
  emotion: "Charting valence × arousal",
};

function buildCompletedStages(analysis: AnalysisResult): DeepStageState[] {
  const segCount = analysis.segments.length;
  const beatCount = (analysis as AnalysisResult & { beats?: number[] }).beats?.length ?? 0;
  const visual = recommendVisualStyle(analysis);
  const arc = summarizeEmotionalArc(analysis.emotionalMap);
  return [
    {
      ...initialDeepStages[0]!,
      status: "done",
      pct: 100,
      log: [
        "Decoded waveform from local cache",
        `Detected tempo: ${Math.round(analysis.bpm)} BPM`,
        beatCount > 0 ? `Located ${beatCount} beat onsets` : "Beat grid reconstructed",
        `Estimated key: ${analysis.keySignature}`,
        `Average loudness: ${analysis.loudnessDb !== undefined ? analysis.loudnessDb.toFixed(1) + " dB" : "—"}`,
      ],
    },
    {
      ...initialDeepStages[1]!,
      status: "done",
      pct: 100,
      log: [
        `Found ${segCount} structural sections`,
        `Charted ${analysis.emotionalMap.length} emotional waypoints`,
        `Arc shape: ${describeArcShape(arc.arcShape).toLowerCase()}`,
        `${arc.activationPct}% activation · ${arc.atmospherePct}% atmosphere`,
      ],
    },
    {
      ...initialDeepStages[2]!,
      status: "done",
      pct: 100,
      log: [
        `Direction: ${visual.headline}`,
        `Palette: ${visual.palette}`,
        `Lensing: ${visual.lensing}`,
        `Pacing: ${visual.pacing}`,
      ],
    },
    {
      ...initialDeepStages[3]!,
      status: "done",
      pct: 100,
      log: [
        `Outlined ${segCount} scene blocks against the emotional arc`,
        "Anchored climaxes on chorus / drop downbeats",
        `Cut points snapped to ${Math.round(analysis.bpm)} BPM grid`,
      ],
    },
    {
      ...initialDeepStages[4]!,
      status: "done",
      pct: 100,
      log: ["Final preview ready"],
    },
  ];
}

export default function Analysis() {
  const [, params] = useRoute("/projects/:id/analysis");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [hasCachedAudio, setHasCachedAudio] = useState<boolean | null>(null);
  const [stages, setStages] = useState<DeepStageState[]>(initialDeepStages);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // 'idle' = no run started yet (safe to seed from existing analysis)
  // 'running' = active run, do NOT seed
  // 'success' = completed run, safe to re-seed if data refreshes
  // 'error' = run failed, preserve error stage state until user re-runs
  const [lastRunStatus, setLastRunStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const runIdRef = useRef(0);
  const unmountedRef = useRef(false);

  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const {
    data: analysis,
    isLoading: analysisLoading,
    isError: analysisFetchError,
  } = useGetAnalysis(projectId, {
    query: {
      enabled: !!projectId && project?.status !== "draft",
      queryKey: getGetAnalysisQueryKey(projectId),
      retry: false,
    },
  });

  const submitAnalysis = useAnalyzeAudio();

  // Check IDB on mount
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    getAudio(projectId)
      .then((a) => {
        if (!cancelled) setHasCachedAudio(!!a);
      })
      .catch(() => {
        if (!cancelled) setHasCachedAudio(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Seed completed stages ONLY on initial idle load or after a successful run.
  // Never overwrite an active run, and never clobber an error state until the
  // user explicitly re-runs.
  useEffect(() => {
    if (!analysis) return;
    if (lastRunStatus === "idle" || lastRunStatus === "success") {
      setStages(buildCompletedStages(analysis));
    }
  }, [analysis, lastRunStatus]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      // Invalidate any in-flight run so its post-await updates short-circuit.
      runIdRef.current += 1;
    };
  }, []);

  // Stage helpers
  const updateStage = (id: DeepStageId, patch: Partial<DeepStageState>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const appendLog = (id: DeepStageId, line: string) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, log: [...s.log, line] } : s)),
    );
  };

  const startStage = (id: DeepStageId, pct: number, line: string) => {
    setStages((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "running", pct, log: [...s.log, line] } : s,
      ),
    );
  };

  async function runDeepThinking(useMock: boolean) {
    if (!projectId) return;

    // Increment run token. Any in-flight prior run becomes stale immediately.
    runIdRef.current += 1;
    const myRun = runIdRef.current;
    const isStale = () => unmountedRef.current || runIdRef.current !== myRun;

    setAnalysisError(null);
    setLastRunStatus("running");
    setIsAnalyzing(true);
    setStages(initialDeepStages);

    try {
      // ── Stage 1: Song analysis ───────────────────────────────────────────
      startStage("song", 2, "Analyzing rhythm patterns…");

      let result: AnalysisResult;

      if (useMock) {
        // Simulate decode/BPM/beats/key with timed substeps
        for (let i = 0; i < SONG_SUBSTEPS.length; i++) {
          await delay(280);
          if (isStale()) return;
          const sub = SONG_SUBSTEPS[i]!;
          appendLog("song", STAGE_DETAIL[sub] ?? sub);
          updateStage("song", { pct: Math.round(((i + 1) / SONG_SUBSTEPS.length) * 100) });
        }
        if (isStale()) return;
        updateStage("song", { status: "done", pct: 100 });

        // Stage 2 simulated
        startStage("emotion", 20, STAGE_DETAIL.sections!);
        await delay(420);
        if (isStale()) return;
        appendLog("emotion", STAGE_DETAIL.emotion!);
        updateStage("emotion", { pct: 80 });
        await delay(420);
        if (isStale()) return;

        // Submit empty body → backend mock generates analysis
        result = await submitMockAnalysis();
        if (isStale()) return;
        updateStage("emotion", { status: "done", pct: 100 });
      } else {
        // Real Web Audio analysis
        const stored = await getAudio(projectId);
        if (isStale()) return;
        if (!stored) {
          throw new Error(
            "No audio file cached locally. Re-upload the track to run real analysis here.",
          );
        }
        appendLog("song", "Decoding audio container…");

        const songLogged = new Set<AnalysisStage>(["decoding"]);
        let emotionStarted = false;

        const real = await analyzeAudioFile(stored.blob, (stage) => {
          if (isStale()) return;
          if (SONG_SUBSTEPS.includes(stage)) {
            const idx = SONG_SUBSTEPS.indexOf(stage);
            const within = Math.round(((idx + 1) / SONG_SUBSTEPS.length) * 100);
            updateStage("song", { pct: within });
            if (!songLogged.has(stage)) {
              songLogged.add(stage);
              const detail = STAGE_DETAIL[stage];
              if (detail) appendLog("song", detail);
            }
          } else if (EMOTION_SUBSTEPS.includes(stage)) {
            if (!emotionStarted) {
              emotionStarted = true;
              updateStage("song", { status: "done", pct: 100 });
              startStage("emotion", 25, STAGE_DETAIL.sections!);
            }
            const idx = EMOTION_SUBSTEPS.indexOf(stage);
            const within = Math.round(((idx + 1) / EMOTION_SUBSTEPS.length) * 100);
            updateStage("emotion", { pct: within });
            if (stage === "emotion") {
              appendLog("emotion", STAGE_DETAIL.emotion!);
            }
          }
        });

        if (isStale()) return;
        updateStage("song", { status: "done", pct: 100 });
        appendLog("emotion", `Found ${real.segments.length} structural sections`);
        updateStage("emotion", { status: "done", pct: 100 });

        // Submit real result to backend
        result = await new Promise<AnalysisResult>((resolve, reject) => {
          submitAnalysis.mutate(
            {
              id: projectId,
              data: {
                durationSec: real.durationSec,
                bpm: real.bpm,
                keySignature: real.keySignature,
                energy: real.energy,
                loudnessDb: real.loudnessDb,
                beats: real.beats,
                segments: real.segments.map((s, i) => ({
                  index: i,
                  startSec: s.startSec,
                  endSec: s.endSec,
                  section: s.section,
                  intensity: s.intensity,
                  emotion: s.emotion,
                  bpm: s.bpm,
                })),
                emotionalMap: real.emotionalMap,
              },
            },
            { onSuccess: (r) => resolve(r), onError: (e) => reject(e) },
          );
        });
        if (isStale()) return;
      }

      // ── Stage 3: Conceiving visual ideas (derived) ──────────────────────
      const visual = recommendVisualStyle(result);
      startStage("visual", 8, `Direction emerging: ${visual.headline}`);
      await delay(380);
      if (isStale()) return;
      appendLog("visual", `Mapping palette: ${visual.palette}`);
      updateStage("visual", { pct: 38 });
      await delay(380);
      if (isStale()) return;
      appendLog("visual", `Lensing: ${visual.lensing}`);
      updateStage("visual", { pct: 68 });
      await delay(360);
      if (isStale()) return;
      appendLog("visual", "Preparing cinematic segment suggestions…");
      updateStage("visual", { pct: 92 });
      await delay(220);
      if (isStale()) return;
      updateStage("visual", { status: "done", pct: 100 });

      // ── Stage 4: Storyline design (derived) ──────────────────────────────
      const segCount = result.segments.length;
      startStage(
        "story",
        12,
        `Outlining ${segCount} scene blocks against the emotional arc`,
      );
      await delay(380);
      if (isStale()) return;
      appendLog("story", `Pacing transitions to detected ${Math.round(result.bpm)} BPM grid`);
      updateStage("story", { pct: 55 });
      await delay(380);
      if (isStale()) return;
      appendLog("story", "Anchoring climaxes on chorus / drop downbeats");
      updateStage("story", { pct: 88 });
      await delay(260);
      if (isStale()) return;
      updateStage("story", { status: "done", pct: 100 });

      // ── Stage 5: Content preview ─────────────────────────────────────────
      startStage("preview", 50, "Composing final preview…");
      await delay(220);
      if (isStale()) return;
      updateStage("preview", { status: "done", pct: 100 });

      // Refresh queries so the rest of the page re-renders with fresh data
      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });

      setLastRunStatus("success");
      toast({
        title: "Deep thinking complete",
        description: `${Math.round(result.bpm)} BPM · ${result.keySignature} · ${result.segments.length} segments`,
      });
    } catch (err) {
      if (isStale()) return;
      const msg = err instanceof Error ? err.message : "Analysis failed.";
      setAnalysisError(msg);
      setStages((prev) => {
        // Mark the currently-running stage as error (or the first non-done one)
        const idx = prev.findIndex((s) => s.status === "running");
        const target = idx >= 0 ? idx : prev.findIndex((s) => s.status !== "done");
        if (target < 0) return prev;
        return prev.map((s, i) => (i === target ? { ...s, status: "error" } : s));
      });
      setLastRunStatus("error");
      toast({ variant: "destructive", title: "Analysis failed", description: msg });
    } finally {
      if (!isStale()) {
        setIsAnalyzing(false);
      }
    }
  }

  function submitMockAnalysis(): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      submitAnalysis.mutate(
        { id: projectId, data: undefined as never },
        { onSuccess: (r) => resolve(r), onError: (e) => reject(e) },
      );
    });
  }

  if (projectLoading || hasCachedAudio === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (project?.status === "draft") {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border/50 bg-card/10 text-center p-6 max-w-2xl mx-auto mt-12">
        <Activity className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2 uppercase tracking-wider">No Source Material</h3>
        <p className="text-sm text-muted-foreground font-mono mb-4">
          Upload an audio file first before running analysis.
        </p>
        <Link href={`/projects/${projectId}/upload`}>
          <Button className="rounded-none uppercase tracking-widest font-bold">
            <FileAudio className="w-4 h-4 mr-2" /> Upload Track
          </Button>
        </Link>
      </div>
    );
  }

  const completed = stages.every((s) => s.status === "done") && !!analysis;
  const showFlow = isAnalyzing || !analysis || !!analysisFetchError;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* HEADER */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/40 bg-primary/5 text-[10px] font-mono uppercase tracking-widest text-primary">
          <Brain className="w-3 h-3" />
          Deep Thinking
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter uppercase">
          Acoustic <span className="text-primary">Soul Extraction</span>
        </h1>
        <p className="text-muted-foreground font-mono text-sm max-w-2xl">
          Five-stage cinematic intelligence pass. Browser-side decode, structural sectioning,
          emotional mapping, visual conception, and storyline pacing — all in one shot.
        </p>
      </div>

      {/* PRIMARY CTA / RE-ANALYZE BAR */}
      <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 shrink-0 border border-primary/40 bg-primary/10 flex items-center justify-center text-primary">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {hasCachedAudio
                  ? completed && !isAnalyzing
                    ? "Audio cached locally · re-run any time"
                    : "Audio cached locally · 100% in your browser"
                  : "Local audio cache empty · using deterministic mock"}
              </div>
              <div className="text-sm font-mono text-foreground truncate">
                {project?.title ?? "Untitled track"}
                {project?.artist ? ` — ${project.artist}` : ""}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:shrink-0">
            {hasCachedAudio && (
              <Button
                size="sm"
                onClick={() => runDeepThinking(false)}
                disabled={isAnalyzing || submitAnalysis.isPending}
                className="rounded-none uppercase tracking-widest font-bold bg-primary hover:bg-primary/90 shadow-[0_0_20px_-5px_rgba(219,39,119,0.5)]"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : completed ? (
                  <RefreshCw className="w-4 h-4 mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {completed ? "Re-run Deep Thinking" : "Initiate Deep Thinking"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => runDeepThinking(true)}
              disabled={isAnalyzing || submitAnalysis.isPending}
              className="rounded-none uppercase tracking-widest border-border/50"
            >
              <FileAudio className="w-4 h-4 mr-2" />
              Mock Pass
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DEEP THINKING FLOW */}
      <DeepThinkingFlow
        stages={stages}
        errorMessage={analysisError}
        previewContent={analysis ? <FinalSummary analysis={analysis} projectId={projectId} /> : null}
      />

      {/* DETAILED PANELS — only when an analysis exists */}
      {analysis && !showFlow && (
        <DetailedPanels analysis={analysis} projectId={projectId} />
      )}
      {analysis && showFlow && completed && (
        <DetailedPanels analysis={analysis} projectId={projectId} />
      )}

      {analysisLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Final Summary card — rendered inside the "Content preview" stage
// ─────────────────────────────────────────────────────────────────────────
function FinalSummary({ analysis, projectId }: { analysis: AnalysisResult; projectId: string }) {
  const visual = useMemo(() => recommendVisualStyle(analysis), [analysis]);
  const arc = useMemo(() => summarizeEmotionalArc(analysis.emotionalMap), [analysis]);
  const sceneCount = analysis.segments.length;

  return (
    <div className="space-y-6">
      {/* AUDIO DNA */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Audio DNA
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/40">
          <DnaTile label="Tempo" value={`${Math.round(analysis.bpm)}`} unit="BPM" accent />
          <DnaTile label="Key" value={analysis.keySignature} unit="" />
          <DnaTile label="Duration" value={formatTime(analysis.durationSec)} unit="" />
          <DnaTile
            label="Loudness"
            value={analysis.loudnessDb !== undefined ? analysis.loudnessDb.toFixed(1) : "—"}
            unit="dB"
          />
        </div>
      </div>

      {/* EMOTIONAL ARC */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Emotional Arc
        </div>
        <div className="border border-border/40 bg-black/30 p-4 space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div className="text-sm font-bold uppercase tracking-widest">
              {describeArcShape(arc.arcShape)}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {arc.activationPct}% activation · {arc.atmospherePct}% atmosphere
            </div>
          </div>
          <div className="h-2 flex bg-background overflow-hidden">
            <div
              className="bg-primary"
              style={{ width: `${(arc.peak / arc.total) * 100}%` }}
              title={`Peak: ${arc.peak}`}
            />
            <div
              className="bg-accent"
              style={{ width: `${(arc.build / arc.total) * 100}%` }}
              title={`Build: ${arc.build}`}
            />
            <div
              className="bg-indigo-700"
              style={{ width: `${(arc.groove / arc.total) * 100}%` }}
              title={`Groove: ${arc.groove}`}
            />
            <div
              className="bg-zinc-700"
              style={{ width: `${(arc.rest / arc.total) * 100}%` }}
              title={`Rest: ${arc.rest}`}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <span><i className="inline-block w-2 h-2 bg-primary mr-1.5 align-middle" />Peak {arc.peak}</span>
            <span><i className="inline-block w-2 h-2 bg-accent mr-1.5 align-middle" />Build {arc.build}</span>
            <span><i className="inline-block w-2 h-2 bg-indigo-700 mr-1.5 align-middle" />Groove {arc.groove}</span>
            <span><i className="inline-block w-2 h-2 bg-zinc-700 mr-1.5 align-middle" />Rest {arc.rest}</span>
          </div>
        </div>
      </div>

      {/* RECOMMENDED VISUAL STYLE */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Recommended Visual Style
        </div>
        <div className="border border-border/40 bg-black/30 p-4 space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h4 className="text-xl font-bold uppercase tracking-tight text-primary">
              {visual.headline}
            </h4>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              direction
            </span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <dt className="text-muted-foreground/70 uppercase text-[10px] tracking-widest mb-1">
                Palette
              </dt>
              <dd>{visual.palette}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground/70 uppercase text-[10px] tracking-widest mb-1">
                Lensing
              </dt>
              <dd>{visual.lensing}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground/70 uppercase text-[10px] tracking-widest mb-1">
                Pacing
              </dt>
              <dd>{visual.pacing}</dd>
            </div>
          </dl>
          <ul className="space-y-1 pt-2 border-t border-border/30 text-xs font-mono text-muted-foreground">
            {visual.descriptors.map((d, i) => (
              <li key={i} className="flex gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 text-primary/70 shrink-0" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* SCENES + CTA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        <div className="border border-border/40 bg-black/30 p-5 sm:col-span-1 flex flex-col justify-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Estimated scenes
          </div>
          <div className="text-5xl font-bold font-mono text-primary leading-none">
            {sceneCount}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2">
            paced to {Math.round(analysis.bpm)} BPM grid
          </div>
        </div>
        <div className="sm:col-span-2 border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 flex flex-col gap-3 justify-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">
            Next step
          </div>
          <p className="text-sm font-mono text-foreground/90">
            Convert this analysis into a beat-synced cinematic storyboard with shot-by-shot
            prompts for each segment.
          </p>
          <Link href={`/projects/${projectId}/storyboard`}>
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-none uppercase tracking-widest font-bold bg-primary hover:bg-primary/90 shadow-[0_0_24px_-6px_rgba(219,39,119,0.7)]"
            >
              <Clapperboard className="w-4 h-4 mr-2" />
              Generate Storyboard
            </Button>
          </Link>
        </div>
      </div>

      {/* JUMP TO FULL BREAKDOWN */}
      <div className="flex items-center justify-center pt-2">
        <a
          href="#full-breakdown"
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
        >
          <ArrowDown className="w-3 h-3" /> Full Breakdown
        </a>
      </div>
    </div>
  );
}

function DnaTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-black/40 p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-2xl sm:text-3xl font-bold font-mono ${accent ? "text-primary" : ""}`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Detailed Panels (structural timeline, emotional map, structured table, editor)
// ─────────────────────────────────────────────────────────────────────────
function DetailedPanels({
  analysis,
  projectId,
}: {
  analysis: AnalysisResult;
  projectId: string;
}) {
  const sortedEmotional = [...analysis.emotionalMap].sort((a, b) => a.timeSec - b.timeSec);
  return (
    <div id="full-breakdown" className="space-y-6 pt-8 border-t border-border/30">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
          Full breakdown
        </div>
        <h2 className="text-2xl font-bold tracking-tight uppercase">
          Raw analysis output
        </h2>
      </div>

      <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm flex items-center justify-between">
            <span>Structural Timeline</span>
            <span className="text-[10px] text-muted-foreground font-mono normal-case tracking-normal">
              hover for detail
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 relative flex items-end w-full border-b border-border bg-background/50">
            {analysis.segments.map((seg) => {
              const width = ((seg.endSec - seg.startSec) / analysis.durationSec) * 100;
              const left = (seg.startSec / analysis.durationSec) * 100;
              const height = Math.max(15, seg.intensity * 100);
              const color = SECTION_COLORS[seg.section] ?? "hsl(var(--primary))";
              return (
                <div
                  key={seg.id}
                  className="absolute bottom-0 border-r border-black/50 opacity-85 hover:opacity-100 transition-opacity cursor-crosshair group"
                  style={{
                    width: `${width}%`,
                    left: `${left}%`,
                    height: `${height}%`,
                    backgroundColor: color,
                  }}
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-20 left-1/2 -translate-x-1/2 bg-black border border-border px-3 py-2 text-[10px] font-mono whitespace-nowrap z-10 pointer-events-none">
                    <div className="text-primary font-bold uppercase">
                      {seg.section.replace("_", " ")}
                    </div>
                    <div>
                      {formatTime(seg.startSec)} – {formatTime(seg.endSec)}
                    </div>
                    <div className="text-muted-foreground">
                      {Math.round(seg.intensity * 100)}% · {intensityLabel(seg.intensity)} · {seg.emotion}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground">
            <span>0:00</span>
            <span>{formatTime(analysis.durationSec)}</span>
          </div>

          <div className="flex flex-wrap gap-3 mt-4 text-[10px] font-mono">
            {Object.entries(SECTION_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5">
                <span className="w-3 h-3" style={{ backgroundColor: color }} />
                <span className="uppercase text-muted-foreground">{name.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm flex items-center justify-between">
            <span>Emotional Map</span>
            <div className="flex items-center gap-3 text-[10px] font-mono normal-case tracking-normal text-muted-foreground">
              <span className="flex items-center gap-1">
                <i className="w-3 h-0.5 bg-primary" /> Arousal
              </span>
              <span className="flex items-center gap-1">
                <i className="w-3 h-0.5 bg-accent" /> Valence
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sortedEmotional} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="timeSec"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickFormatter={(val) => `${Math.floor(val)}s`}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 1]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "black",
                  borderRadius: 0,
                  border: "1px solid hsl(var(--border))",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
                labelFormatter={(val) => `Time: ${val}s`}
              />
              {analysis.segments.map((seg) => (
                <ReferenceArea
                  key={`ref-${seg.id}`}
                  x1={seg.startSec}
                  x2={seg.endSec}
                  fill={SECTION_COLORS[seg.section] ?? "hsl(var(--primary))"}
                  fillOpacity={0.06}
                />
              ))}
              <Line
                type="monotone"
                dataKey="arousal"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Intensity (Arousal)"
              />
              <Line
                type="monotone"
                dataKey="valence"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={false}
                name="Positivity (Valence)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            Structured Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs font-mono min-w-[640px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50 [&>th]:py-2 [&>th]:pr-4 uppercase text-[10px] tracking-widest">
                <th>#</th>
                <th>Start</th>
                <th>End</th>
                <th>Section</th>
                <th>Energy</th>
                <th>Emotion</th>
                <th>Vis. Intensity</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {analysis.segments.map((seg) => {
                const lvl = intensityLabel(seg.intensity);
                const vis = visualIntensity(seg.intensity);
                return (
                  <tr
                    key={seg.id}
                    className="border-b border-border/20 [&>td]:py-2 [&>td]:pr-4 align-top"
                  >
                    <td className="text-primary font-bold">{seg.index + 1}</td>
                    <td>{formatTime(seg.startSec)}</td>
                    <td>{formatTime(seg.endSec)}</td>
                    <td>
                      <span
                        className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: SECTION_COLORS[seg.section] ?? "hsl(var(--primary))",
                          color: "white",
                        }}
                      >
                        {seg.section.replace("_", " ")}
                      </span>
                    </td>
                    <td>{lvl}</td>
                    <td>{seg.emotion}</td>
                    <td>
                      <span className="text-primary">{"|".repeat(vis)}</span>
                      <span className="text-muted-foreground">{"|".repeat(5 - vis)}</span>
                      <span className="ml-2 text-muted-foreground">{vis}/5</span>
                    </td>
                    <td className="text-muted-foreground">
                      {seg.section === "chorus"
                        ? "Hold long takes; drop on downbeat"
                        : seg.section === "verse"
                          ? "Tight inserts; slow handheld"
                          : seg.section === "bridge"
                            ? "Reverie; subject isolated"
                            : seg.section === "intro"
                              ? "Slow cinematic build"
                              : seg.section === "outro"
                                ? "Recede to silhouette"
                                : seg.section === "drop"
                                  ? "Cut on the kick; strobe pulse"
                                  : "Maintain pacing"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
        <CardContent className="p-6">
          <SegmentEditor
            projectId={projectId}
            segments={analysis.segments}
            durationSec={analysis.durationSec}
          />
        </CardContent>
      </Card>
    </div>
  );
}

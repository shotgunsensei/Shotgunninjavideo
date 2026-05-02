import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Zap,
  Loader2,
  AlertTriangle,
  RefreshCw,
  FileAudio,
  Cpu,
  Volume2,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAnalysis,
  useAnalyzeAudio,
  getGetAnalysisQueryKey,
  useGetProject,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { analyzeAudioFile, type AnalysisStage } from "@/lib/audioAnalysis";
import { getAudio } from "@/lib/audioStorage";
import { SegmentEditor } from "@/components/SegmentEditor";

const STAGE_COPY: Record<AnalysisStage, string> = {
  decoding: "Decoding container",
  downmix: "Downmixing channels",
  energy: "Building energy envelope",
  bpm: "Detecting tempo",
  beats: "Locating beats",
  sections: "Finding section boundaries",
  key: "Estimating musical key",
  emotion: "Mapping emotional arc",
  done: "Complete",
};

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

export default function Analysis() {
  const [, params] = useRoute("/projects/:id/analysis");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [hasCachedAudio, setHasCachedAudio] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<{ stage: AnalysisStage; pct: number; detail?: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const {
    data: analysis,
    isLoading: analysisLoading,
    isError: analysisFetchError,
    refetch: refetchAnalysis,
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

  const runRealAnalysis = async () => {
    if (!projectId) return;
    setAnalysisError(null);
    setIsAnalyzing(true);
    setProgress({ stage: "decoding", pct: 2, detail: "Loading file from cache" });
    try {
      const stored = await getAudio(projectId);
      if (!stored) {
        throw new Error("No audio file cached locally. Re-upload the track to run analysis here.");
      }
      const result = await analyzeAudioFile(stored.blob, (stage, pct, detail) => {
        setProgress({ stage, pct, detail });
      });
      await new Promise<void>((resolve, reject) => {
        submitAnalysis.mutate(
          {
            id: projectId,
            data: {
              durationSec: result.durationSec,
              bpm: result.bpm,
              keySignature: result.keySignature,
              energy: result.energy,
              loudnessDb: result.loudnessDb,
              beats: result.beats,
              segments: result.segments.map((s, i) => ({
                index: i,
                startSec: s.startSec,
                endSec: s.endSec,
                section: s.section,
                intensity: s.intensity,
                emotion: s.emotion,
                bpm: s.bpm,
              })),
              emotionalMap: result.emotionalMap,
            },
          },
          {
            onSuccess: () => {
              toast({
                title: "Analysis complete",
                description: `${result.bpm} BPM · ${result.keySignature} · ${result.segments.length} segments · ${result.beats.length} beats`,
              });
              queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(projectId) });
              queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
              resolve();
            },
            onError: (err) => reject(err),
          },
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed.";
      setAnalysisError(msg);
      toast({ variant: "destructive", title: "Analysis failed", description: msg });
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  const runMockAnalysis = () => {
    setAnalysisError(null);
    submitAnalysis.mutate(
      { id: projectId, data: undefined as never },
      {
        onSuccess: () => {
          toast({ title: "Mock analysis applied", description: "Deterministic placeholder timeline generated." });
          queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Mock analysis failed" }),
      },
    );
  };

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
      </div>
    );
  }

  // No analysis yet (or failed to fetch) — show launch / progress UI
  if (!analysis || analysisFetchError) {
    return (
      <div className="max-w-3xl mx-auto mt-12 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase">Deep Acoustic Scan</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Browser-side analysis: BPM, beats, sections, key, emotional arc.
          </p>
        </div>

        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur relative overflow-hidden">
          <CardContent className="p-10 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center text-primary mx-auto shadow-[0_0_30px_rgba(219,39,119,0.4)]">
              <Cpu className="w-8 h-8" />
            </div>

            {isAnalyzing && progress ? (
              <div className="space-y-4">
                <h3 className="text-xl font-bold uppercase tracking-widest">{STAGE_COPY[progress.stage]}</h3>
                <p className="text-xs font-mono text-muted-foreground">{progress.detail ?? ""}</p>
                <Progress value={progress.pct} className="h-1 rounded-none [&>div]:bg-primary" />
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  {progress.pct}% · stage {progress.stage}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-2xl font-bold uppercase tracking-widest mb-2">
                    {hasCachedAudio ? "Audio Cached" : "Audio Not Available"}
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground max-w-md mx-auto">
                    {hasCachedAudio
                      ? "Run a full Web Audio decode to extract real BPM, beat times, structural sections, and key. Stays 100% in your browser."
                      : "Local audio cache is empty (file may have been cleared, or you opened this from a different browser). Re-upload to run real analysis, or drop a deterministic mock timeline."}
                  </p>
                </div>

                {analysisError && (
                  <div className="flex items-start gap-2 text-xs font-mono text-yellow-500/90 border border-yellow-600/30 bg-yellow-950/20 p-3 text-left">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{analysisError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  {hasCachedAudio && (
                    <Button
                      size="lg"
                      onClick={runRealAnalysis}
                      disabled={submitAnalysis.isPending}
                      className="rounded-none uppercase tracking-widest font-bold px-8 bg-primary hover:bg-primary/90 shadow-[0_0_20px_-5px_rgba(219,39,119,0.5)]"
                    >
                      <Zap className="w-4 h-4 mr-2" /> Run Deep Analysis
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={runMockAnalysis}
                    disabled={submitAnalysis.isPending}
                    className="rounded-none uppercase tracking-widest font-bold px-8 border-border/50"
                  >
                    {submitAnalysis.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileAudio className="w-4 h-4 mr-2" />
                    )}
                    Use Mock Analysis
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (analysisLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sort emotional map for the chart in case server returned out of order
  const sortedEmotional = [...analysis.emotionalMap].sort((a, b) => a.timeSec - b.timeSec);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" /> Analysis Results
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
            Acoustic Profile Extracted
          </p>
        </div>
        <div className="flex gap-2">
          {hasCachedAudio && (
            <Button
              onClick={runRealAnalysis}
              disabled={isAnalyzing || submitAnalysis.isPending}
              variant="outline"
              className="rounded-none uppercase tracking-widest text-xs border-primary/40 hover:bg-primary/10"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Re-Analyze
            </Button>
          )}
          <Button
            onClick={() => refetchAnalysis()}
            variant="ghost"
            size="icon"
            className="rounded-none border border-border/50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isAnalyzing && progress && (
        <Card className="rounded-none border-primary/40 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-primary">{STAGE_COPY[progress.stage]}</span>
              <span className="text-muted-foreground">{progress.pct}%</span>
            </div>
            <Progress value={progress.pct} className="h-1 rounded-none [&>div]:bg-primary" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2">Tempo (BPM)</div>
            <div className="text-3xl font-bold font-mono text-primary">{Math.round(analysis.bpm)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2">Key Signature</div>
            <div className="text-3xl font-bold font-mono text-accent">{analysis.keySignature}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2">Duration</div>
            <div className="text-3xl font-bold font-mono">{formatTime(analysis.durationSec)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2 flex justify-between">
              <span>Loudness</span>
              <span>{analysis.loudnessDb !== undefined ? `${analysis.loudnessDb.toFixed(1)} dB` : "—"}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Progress value={analysis.energy * 100} className="h-2 rounded-none bg-background flex-1 [&>div]:bg-primary" />
              <span className="text-[10px] font-mono text-muted-foreground">{Math.round(analysis.energy * 100)}%</span>
            </div>
          </CardContent>
        </Card>
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
                    <div className="text-primary font-bold uppercase">{seg.section.replace("_", " ")}</div>
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
          <CardTitle className="uppercase tracking-widest text-sm">Emotional Map</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
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
          <CardTitle className="uppercase tracking-widest text-sm">Structured Timeline</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
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
                  <tr key={seg.id} className="border-b border-border/20 [&>td]:py-2 [&>td]:pr-4 align-top">
                    <td className="text-primary font-bold">{seg.index + 1}</td>
                    <td>{formatTime(seg.startSec)}</td>
                    <td>{formatTime(seg.endSec)}</td>
                    <td>
                      <span
                        className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{ backgroundColor: SECTION_COLORS[seg.section] ?? "hsl(var(--primary))", color: "white" }}
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

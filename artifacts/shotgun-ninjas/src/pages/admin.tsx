import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  ExternalLink,
  Code2,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  Database,
  ShieldCheck,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAdminDiagnostics,
  useGetAdminProjectFull,
  useTestExportFormat,
  useResetDemoData,
  getGetAdminDiagnosticsQueryKey,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Loose typings — admin endpoints return free-form JSON intentionally.
// ---------------------------------------------------------------------------

interface Criterion {
  key: string;
  label: string;
  weight: number;
  passed: boolean;
  detail: string;
}

interface ProjectDiag {
  project: { id: string; title: string; artist?: string; status: string };
  qualityScore: number;
  qualityGrade: "A" | "B" | "C" | "D" | "F";
  criteria: Criterion[];
  validation: {
    missingFields: string[];
    brokenTimestamps: { sceneIndex: number; sceneId: string; reason: string }[];
    lockedScenes: { index: number; id: string; title: string }[];
    issuesCount: number;
  };
  counts: {
    audioFiles: number;
    timelineSegments: number;
    scenes: number;
    prompts: number;
    lyrics: number;
    exports: number;
    marketingAssets: number;
  };
  hasBrandPreset: boolean;
  hasAnalysis: boolean;
}

interface DiagnosticsResponse {
  summary: {
    totalProjects: number;
    avgQualityScore: number;
    readyToProduce: number;
    withIssues: number;
  };
  subscription: {
    currentPlan: string;
    planName: string;
    planOrder: number;
    status: string;
    projectLimit: number | null;
    projectCount: number;
    withinProjectLimit: boolean;
    exportGate: {
      format: string;
      label: string;
      allowed: boolean;
      requiredPlan: string;
      requiredFeature: string | null;
    }[];
  };
  projects: ProjectDiag[];
}

const EXPORT_FORMATS = [
  "production_plan",
  "txt",
  "json",
  "csv_shot_list",
  "lyrics_timing",
  "ai_prompt_pack",
  "capcut_guide",
  "davinci_guide",
  "treatment",
  "social_captions",
] as const;

type ExportFormat = (typeof EXPORT_FORMATS)[number];

function gradeColor(grade: ProjectDiag["qualityGrade"]): string {
  switch (grade) {
    case "A":
      return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    case "B":
      return "text-sky-400 bg-sky-500/15 border-sky-500/30";
    case "C":
      return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    case "D":
      return "text-orange-400 bg-orange-500/15 border-orange-500/30";
    case "F":
      return "text-red-400 bg-red-500/15 border-red-500/30";
  }
}

function JsonBlock({ data, testid }: { data: unknown; testid?: string }) {
  return (
    <pre
      className="text-[11px] leading-snug font-mono bg-background/70 border border-border/40 rounded p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all"
      data-testid={testid}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Per-project drill-down panel
// ---------------------------------------------------------------------------

function ProjectDrilldown({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const { data: full, isLoading } = useGetAdminProjectFull(projectId);
  const testExport = useTestExportFormat();

  const [section, setSection] = useState<
    "analysis" | "storyboard" | "prompts" | "lyrics" | "exports" | "marketing" | "all"
  >("storyboard");
  const [exportResult, setExportResult] = useState<
    { format: string; ok: boolean; sizeBytes?: number; preview?: string; error?: string } | null
  >(null);

  const handleTestExport = async (format: ExportFormat) => {
    try {
      const result = await testExport.mutateAsync({ id: projectId, format });
      const r = result as {
        ok: boolean;
        format: string;
        sizeBytes?: number;
        preview?: string;
        error?: string;
      };
      setExportResult(r);
      toast({
        title: r.ok ? `${format}: ${r.sizeBytes} bytes` : `${format} failed`,
        description: r.ok ? "Builder ran successfully (no data persisted)." : r.error,
        variant: r.ok ? "default" : "destructive",
      });
    } catch (err) {
      toast({
        title: "Test failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  if (isLoading || !full) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="drilldown-loading">
        Loading project data...
      </div>
    );
  }

  const f = full as Record<string, unknown>;

  const sectionData: Record<string, unknown> = {
    analysis: f.analysis,
    storyboard: f.storyboardScenes,
    prompts: f.prompts,
    lyrics: f.lyrics,
    exports: f.exports,
    marketing: f.marketingAssets,
    all: f,
  };

  const sections: { id: typeof section; label: string; count?: number }[] = [
    { id: "analysis", label: "Analysis", count: f.analysis ? 1 : 0 },
    { id: "storyboard", label: "Storyboard", count: Array.isArray(f.storyboardScenes) ? f.storyboardScenes.length : 0 },
    { id: "prompts", label: "Prompts", count: Array.isArray(f.prompts) ? f.prompts.length : 0 },
    { id: "lyrics", label: "Lyrics", count: Array.isArray(f.lyrics) ? f.lyrics.length : 0 },
    { id: "exports", label: "Exports", count: Array.isArray(f.exports) ? f.exports.length : 0 },
    { id: "marketing", label: "Marketing", count: Array.isArray(f.marketingAssets) ? f.marketingAssets.length : 0 },
    { id: "all", label: "Everything" },
  ];

  return (
    <div className="space-y-4 p-4 bg-background/40">
      {/* JSON viewer */}
      <Card className="p-4 space-y-3 border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold uppercase tracking-wider">JSON Viewer</h4>
          </div>
          <div className="flex flex-wrap gap-1">
            {sections.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={section === s.id ? "default" : "outline"}
                onClick={() => setSection(s.id)}
                className="h-7 text-xs"
                data-testid={`json-tab-${s.id}`}
              >
                {s.label}
                {typeof s.count === "number" && (
                  <span className="ml-1 opacity-70">({s.count})</span>
                )}
              </Button>
            ))}
          </div>
        </div>
        <JsonBlock data={sectionData[section]} testid={`json-block-${section}`} />
      </Card>

      {/* Test exports */}
      <Card className="p-4 space-y-3 border-border/50">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold uppercase tracking-wider">Test Export Builders</h4>
          <span className="text-xs text-muted-foreground italic">
            Runs builder, no DB write
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXPORT_FORMATS.map((format) => (
            <Button
              key={format}
              size="sm"
              variant="outline"
              onClick={() => handleTestExport(format)}
              disabled={testExport.isPending}
              className="h-7 text-xs gap-1"
              data-testid={`button-test-export-${format}`}
            >
              {testExport.isPending && testExport.variables?.format === format ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {format}
            </Button>
          ))}
        </div>
        {exportResult && (
          <div
            className={`text-xs p-3 rounded border space-y-2 ${
              exportResult.ok
                ? "bg-emerald-500/5 border-emerald-500/30"
                : "bg-red-500/5 border-red-500/30"
            }`}
            data-testid="export-result"
          >
            <div className="flex items-center gap-2 font-mono">
              {exportResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="font-semibold">{exportResult.format}</span>
              {exportResult.ok && (
                <span className="text-muted-foreground">
                  → {exportResult.sizeBytes?.toLocaleString()} bytes
                </span>
              )}
            </div>
            {exportResult.ok && exportResult.preview && (
              <pre className="text-[10px] bg-background/70 border border-border/40 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                {exportResult.preview}
                {exportResult.preview.length >= 800 ? "\n…" : ""}
              </pre>
            )}
            {!exportResult.ok && (
              <p className="text-red-300 font-mono">{exportResult.error}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useGetAdminDiagnostics();
  const resetDemo = useResetDemoData();
  const [openProject, setOpenProject] = useState<string | null>(null);

  const diag = data as DiagnosticsResponse | undefined;

  const handleReset = async () => {
    try {
      const result = await resetDemo.mutateAsync();
      const r = result as { deletedProjects: number; seededTitles: string[] };
      toast({
        title: "Demo data reset",
        description: `Deleted ${r.deletedProjects} project(s), re-seeded ${r.seededTitles.length}.`,
      });
      queryClient.invalidateQueries({ queryKey: getGetAdminDiagnosticsQueryKey() });
    } catch (err) {
      toast({
        title: "Reset failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const sortedProjects = useMemo(() => {
    if (!diag?.projects) return [];
    return [...diag.projects].sort((a, b) => a.qualityScore - b.qualityScore);
  }, [diag]);

  if (isLoading) {
    return (
      <div className="p-8 text-muted-foreground" data-testid="admin-loading">
        Loading diagnostics...
      </div>
    );
  }
  if (!diag) {
    return (
      <div className="p-8 text-muted-foreground" data-testid="admin-error">
        Failed to load diagnostics.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8" data-testid="admin-page">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Bug className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin / Debug</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Project diagnostics, quality scores, JSON viewers, and demo data controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-diagnostics" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-reset-demo" className="gap-2">
                <Trash2 className="w-4 h-4" /> Reset demo data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset built-in demo projects?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the seeded demo projects ("Black Velvet Static" and "Shotgun Ninjas Rise") and re-creates them from scratch. Cascades through every related row (scenes, prompts, lyrics, exports, marketing). Custom projects you created are not touched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  data-testid="button-confirm-reset"
                  disabled={resetDemo.isPending}
                >
                  {resetDemo.isPending ? "Resetting..." : "Yes, reset"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-border/50" data-testid="stat-total-projects">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <Database className="w-3 h-3" /> Total projects
          </div>
          <div className="text-2xl font-bold tabular-nums">{diag.summary.totalProjects}</div>
        </Card>
        <Card className="p-4 border-border/50" data-testid="stat-avg-quality">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <Sparkles className="w-3 h-3" /> Avg quality
          </div>
          <div className="text-2xl font-bold tabular-nums">{diag.summary.avgQualityScore}<span className="text-sm text-muted-foreground">/100</span></div>
        </Card>
        <Card className="p-4 border-border/50" data-testid="stat-ready-produce">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ready to produce
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-400">{diag.summary.readyToProduce}</div>
        </Card>
        <Card className="p-4 border-border/50" data-testid="stat-with-issues">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> With issues
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-400">{diag.summary.withIssues}</div>
        </Card>
      </div>

      {/* SUBSCRIPTION GATE STATE */}
      <Card className="p-5 border-border/50 space-y-4" data-testid="subscription-gate-card">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Subscription gate state</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Current plan</div>
            <div className="font-bold uppercase" data-testid="text-current-plan">{diag.subscription.planName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="font-mono">{diag.subscription.status}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Project limit</div>
            <div className="font-mono">
              {diag.subscription.projectLimit === null
                ? "∞"
                : `${diag.subscription.projectCount} / ${diag.subscription.projectLimit}`}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Within limit?</div>
            <div className="font-mono">
              {diag.subscription.withinProjectLimit ? (
                <span className="text-emerald-400">YES</span>
              ) : (
                <span className="text-red-400">NO</span>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Export format gates</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {diag.subscription.exportGate.map((g) => (
              <div
                key={g.format}
                className="flex items-center justify-between text-xs p-2 rounded bg-background/50 border border-border/30"
                data-testid={`gate-${g.format}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {g.allowed ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                  <span className="font-mono truncate">{g.format}</span>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {g.allowed ? "open" : `needs ${g.requiredPlan}`}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* PROJECT TABLE */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Projects ({sortedProjects.length}, sorted lowest quality first)
        </h2>
        {sortedProjects.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground border-dashed">
            No projects. Create one from the dashboard.
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedProjects.map((p) => {
              const isOpen = openProject === p.project.id;
              return (
                <Card
                  key={p.project.id}
                  className="border-border/50 overflow-hidden"
                  data-testid={`project-row-${p.project.id}`}
                >
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(o) => setOpenProject(o ? p.project.id : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors text-left" data-testid={`button-toggle-${p.project.id}`}>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                        )}
                        {/* Quality grade badge */}
                        <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center font-bold shrink-0 ${gradeColor(p.qualityGrade)}`} data-testid={`grade-${p.project.id}`}>
                          <span className="text-lg leading-none">{p.qualityGrade}</span>
                          <span className="text-[9px] tabular-nums opacity-80">{p.qualityScore}</span>
                        </div>
                        {/* Title + status */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate" data-testid={`title-${p.project.id}`}>{p.project.title}</h3>
                            <Badge variant="outline" className="text-[10px]">{p.project.status}</Badge>
                            {p.validation.issuesCount > 0 && (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {p.validation.issuesCount} issue{p.validation.issuesCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {p.validation.lockedScenes.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Lock className="w-3 h-3" />
                                {p.validation.lockedScenes.length} locked
                              </Badge>
                            )}
                          </div>
                          {p.project.artist && (
                            <p className="text-xs text-muted-foreground mt-0.5">{p.project.artist}</p>
                          )}
                          <div className="mt-2 flex items-center gap-3">
                            <Progress value={p.qualityScore} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
                              {p.qualityScore}/100
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-mono">
                            <span>audio:{p.counts.audioFiles}</span>
                            <span>seg:{p.counts.timelineSegments}</span>
                            <span>scenes:{p.counts.scenes}</span>
                            <span>prompts:{p.counts.prompts}</span>
                            <span>lyrics:{p.counts.lyrics}</span>
                            <span>exports:{p.counts.exports}</span>
                            <span>marketing:{p.counts.marketingAssets}</span>
                          </div>
                        </div>
                        <Link
                          href={`/projects/${p.project.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
                          data-testid={`link-open-${p.project.id}`}
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </Link>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      {/* Quality breakdown */}
                      <div className="border-t border-border/40 p-4 bg-background/30 space-y-4">
                        <div>
                          <h4 className="text-xs uppercase tracking-wider font-semibold mb-2 text-muted-foreground">
                            Quality Score Breakdown
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {p.criteria.map((c) => (
                              <div
                                key={c.key}
                                className="flex items-center justify-between text-xs p-2 rounded bg-background/50 border border-border/30"
                                data-testid={`criterion-${p.project.id}-${c.key}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {c.passed ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                                  )}
                                  <span className="font-medium">{c.label}</span>
                                  <span className="text-muted-foreground italic truncate">— {c.detail}</span>
                                </div>
                                <span className="font-mono text-muted-foreground tabular-nums shrink-0 ml-2">
                                  +{c.passed ? c.weight : 0}/{c.weight}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Validation issues */}
                        {(p.validation.missingFields.length > 0 ||
                          p.validation.brokenTimestamps.length > 0 ||
                          p.validation.lockedScenes.length > 0) && (
                          <div className="space-y-2">
                            <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                              Validation
                            </h4>
                            {p.validation.missingFields.length > 0 && (
                              <div className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/30" data-testid={`missing-fields-${p.project.id}`}>
                                <div className="font-semibold text-amber-400 mb-1">Missing fields ({p.validation.missingFields.length})</div>
                                <div className="font-mono text-muted-foreground">{p.validation.missingFields.join(", ")}</div>
                              </div>
                            )}
                            {p.validation.brokenTimestamps.length > 0 && (
                              <div className="text-xs p-2 rounded bg-red-500/10 border border-red-500/30" data-testid={`broken-timestamps-${p.project.id}`}>
                                <div className="font-semibold text-red-400 mb-1">Broken timestamps ({p.validation.brokenTimestamps.length})</div>
                                <ul className="space-y-1">
                                  {p.validation.brokenTimestamps.slice(0, 5).map((t, i) => (
                                    <li key={i} className="font-mono text-muted-foreground">
                                      Scene #{t.sceneIndex + 1}: {t.reason}
                                    </li>
                                  ))}
                                  {p.validation.brokenTimestamps.length > 5 && (
                                    <li className="text-muted-foreground italic">
                                      …{p.validation.brokenTimestamps.length - 5} more
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                            {p.validation.lockedScenes.length > 0 && (
                              <div className="text-xs p-2 rounded bg-blue-500/10 border border-blue-500/30" data-testid={`locked-scenes-${p.project.id}`}>
                                <div className="font-semibold text-blue-400 mb-1">Locked scenes ({p.validation.lockedScenes.length})</div>
                                <div className="font-mono text-muted-foreground">
                                  {p.validation.lockedScenes.map((s) => `#${s.index + 1} ${s.title}`).join(" · ")}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Drilldown (lazy: only fetches when open) */}
                        {isOpen && <ProjectDrilldown projectId={p.project.id} />}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

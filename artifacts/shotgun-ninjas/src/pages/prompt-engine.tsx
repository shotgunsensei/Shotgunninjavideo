import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  Wand2,
  Copy,
  Check,
  FileText,
  FileJson,
  FileSpreadsheet,
  Clapperboard,
  Loader2,
  Film,
  Image as ImageIcon,
  Scissors,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetPromptEngine,
  getGetPromptEngineQueryKey,
  useGetProject,
  getGetProjectQueryKey,
  useCreateExport,
  type PlatformMeta,
  type ScenePromptEngineRow,
  type PromptBlock,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type PlatformKind = "video" | "image" | "editing";

const KIND_META: Record<PlatformKind, { label: string; icon: typeof Film }> = {
  video: { label: "Video", icon: Film },
  image: { label: "Image", icon: ImageIcon },
  editing: { label: "Editing", icon: Scissors },
};

function projectFilename(title: string | undefined, suffix: string, ext: string) {
  const base = (title || "project").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return `${base}_${suffix}.${ext}`;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(v: unknown): string {
  let s = String(v ?? "");
  // Spreadsheet formula-injection neutralisation: any cell starting with =, +,
  // -, @, tab, or CR is prefixed with a single quote so Excel / Sheets / Numbers
  // treat it as text instead of a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildTxtExport(
  scenes: ScenePromptEngineRow[],
  platforms: PlatformMeta[],
  projectTitle: string,
): string {
  const out: string[] = [];
  out.push(`# ${projectTitle} — Prompt Engine`);
  out.push(`Generated ${new Date().toISOString()}`);
  out.push("");
  for (const s of scenes) {
    out.push(
      `=== Scene ${s.sceneIndex + 1} (${s.startSec.toFixed(1)}s – ${s.endSec.toFixed(1)}s) — ${s.sceneTitle} ===`,
    );
    out.push(`Shot: ${s.shotType} | Camera: ${s.cameraMovement}`);
    out.push("");
    out.push("-- Structured fields --");
    out.push(`Subject:        ${s.block.subject}`);
    out.push(`Setting:        ${s.block.setting}`);
    out.push(`Visual style:   ${s.block.visualStyle}`);
    out.push(`Camera motion:  ${s.block.cameraMotion}`);
    out.push(`Lighting:       ${s.block.lighting}`);
    out.push(`Mood:           ${s.block.mood}`);
    out.push(`Color palette:  ${s.block.colorPalette}`);
    out.push(`Aspect ratio:   ${s.block.aspectRatio}`);
    out.push(`Negative:       ${s.block.negativePrompt}`);
    out.push(`Duration:       ${s.block.durationSec}s`);
    out.push(`Transition:     ${s.block.transition}`);
    out.push("");
    out.push("-- Per-platform prompts --");
    for (const p of platforms) {
      out.push(`[${p.label}]`);
      out.push(s.platforms[p.id] ?? "");
      out.push("");
    }
    out.push("");
  }
  return out.join("\n");
}

function buildJsonExport(
  scenes: ScenePromptEngineRow[],
  platforms: PlatformMeta[],
  projectTitle: string,
): string {
  return JSON.stringify(
    {
      project: projectTitle,
      generatedAt: new Date().toISOString(),
      platforms,
      scenes,
    },
    null,
    2,
  );
}

function buildCsvShotList(scenes: ScenePromptEngineRow[]): string {
  const header = [
    "scene_no",
    "start_sec",
    "end_sec",
    "raw_duration_sec",
    "effective_duration_sec",
    "title",
    "shot_type",
    "camera_motion",
    "subject",
    "setting",
    "lighting",
    "color_palette",
    "mood",
    "visual_style",
    "aspect_ratio",
    "transition",
  ];
  const rows = scenes.map((s) => {
    const rawDuration = Math.max(0, s.endSec - s.startSec);
    return [
      s.sceneIndex + 1,
      s.startSec.toFixed(2),
      s.endSec.toFixed(2),
      rawDuration.toFixed(2),
      // Effective duration matches what prompt formatters actually use, so the
      // CSV stays consistent with TXT/JSON/per-platform prompt durations even
      // when a scene has degenerate timing.
      s.block.durationSec.toFixed(2),
      s.sceneTitle,
      s.shotType,
      s.cameraMovement,
      s.block.subject,
      s.block.setting,
      s.block.lighting,
      s.block.colorPalette,
      s.block.mood,
      s.block.visualStyle,
      s.block.aspectRatio,
      s.block.transition,
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

interface CopyButtonProps {
  value: string;
  label?: string;
  testId: string;
  className?: string;
}

function CopyButton({ value, label = "Copy", testId, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid={testId}
      className={`rounded-none uppercase tracking-widest text-[10px] font-mono h-7 px-2 ${className ?? ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          toast({
            title: "Copy failed",
            description: "Clipboard access blocked — select and copy manually.",
            variant: "destructive",
          });
        }
      }}
    >
      {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

interface BlockFieldProps {
  label: string;
  value: string;
}

function BlockField({ label, value }: BlockFieldProps) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground pt-0.5">
        {label}
      </span>
      <span className="text-xs font-mono text-foreground/90 leading-relaxed break-words">
        {value || "—"}
      </span>
    </div>
  );
}

function StructuredBlock({ block }: { block: PromptBlock }) {
  return (
    <div className="space-y-2 border border-border/40 bg-card/30 p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-accent mb-1">
        Structured fields
      </div>
      <BlockField label="Subject" value={block.subject} />
      <BlockField label="Setting" value={block.setting} />
      <BlockField label="Visual style" value={block.visualStyle} />
      <BlockField label="Camera motion" value={block.cameraMotion} />
      <BlockField label="Lighting" value={block.lighting} />
      <BlockField label="Mood" value={block.mood} />
      <BlockField label="Color palette" value={block.colorPalette} />
      <BlockField label="Aspect ratio" value={block.aspectRatio} />
      <BlockField label="Duration" value={`${block.durationSec}s`} />
      <BlockField label="Transition" value={block.transition} />
      <BlockField label="Negative" value={block.negativePrompt} />
    </div>
  );
}

interface PlatformCardProps {
  platform: PlatformMeta;
  text: string;
  sceneIndex: number;
}

function PlatformCard({ platform, text, sceneIndex }: PlatformCardProps) {
  return (
    <div
      className="border border-border/40 bg-background/40 p-3 space-y-2"
      data-testid={`platform-card-${sceneIndex}-${platform.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-xs font-mono uppercase tracking-widest text-foreground">
            {platform.label}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">{platform.description}</div>
        </div>
        <CopyButton
          value={text}
          testId={`button-copy-${sceneIndex}-${platform.id}`}
        />
      </div>
      <Textarea
        value={text}
        readOnly
        className="rounded-none font-mono text-xs bg-background/60 min-h-[110px]"
        data-testid={`textarea-${sceneIndex}-${platform.id}`}
      />
    </div>
  );
}

interface SceneCardProps {
  row: ScenePromptEngineRow;
  platforms: PlatformMeta[];
  continuityLockEnabled: boolean;
}

const CHECKLIST_ITEMS: Array<{ key: keyof ScenePromptEngineRow["continuityChecklist"]; label: string }> = [
  { key: "mainCharacter", label: "Character" },
  { key: "outfit", label: "Outfit" },
  { key: "faceStyle", label: "Face" },
  { key: "props", label: "Props" },
  { key: "world", label: "World" },
  { key: "brand", label: "Brand" },
  { key: "logo", label: "Logo" },
  { key: "palette", label: "Palette" },
  { key: "motifs", label: "Motifs" },
  { key: "negative", label: "Negative" },
];

function ContinuityChecklistView({
  checklist,
  lockEnabled,
}: {
  checklist: ScenePromptEngineRow["continuityChecklist"];
  lockEnabled: boolean;
}) {
  return (
    <div
      className="border border-border/40 bg-background/40 p-3 space-y-2"
      data-testid="continuity-checklist"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
          Continuity
        </span>
        {lockEnabled ? (
          <Badge
            variant="default"
            className="rounded-none font-mono text-[10px] uppercase tracking-widest gap-1"
          >
            <ShieldCheck className="w-3 h-3" /> Locked
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="rounded-none font-mono text-[10px] uppercase tracking-widest gap-1 text-muted-foreground"
          >
            <ShieldOff className="w-3 h-3" /> Off
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {CHECKLIST_ITEMS.map(({ key, label }) => {
          const on = checklist[key];
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase"
              data-testid={`checklist-item-${key}`}
              data-on={on ? "true" : "false"}
            >
              {on ? (
                <Check className="w-3 h-3 text-primary" />
              ) : (
                <span className="w-3 h-3 inline-block border border-border/50" />
              )}
              <span className={on ? "text-foreground" : "text-muted-foreground/60"}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SceneCard({ row, platforms, continuityLockEnabled }: SceneCardProps) {
  const grouped = useMemo(() => {
    const g: Record<PlatformKind, PlatformMeta[]> = { video: [], image: [], editing: [] };
    for (const p of platforms) g[p.kind as PlatformKind].push(p);
    return g;
  }, [platforms]);

  const allForScene = useMemo(() => {
    return platforms
      .map((p) => `[${p.label}]\n${row.platforms[p.id] ?? ""}`)
      .join("\n\n");
  }, [platforms, row.platforms]);

  return (
    <Card
      className="rounded-none border-border/50 bg-card/20"
      data-testid={`scene-card-${row.sceneIndex}`}
    >
      <CardHeader className="border-b border-border/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
              <span className="text-primary">Scene {row.sceneIndex + 1}</span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {row.startSec.toFixed(1)}s – {row.endSec.toFixed(1)}s
              </span>
            </CardTitle>
            <div className="text-xs font-mono text-foreground/80">{row.sceneTitle}</div>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase">
                {row.shotType}
              </Badge>
              <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase">
                {row.cameraMovement}
              </Badge>
            </div>
          </div>
          <CopyButton
            value={allForScene}
            label="Copy all platforms"
            testId={`button-copy-all-scene-${row.sceneIndex}`}
            className="border-accent/40 text-accent"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="space-y-4">
          <StructuredBlock block={row.block} />
          <ContinuityChecklistView
            checklist={row.continuityChecklist}
            lockEnabled={continuityLockEnabled}
          />
        </div>
        <div>
          <Tabs defaultValue="video" className="w-full">
            <TabsList
              className="rounded-none bg-background/40 border border-border/40 mb-4"
              data-testid={`tabs-list-scene-${row.sceneIndex}`}
            >
              {(Object.keys(grouped) as PlatformKind[]).map((k) => {
                const Icon = KIND_META[k].icon;
                return (
                  <TabsTrigger
                    key={k}
                    value={k}
                    className="rounded-none uppercase tracking-widest text-xs font-mono"
                    data-testid={`tab-trigger-${row.sceneIndex}-${k}`}
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {KIND_META[k].label}
                    <span className="ml-1 text-muted-foreground">({grouped[k].length})</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {(Object.keys(grouped) as PlatformKind[]).map((k) => (
              <TabsContent key={k} value={k} className="space-y-3 mt-0">
                {grouped[k].map((p) => (
                  <PlatformCard
                    key={p.id}
                    platform={p}
                    text={row.platforms[p.id] ?? ""}
                    sceneIndex={row.sceneIndex}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PromptEnginePage() {
  const [, params] = useRoute("/projects/:id/prompt-engine");
  const projectId = (params?.id ?? "") as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const {
    data: engine,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetPromptEngine(projectId, {
    query: { enabled: !!projectId, queryKey: getGetPromptEngineQueryKey(projectId) },
  });

  const createExport = useCreateExport();

  const projectTitle = project?.title ?? "project";
  const scenes = engine?.scenes ?? [];
  const platforms = engine?.platforms ?? [];
  const continuityLockEnabled = engine?.continuityLockEnabled ?? false;

  const downloadTxt = () => {
    if (scenes.length === 0) return;
    downloadBlob(
      buildTxtExport(scenes, platforms, projectTitle),
      projectFilename(projectTitle, "prompts", "txt"),
      "text/plain;charset=utf-8",
    );
    toast({ title: "TXT downloaded", description: "All platform prompts exported." });
  };

  const downloadJson = () => {
    if (scenes.length === 0) return;
    downloadBlob(
      buildJsonExport(scenes, platforms, projectTitle),
      projectFilename(projectTitle, "prompts", "json"),
      "application/json",
    );
    toast({ title: "JSON downloaded", description: "Structured prompt data exported." });
  };

  const downloadCsv = () => {
    if (scenes.length === 0) return;
    downloadBlob(
      buildCsvShotList(scenes),
      projectFilename(projectTitle, "shot_list", "csv"),
      "text/csv;charset=utf-8",
    );
    toast({ title: "CSV shot list downloaded" });
  };

  const downloadProductionPlan = () => {
    if (!projectId) return;
    createExport.mutate(
      { id: projectId, data: { format: "production_plan" } },
      {
        onSuccess: (created) => {
          downloadBlob(
            created.content,
            projectFilename(projectTitle, "production_plan", "txt"),
            "text/plain;charset=utf-8",
          );
          toast({ title: "Production plan generated" });
        },
        onError: () => {
          toast({
            title: "Export failed",
            description: "Could not generate production plan.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleRefresh = async () => {
    await refetch();
    queryClient.invalidateQueries({ queryKey: getGetPromptEngineQueryKey(projectId) });
    toast({ title: "Prompts refreshed" });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center h-64 border border-dashed border-destructive/40 bg-destructive/5 text-center p-6 max-w-2xl mx-auto mt-12"
        data-testid="prompt-engine-error"
      >
        <Wand2 className="w-12 h-12 text-destructive mb-4 opacity-60" />
        <h3 className="text-lg font-medium mb-2 uppercase tracking-wider text-destructive">
          Failed to load prompts
        </h3>
        <p className="text-sm text-muted-foreground font-mono mb-4">
          {(error as Error | undefined)?.message ?? "The prompt engine endpoint returned an error."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none uppercase tracking-widest text-xs font-mono"
          onClick={() => refetch()}
          data-testid="button-retry-load"
        >
          <RefreshCw className="w-3 h-3 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border/50 bg-card/10 text-center p-6 max-w-2xl mx-auto mt-12">
        <Wand2 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2 uppercase tracking-wider">No scenes yet</h3>
        <p className="text-sm text-muted-foreground font-mono mb-4">
          Generate the storyboard first, then return here for per-platform prompts.
        </p>
        {projectId && (
          <Link
            href={`/projects/${projectId}/storyboard`}
            className="text-xs font-mono uppercase tracking-widest text-accent hover:text-primary"
            data-testid="link-go-storyboard"
          >
            → Go to Storyboard
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto" data-testid="prompt-engine-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-primary" /> Prompt Engine
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
            {scenes.length} scenes × {platforms.length} platforms
          </p>
          <div className="mt-3">
            {continuityLockEnabled ? (
              <Link
                href={`/projects/${projectId}/continuity`}
                className="inline-flex items-center gap-2 px-3 py-1 border border-primary/40 bg-primary/10 text-primary uppercase tracking-widest text-[10px] font-mono hover:bg-primary/20"
                data-testid="badge-prompt-continuity-locked"
              >
                <ShieldCheck className="w-3 h-3" /> Continuity LOCKED — applied to every prompt
              </Link>
            ) : (
              <Link
                href={`/projects/${projectId}/continuity`}
                className="inline-flex items-center gap-2 px-3 py-1 border border-border/50 bg-background/40 text-muted-foreground uppercase tracking-widest text-[10px] font-mono hover:text-foreground"
                data-testid="badge-prompt-continuity-off"
              >
                <ShieldOff className="w-3 h-3" /> Continuity OFF — configure
              </Link>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none uppercase tracking-widest text-xs font-mono"
          onClick={handleRefresh}
          disabled={isFetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`w-3 h-3 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="rounded-none uppercase tracking-widest text-xs font-mono justify-start"
          onClick={downloadTxt}
          data-testid="button-export-txt"
        >
          <FileText className="w-4 h-4 mr-2" /> Export TXT
        </Button>
        <Button
          variant="outline"
          className="rounded-none uppercase tracking-widest text-xs font-mono justify-start"
          onClick={downloadJson}
          data-testid="button-export-json"
        >
          <FileJson className="w-4 h-4 mr-2" /> Export JSON
        </Button>
        <Button
          variant="outline"
          className="rounded-none uppercase tracking-widest text-xs font-mono justify-start"
          onClick={downloadCsv}
          data-testid="button-export-csv"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV shot list
        </Button>
        <Button
          className="rounded-none uppercase tracking-widest text-xs font-mono bg-primary hover:bg-primary/90 text-primary-foreground justify-start"
          onClick={downloadProductionPlan}
          disabled={createExport.isPending}
          data-testid="button-export-production-plan"
        >
          <Clapperboard className="w-4 h-4 mr-2" /> Export production plan
        </Button>
      </div>

      <div className="space-y-6">
        {scenes.map((row) => (
          <SceneCard
            key={row.sceneId}
            row={row}
            platforms={platforms}
            continuityLockEnabled={continuityLockEnabled}
          />
        ))}
      </div>
    </div>
  );
}

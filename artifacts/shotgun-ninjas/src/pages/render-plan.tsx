import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  Hammer,
  ArrowLeft,
  Copy,
  Check,
  ListChecks,
  ImageIcon,
  Film,
  Scissors,
  Music2,
  Sparkles,
  ExternalLink,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useGetProject,
  useGetStoryboard,
} from "@workspace/api-client-react";
import {
  buildRenderPlan,
  renderPlanToText,
  type RenderToolRec,
} from "@/lib/renderPlanner";

const STEP_ICONS = [ImageIcon, Film, Scissors, Music2, Sparkles, Hammer];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function CostBadge({ cost }: { cost: RenderToolRec["cost"] }) {
  const variants: Record<RenderToolRec["cost"], { label: string; cls: string }> = {
    free: { label: "Free", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    freemium: { label: "Free tier", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
    paid: { label: "Paid", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  };
  const v = variants[cost];
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${v.cls}`}>
      {v.label}
    </Badge>
  );
}

function ToolBlock({ tool, label }: { tool: RenderToolRec; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <CostBadge cost={tool.cost} />
      </div>
      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        data-testid={`link-tool-${label.toLowerCase()}`}
      >
        {tool.name}
        <ExternalLink className="w-3 h-3 opacity-60" />
      </a>
      <p className="text-xs text-muted-foreground italic">{tool.reason}</p>
    </div>
  );
}

export default function RenderPlanPage() {
  const [, params] = useRoute("/projects/:id/render-plan");
  const projectId = params?.id as string;
  const { toast } = useToast();

  const { data: project, isLoading: pLoading } = useGetProject(projectId);
  const { data: scenes, isLoading: sLoading } = useGetStoryboard(projectId);

  const plan = useMemo(() => {
    if (!project || !scenes) return null;
    return buildRenderPlan(project, scenes);
  }, [project, scenes]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [copiedScene, setCopiedScene] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Slugify group labels into valid HTML IDs (no spaces, &, or punctuation
  // that would break label[for] association).
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const checklistKeys = useMemo(() => {
    if (!plan) return new Set<string>();
    const set = new Set<string>();
    for (const g of plan.checklist) {
      for (let i = 0; i < g.items.length; i++) set.add(`${slug(g.label)}__${i}`);
    }
    return set;
  }, [plan]);

  const totalChecklistItems = checklistKeys.size;
  // Count only keys belonging to the CURRENT checklist so stale entries from
  // a different project don't inflate the progress badge.
  const checkedCount = useMemo(
    () => Array.from(checklistKeys).filter((k) => checked[k]).length,
    [checklistKeys, checked],
  );

  const toggleItem = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const copyPrompt = async (sceneId: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedScene(sceneId);
      setTimeout(() => setCopiedScene(null), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Could not write to clipboard.", variant: "destructive" });
    }
  };

  const copyFullPlan = async () => {
    if (!project || !plan) return;
    try {
      await navigator.clipboard.writeText(renderPlanToText(project, plan));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
      toast({ title: "Plan copied", description: "Full render plan in your clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not write to clipboard.", variant: "destructive" });
    }
  };

  if (pLoading || sLoading) {
    return (
      <div className="p-8 text-muted-foreground" data-testid="render-plan-loading">
        Loading render plan...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-muted-foreground" data-testid="render-plan-no-project">
        Project not found.{" "}
        <Link href="/dashboard" className="text-primary underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!plan || plan.scenes.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto" data-testid="render-plan-empty">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Project Hub
        </Link>
        <Card className="p-8 text-center space-y-3 border-dashed">
          <Hammer className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">No storyboard yet</h2>
          <p className="text-muted-foreground">
            Generate a storyboard first — the render plan is built from your scenes.
          </p>
          <Link href={`/projects/${projectId}/storyboard`}>
            <Button>Open Storyboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8" data-testid="render-plan-page">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Project Hub
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Local Render Planner
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Step-by-step production walkthrough for{" "}
            <span className="text-foreground font-medium">{project.title}</span>
            {project.artist ? ` · ${project.artist}` : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={copyFullPlan}
            variant="outline"
            data-testid="button-copy-plan"
            className="gap-2"
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy full plan
              </>
            )}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {fmt(plan.totalRuntimeSec)} runtime
            </span>
            <span>·</span>
            <span>{plan.scenes.length} scenes</span>
            {project.bpm ? (
              <>
                <span>·</span>
                <span>{Math.round(project.bpm)} BPM</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* WORKFLOW STEPS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
            Recommended Free / Cheap Workflow
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {plan.workflow.map((w, i) => {
            const Icon = STEP_ICONS[i] ?? Hammer;
            return (
              <Card
                key={w.step}
                className="p-4 space-y-3 border-border/50 bg-card/40"
                data-testid={`workflow-step-${w.step}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{w.step}</span>
                  </div>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">{w.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{w.detail}</p>
                <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                  {w.toolHints.map((hint) => (
                    <Badge
                      key={hint}
                      variant="secondary"
                      className="text-[10px] font-mono"
                    >
                      {hint}
                    </Badge>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* RENDER CHECKLIST */}
      <section className="space-y-4" data-testid="section-checklist">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
              Full Render Checklist
            </h2>
          </div>
          <Badge variant="outline" data-testid="badge-checklist-progress">
            {checkedCount} / {totalChecklistItems} done
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.checklist.map((group) => (
            <Card
              key={group.label}
              className="p-4 border-border/50 bg-card/40 space-y-3"
              data-testid={`checklist-group-${slug(group.label)}`}
            >
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                {group.label}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item, i) => {
                  const key = `${slug(group.label)}__${i}`;
                  const isChecked = checked[key] ?? false;
                  return (
                    <li key={key} className="flex items-start gap-2 group">
                      <Checkbox
                        id={key}
                        checked={isChecked}
                        onCheckedChange={() => toggleItem(key)}
                        className="mt-0.5"
                        data-testid={`checklist-item-${key}`}
                      />
                      <label
                        htmlFor={key}
                        className={`text-xs leading-relaxed cursor-pointer select-none ${
                          isChecked
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {item}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* PER-SCENE PLAN */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
            Per-Scene Production Plan
          </h2>
        </div>
        <div className="space-y-4">
          {plan.scenes.map((s, i) => (
            <Card
              key={s.sceneId}
              className="p-5 border-border/50 bg-card/40 space-y-4"
              data-testid={`scene-card-${s.sceneId}`}
            >
              {/* Scene header */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-accent/15 border border-accent/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-accent">{i + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid={`scene-title-${s.sceneId}`}>
                      {s.title}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {fmt(s.startSec)} → {fmt(s.endSec)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tool recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-md bg-background/50 border border-border/30">
                <ToolBlock tool={s.imageTool} label="Image" />
                <ToolBlock tool={s.videoTool} label="Video" />
              </div>

              {/* Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Prompt to paste
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyPrompt(s.sceneId, s.prompt)}
                    className="h-7 text-xs gap-1.5"
                    data-testid={`button-copy-prompt-${s.sceneId}`}
                  >
                    {copiedScene === s.sceneId ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <pre
                  className="text-xs leading-relaxed text-foreground bg-background/70 border border-border/40 rounded p-3 whitespace-pre-wrap font-mono"
                  data-testid={`scene-prompt-${s.sceneId}`}
                >
                  {s.prompt}
                </pre>
              </div>

              {/* Notes grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 p-3 rounded bg-background/50 border border-border/30">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Clock className="w-3 h-3" /> Clip duration
                  </div>
                  <div className="font-mono font-semibold text-foreground">
                    {s.clipDurationSec}s
                  </div>
                  <p className="text-muted-foreground">{s.clipDurationNote}</p>
                </div>
                <div className="space-y-1 p-3 rounded bg-background/50 border border-border/30">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <ArrowRight className="w-3 h-3" /> Transition into next
                  </div>
                  <p className="text-foreground leading-relaxed">{s.transitionToNext}</p>
                </div>
                <div className="space-y-1 p-3 rounded bg-background/50 border border-border/30">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Scissors className="w-3 h-3" /> Editing note
                  </div>
                  <p className="text-foreground leading-relaxed">{s.editingNote}</p>
                </div>
                <div className="space-y-1 p-3 rounded bg-background/50 border border-border/30">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Music2 className="w-3 h-3" /> Audio sync
                  </div>
                  <p className="text-foreground leading-relaxed">{s.audioSyncNote}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

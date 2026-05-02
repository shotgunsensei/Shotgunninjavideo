import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Check,
  Loader2,
  AlertTriangle,
  Music2,
  Heart,
  Eye,
  Film,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export type DeepStageId = "song" | "emotion" | "visual" | "story" | "preview";
export type DeepStageStatus = "pending" | "running" | "done" | "error";

export interface DeepStageState {
  id: DeepStageId;
  title: string;
  subtitle: string;
  status: DeepStageStatus;
  pct: number;
  log: string[];
}

export const initialDeepStages: DeepStageState[] = [
  {
    id: "song",
    title: "Song analysis in progress",
    subtitle: "Decoding waveform · BPM · beats · key",
    status: "pending",
    pct: 0,
    log: [],
  },
  {
    id: "emotion",
    title: "Understanding emotions",
    subtitle: "Sectioning structure · charting valence and arousal",
    status: "pending",
    pct: 0,
    log: [],
  },
  {
    id: "visual",
    title: "Conceiving visual ideas",
    subtitle: "Mapping palette, lensing & motion to acoustic profile",
    status: "pending",
    pct: 0,
    log: [],
  },
  {
    id: "story",
    title: "Storyline design",
    subtitle: "Pacing scene blocks against the emotional arc",
    status: "pending",
    pct: 0,
    log: [],
  },
  {
    id: "preview",
    title: "Content preview",
    subtitle: "Audio DNA · emotional arc · visual direction · scene plan",
    status: "pending",
    pct: 0,
    log: [],
  },
];

const STAGE_ICON: Record<DeepStageId, LucideIcon> = {
  song: Music2,
  emotion: Heart,
  visual: Eye,
  story: Film,
  preview: Sparkles,
};

interface DeepThinkingFlowProps {
  stages: DeepStageState[];
  errorMessage?: string | null;
  /** Rendered inside the "preview" stage when it is complete and expanded */
  previewContent?: ReactNode;
  /** Force a stage open by id; otherwise defaults to running stage, then user-toggled */
  defaultOpenId?: DeepStageId | null;
}

export function DeepThinkingFlow({
  stages,
  errorMessage,
  previewContent,
  defaultOpenId = null,
}: DeepThinkingFlowProps) {
  const [userToggled, setUserToggled] = useState<DeepStageId | null>(defaultOpenId);
  const baseId = useId();
  const runningId = stages.find((s) => s.status === "running")?.id ?? null;
  const allPending = stages.every((s) => s.status === "pending");
  const allDone = stages.every((s) => s.status === "done");
  const previewDone = stages.find((s) => s.id === "preview")?.status === "done";

  // Reset user toggle whenever a fresh run begins (all stages back to pending),
  // so the auto-open "follow active stage" behavior is restored.
  const wasAllPending = useRef(allPending);
  useEffect(() => {
    if (allPending && !wasAllPending.current) {
      setUserToggled(null);
    }
    wasAllPending.current = allPending;
  }, [allPending]);

  const effectiveOpen =
    userToggled ?? (allDone && previewDone ? "preview" : runningId);

  return (
    <div className="space-y-px">
      {stages.map((stage, idx) => {
        const Icon = STAGE_ICON[stage.id];
        const isOpen = effectiveOpen === stage.id;
        const canOpen =
          stage.status === "running" || stage.status === "done" || stage.status === "error";
        const panelId = `${baseId}-panel-${stage.id}`;
        const buttonId = `${baseId}-button-${stage.id}`;
        return (
          <div
            key={stage.id}
            className={cn(
              "border bg-card/20 backdrop-blur transition-colors",
              stage.status === "pending" && "border-border/30",
              stage.status === "running" &&
                "border-primary/60 bg-primary/5 shadow-[0_0_30px_-12px_rgba(219,39,119,0.45)]",
              stage.status === "done" && "border-emerald-700/30",
              stage.status === "error" && "border-yellow-600/40",
            )}
          >
            <button
              type="button"
              id={buttonId}
              disabled={!canOpen}
              aria-expanded={canOpen ? isOpen : undefined}
              aria-controls={canOpen ? panelId : undefined}
              onClick={() => setUserToggled(isOpen ? null : stage.id)}
              className={cn(
                "w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left",
                !canOpen && "cursor-not-allowed",
              )}
            >
              <StageStatusIcon status={stage.status} Icon={Icon} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    className={cn(
                      "uppercase tracking-widest font-bold text-sm sm:text-base",
                      stage.status === "pending" && "text-muted-foreground/60",
                      stage.status === "running" && "text-primary",
                      stage.status === "done" && "text-foreground",
                      stage.status === "error" && "text-yellow-500",
                    )}
                  >
                    <span className="text-muted-foreground/60 mr-2">{(idx + 1).toString().padStart(2, "0")}</span>
                    {stage.title}
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline uppercase tracking-widest">
                    {statusLabel(stage)}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs font-mono text-muted-foreground mt-1 line-clamp-2 sm:truncate",
                    stage.status === "pending" && "text-muted-foreground/40",
                  )}
                >
                  {stage.subtitle}
                </p>
                {stage.status === "running" && (
                  <Progress
                    value={stage.pct}
                    aria-label={`${stage.title} progress`}
                    className="h-0.5 rounded-none mt-3 bg-background [&>div]:bg-primary [&>div]:transition-all"
                  />
                )}
              </div>
              {canOpen && (
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="border-t border-border/40 px-4 sm:px-5 py-4 sm:py-5 space-y-3 bg-black/40"
              >
                {stage.id === "preview" && stage.status === "done" && previewContent ? (
                  previewContent
                ) : (
                  <StageLog stage={stage} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {errorMessage && (
        <div className="border border-yellow-600/40 bg-yellow-950/20 p-3 mt-2 flex gap-2 text-xs font-mono text-yellow-500/90">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

function StageLog({ stage }: { stage: DeepStageState }) {
  if (stage.log.length === 0) {
    return (
      <p className="text-xs font-mono text-muted-foreground/60">
        {stage.status === "pending" ? "Waiting for upstream stage…" : "No output."}
      </p>
    );
  }
  return (
    <ul
      className="space-y-1.5 text-xs font-mono text-muted-foreground"
      aria-live={stage.status === "running" ? "polite" : "off"}
      aria-atomic="false"
    >
      {stage.log.map((line, i) => {
        const isLast = i === stage.log.length - 1;
        const live = isLast && stage.status === "running";
        return (
          <li
            key={i}
            className={cn("flex gap-2", live && "text-primary", stage.status === "done" && "text-muted-foreground/80")}
          >
            <span className="text-muted-foreground/40 select-none">›</span>
            <span className="flex-1">
              {line}
              {live && (
                <span className="ml-1 inline-block w-1.5 h-3 bg-primary animate-pulse align-middle" />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StageStatusIcon({ status, Icon }: { status: DeepStageStatus; Icon: LucideIcon }) {
  const base = "w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center border";
  if (status === "pending") {
    return (
      <div className={cn(base, "border-border/40 text-muted-foreground/40")}>
        <Icon className="w-4 h-4" />
      </div>
    );
  }
  if (status === "running") {
    return (
      <div
        className={cn(
          base,
          "border-primary/60 text-primary bg-primary/10 shadow-[0_0_20px_-4px_rgba(219,39,119,0.7)]",
        )}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  if (status === "done") {
    return (
      <div className={cn(base, "border-emerald-700/40 text-emerald-500 bg-emerald-950/30")}>
        <Check className="w-5 h-5" />
      </div>
    );
  }
  return (
    <div className={cn(base, "border-yellow-600/40 text-yellow-500 bg-yellow-950/30")}>
      <AlertTriangle className="w-4 h-4" />
    </div>
  );
}

function statusLabel(stage: DeepStageState): string {
  if (stage.status === "pending") return "queued";
  if (stage.status === "running") return `${stage.pct}%`;
  if (stage.status === "done") return "complete";
  return "error";
}

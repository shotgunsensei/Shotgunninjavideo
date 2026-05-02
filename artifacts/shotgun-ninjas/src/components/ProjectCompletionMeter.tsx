import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompletionStep {
  id: string;
  label: string;
  done: boolean;
}

interface ProjectCompletionMeterProps {
  steps: CompletionStep[];
  className?: string;
  /** Optional sub-label, e.g. "Production Pipeline" */
  label?: string;
}

export function ProjectCompletionMeter({
  steps,
  className,
  label = "Pipeline Progress",
}: ProjectCompletionMeterProps) {
  const total = steps.length || 1;
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  return (
    <div
      className={cn(
        "relative surface-card border border-border/50 p-5 sm:p-6 overflow-hidden",
        className,
      )}
      data-testid="project-completion-meter"
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_100%_0%,hsl(320_100%_50%/0.08),transparent_55%)]" />

      <div className="relative flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            {label}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-bold tracking-tighter font-mono">
              {pct}
              <span className="text-sm text-muted-foreground">%</span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {done} / {total} stages
            </span>
          </div>
        </div>
        {allDone ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] font-mono uppercase tracking-widest"
            data-testid="completion-meter-status"
          >
            <CheckCircle2 className="w-3 h-3" /> Project Complete
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-widest"
            data-testid="completion-meter-status"
          >
            <Loader2 className="w-3 h-3 animate-spin" /> In Progress
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 bg-background border border-border/40 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute inset-y-0 left-0",
            allDone
              ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300"
              : "bg-gradient-to-r from-primary via-accent to-primary",
          )}
        />
        {!allDone && (
          <div className="absolute inset-0 animate-shimmer pointer-events-none" />
        )}
      </div>

      {/* Step pills */}
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {steps.map((s) => (
          <span
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 border text-[10px] font-mono uppercase tracking-widest transition-colors",
              s.done
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/40 bg-background/60 text-muted-foreground",
            )}
            data-testid={`completion-step-${s.id}`}
          >
            {s.done ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

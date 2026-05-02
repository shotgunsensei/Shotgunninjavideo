import { Link } from "wouter";
import { Crown, Sparkles, Building2, ShieldOff } from "lucide-react";
import { useBilling } from "@/hooks/use-billing";
import { formatPrice, type PlanId } from "@workspace/billing";
import { cn } from "@/lib/utils";

const PLAN_ICONS: Record<PlanId, typeof Crown> = {
  free: ShieldOff,
  creator: Sparkles,
  studio: Crown,
  agency: Building2,
};

const PLAN_TONE: Record<PlanId, string> = {
  free: "border-border/60 text-muted-foreground bg-card/40",
  creator: "border-primary/40 text-primary bg-primary/5",
  studio: "border-accent/40 text-accent bg-accent/5",
  agency: "border-yellow-500/40 text-yellow-300 bg-yellow-500/5",
};

interface PlanBadgeProps {
  variant?: "compact" | "full";
  className?: string;
}

/** Small pill that shows the current plan and links to /pricing.
 *  Used in the sidebar footer, dashboard header, etc. */
export function PlanBadge({ variant = "full", className }: PlanBadgeProps) {
  const { plan, planMeta, projectCount, projectLimit, isLoading } = useBilling();
  if (isLoading) return null;
  const Icon = PLAN_ICONS[plan];

  if (variant === "compact") {
    return (
      <Link
        href="/pricing"
        data-testid="plan-badge-compact"
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 border text-[10px] font-mono uppercase tracking-widest hover:opacity-90 transition-opacity",
          PLAN_TONE[plan],
          className,
        )}
      >
        <Icon className="w-3 h-3" />
        {planMeta.name}
      </Link>
    );
  }

  return (
    <Link
      href="/pricing"
      data-testid="plan-badge"
      className={cn(
        "block border p-3 hover:opacity-90 transition-opacity rounded-none",
        PLAN_TONE[plan],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">
            {planMeta.name}
          </span>
        </div>
        <span className="text-[10px] font-mono opacity-70">
          {formatPrice(planMeta)}
        </span>
      </div>
      <div className="mt-2 text-[10px] font-mono uppercase tracking-wider opacity-80">
        {projectLimit === null
          ? `${projectCount} project${projectCount === 1 ? "" : "s"} · unlimited`
          : `${projectCount} / ${projectLimit} projects`}
      </div>
      {plan !== "agency" && (
        <div className="mt-2 text-[10px] font-mono uppercase tracking-widest underline-offset-2 hover:underline">
          {plan === "free" ? "Upgrade →" : "Manage / Upgrade →"}
        </div>
      )}
    </Link>
  );
}

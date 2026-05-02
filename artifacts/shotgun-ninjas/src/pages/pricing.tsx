import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles, Building2, ShieldOff, Loader2 } from "lucide-react";
import {
  PLAN_CATALOG,
  PLAN_IDS,
  PLAN_ORDER,
  formatPrice,
  type PlanId,
} from "@workspace/billing";
import {
  useUpgradeBillingPlan,
  useCancelBillingPlan,
  getGetBillingStateQueryKey,
  getListProjectsQueryKey,
  getGetStatsOverviewQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useBilling } from "@/hooks/use-billing";
import { cn } from "@/lib/utils";

const PLAN_ICONS: Record<PlanId, typeof Crown> = {
  free: ShieldOff,
  creator: Sparkles,
  studio: Crown,
  agency: Building2,
};

const RECOMMENDED_PLAN: PlanId = "studio";

const PLAN_ACCENT: Record<
  PlanId,
  { ring: string; text: string; chip: string; cta: string; subtle: string; glow: string }
> = {
  free: {
    ring: "border-border/60",
    text: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    cta: "bg-muted text-foreground hover:bg-muted/80",
    subtle: "bg-background/40",
    glow: "",
  },
  creator: {
    ring: "border-primary/60",
    text: "text-primary",
    chip: "bg-primary/15 text-primary",
    cta: "bg-gradient-crimson text-primary-foreground hover:opacity-90 border border-primary/60",
    subtle: "bg-primary/5",
    glow: "shadow-glow-primary",
  },
  studio: {
    ring: "border-accent/60",
    text: "text-accent",
    chip: "bg-accent/15 text-accent",
    cta: "bg-accent text-accent-foreground hover:bg-accent/90 border border-accent",
    subtle: "bg-accent/5",
    glow: "shadow-glow-accent",
  },
  agency: {
    ring: "border-yellow-400/60",
    text: "text-yellow-300",
    chip: "bg-yellow-500/15 text-yellow-300",
    cta: "bg-yellow-500 text-black hover:bg-yellow-400 border border-yellow-400",
    subtle: "bg-yellow-500/5",
    glow: "shadow-[0_8px_28px_-8px_rgba(234,179,8,0.5)]",
  },
};

export default function PricingPage() {
  const { plan: currentPlan, isLoading } = useBilling();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const upgrade = useUpgradeBillingPlan();
  const cancel = useCancelBillingPlan();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetBillingStateQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
  };

  const handleSelect = (target: PlanId) => {
    if (target === currentPlan) return;
    if (target === "free") {
      cancel.mutate(undefined, {
        onSuccess: () => {
          toast({
            title: "Reverted to Free",
            description: "Demo billing reset. Free plan limits now apply.",
          });
          refresh();
        },
        onError: (err: unknown) =>
          toast({
            title: "Could not change plan",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      });
      return;
    }
    upgrade.mutate(
      { data: { plan: target } },
      {
        onSuccess: () => {
          toast({
            title: `You're on ${PLAN_CATALOG[target].name}`,
            description:
              "Demo upgrade applied — Stripe is not connected yet, no charge made.",
          });
          refresh();
        },
        onError: (err: unknown) =>
          toast({
            title: "Could not change plan",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      },
    );
  };

  const isPending = upgrade.isPending || cancel.isPending;

  return (
    <div className="space-y-10 max-w-7xl mx-auto" data-testid="pricing-page">
      {/* Hero */}
      <div className="relative text-center space-y-4 py-6">
        <div className="absolute inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_at_center,hsl(320_100%_50%/0.12),transparent_60%)]" />
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/5 text-primary text-[10px] font-mono uppercase tracking-[0.25em]">
          <Sparkles className="w-3 h-3" /> Pricing
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.95]">
          Pick your <br className="sm:hidden" />
          <span className="text-gradient-crimson">render power</span>
        </h1>
        <p className="text-muted-foreground font-mono text-xs sm:text-sm uppercase tracking-widest max-w-xl mx-auto">
          From a one-time demo to an agency pipeline — every plan unlocks more of the engine
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-yellow-500/40 bg-yellow-500/5 text-yellow-300 text-[10px] font-mono uppercase tracking-widest">
          Demo billing — Stripe not connected · upgrades are mock state only
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
          {PLAN_IDS.map((id) => {
            const plan = PLAN_CATALOG[id];
            const Icon = PLAN_ICONS[id];
            const accent = PLAN_ACCENT[id];
            const isCurrent = id === currentPlan;
            const isRecommended = id === RECOMMENDED_PLAN;
            const isDowngrade = PLAN_ORDER[id] < PLAN_ORDER[currentPlan];
            const ctaLabel = isCurrent
              ? "Current plan"
              : isDowngrade
                ? id === "free"
                  ? "Cancel to Free"
                  : `Downgrade to ${plan.name}`
                : plan.ctaLabel;

            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: PLAN_ORDER[id] * 0.06 }}
                className={cn("relative", isRecommended && "xl:-translate-y-2")}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-crimson text-primary-foreground text-[10px] font-bold uppercase tracking-[0.25em] shadow-glow-primary">
                      <Sparkles className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                <Card
                  data-testid={`plan-card-${id}`}
                  className={cn(
                    "rounded-none h-full flex flex-col border-2 transition-all surface-card relative overflow-hidden",
                    accent.ring,
                    accent.subtle,
                    isCurrent && "ring-2 ring-offset-2 ring-offset-background ring-primary/40",
                    isRecommended && "shadow-glow-accent",
                  )}
                >
                  {isRecommended && (
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,hsl(340_100%_50%/0.10),transparent_60%)]" />
                  )}
                  <CardHeader className="pb-2 relative">
                    <div className="flex items-center justify-between">
                      <div className={cn("inline-flex items-center gap-2", accent.text)}>
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-8 h-8 border",
                            accent.ring,
                            accent.subtle,
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <CardTitle className="text-xl uppercase tracking-widest">
                          {plan.name}
                        </CardTitle>
                      </div>
                      {isCurrent && (
                        <Badge
                          className={cn(
                            "rounded-none uppercase text-[10px] font-mono",
                            accent.chip,
                          )}
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="font-mono text-xs leading-relaxed min-h-[2.5rem] mt-1">
                      {plan.tagline}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-5 relative">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold font-mono tracking-tighter">
                        {plan.priceInterval === "free"
                          ? "$0"
                          : `$${(plan.priceCents / 100).toFixed(plan.priceCents % 100 === 0 ? 0 : 2)}`}
                      </span>
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        {plan.priceInterval === "free"
                          ? "forever"
                          : `/${plan.priceInterval === "month" ? "mo" : "yr"}`}
                      </span>
                    </div>

                    <ul className="space-y-2 flex-1">
                      {plan.highlights.map((h) => (
                        <li
                          key={h}
                          className="flex items-start gap-2 text-sm leading-snug"
                        >
                          <Check
                            className={cn("w-4 h-4 mt-0.5 shrink-0", accent.text)}
                          />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => handleSelect(id)}
                      disabled={isCurrent || isPending}
                      className={cn(
                        "w-full rounded-none uppercase tracking-widest text-xs font-bold",
                        !isCurrent && accent.cta,
                        !isCurrent && isRecommended && accent.glow,
                      )}
                      variant={isCurrent ? "outline" : "default"}
                      data-testid={`button-select-plan-${id}`}
                    >
                      {isPending && !isCurrent ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Working…
                        </>
                      ) : (
                        ctaLabel
                      )}
                    </Button>
                    {!isCurrent && plan.priceInterval !== "free" && (
                      <p className="text-[10px] font-mono uppercase tracking-widest text-center text-muted-foreground">
                        Mock — no payment taken
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="border border-border/40 surface-card p-6 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <span className="w-1 h-3 bg-accent" />
          Stripe wiring (future)
        </h3>
        <p className="text-xs font-mono leading-relaxed text-muted-foreground">
          The plan catalog, feature gates, and upgrade endpoints already exist.
          When Stripe is connected, swap{" "}
          <code className="px-1 py-0.5 bg-background border border-border/50">
            MockBillingProvider
          </code>{" "}
          for{" "}
          <code className="px-1 py-0.5 bg-background border border-border/50">
            StripeBillingProvider
          </code>{" "}
          in <code>artifacts/api-server/src/lib/billingProvider.ts</code> and add a{" "}
          <code>stripePriceId</code> to each plan in{" "}
          <code>lib/billing/src/index.ts</code>. No route or UI changes needed.
        </p>
      </div>
    </div>
  );
}

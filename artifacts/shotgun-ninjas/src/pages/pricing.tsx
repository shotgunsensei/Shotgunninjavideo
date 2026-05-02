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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const PLAN_ACCENT: Record<
  PlanId,
  { ring: string; text: string; chip: string; cta: string; subtle: string }
> = {
  free: {
    ring: "border-border/60",
    text: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    cta: "bg-muted text-foreground hover:bg-muted/80",
    subtle: "bg-background/40",
  },
  creator: {
    ring: "border-primary/60",
    text: "text-primary",
    chip: "bg-primary/15 text-primary",
    cta: "bg-primary text-primary-foreground hover:bg-primary/90",
    subtle: "bg-primary/5",
  },
  studio: {
    ring: "border-accent/60",
    text: "text-accent",
    chip: "bg-accent/15 text-accent",
    cta: "bg-accent text-accent-foreground hover:bg-accent/90",
    subtle: "bg-accent/5",
  },
  agency: {
    ring: "border-yellow-400/60",
    text: "text-yellow-300",
    chip: "bg-yellow-500/15 text-yellow-300",
    cta: "bg-yellow-500 text-black hover:bg-yellow-400",
    subtle: "bg-yellow-500/5",
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
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase">
          Pick your <span className="text-primary">render power</span>
        </h1>
        <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
          From a one-time demo to an agency pipeline
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLAN_IDS.map((id) => {
            const plan = PLAN_CATALOG[id];
            const Icon = PLAN_ICONS[id];
            const accent = PLAN_ACCENT[id];
            const isCurrent = id === currentPlan;
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
                transition={{ duration: 0.3, delay: PLAN_ORDER[id] * 0.05 }}
              >
                <Card
                  data-testid={`plan-card-${id}`}
                  className={cn(
                    "rounded-none h-full flex flex-col border-2 transition-colors",
                    accent.ring,
                    accent.subtle,
                    isCurrent && "ring-2 ring-offset-2 ring-offset-background ring-primary/40",
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={cn("inline-flex items-center gap-2", accent.text)}>
                        <Icon className="w-5 h-5" />
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
                    <CardDescription className="font-mono text-xs leading-relaxed min-h-[2.5rem]">
                      {plan.tagline}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-5">
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

      <div className="border border-border/40 bg-card/30 p-6 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-widest">
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

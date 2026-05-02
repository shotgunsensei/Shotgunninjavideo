import { useGetBillingState, getGetBillingStateQueryKey } from "@workspace/api-client-react";
import {
  hasFeature as hasFeatureCore,
  isExportFormatAllowed as isExportFormatAllowedCore,
  isWithinProjectLimit as isWithinProjectLimitCore,
  PLAN_CATALOG,
  requiredPlanForExportFormat,
  requiredPlanForFeature,
  type Feature,
  type PlanId,
  type PlanCatalogItem,
} from "@workspace/billing";

/** Single source of truth on the client for "what plan am I on, what can I do?" */
export function useBilling() {
  const query = useGetBillingState({
    query: { queryKey: getGetBillingStateQueryKey() },
  });

  const plan = (query.data?.plan as PlanId | undefined) ?? "free";
  const planMeta: PlanCatalogItem = PLAN_CATALOG[plan];
  const projectCount = query.data?.usage?.projectCount ?? 0;
  const projectLimit = planMeta.projectLimit;

  return {
    ...query,
    plan,
    planMeta,
    projectCount,
    projectLimit,
    /** Plan-tier feature check (live data + catalog). */
    hasFeature: (feature: Feature): boolean => hasFeatureCore(plan, feature),
    /** Per-export-format gate. */
    isExportAllowed: (format: string): boolean => isExportFormatAllowedCore(plan, format),
    /** Project-limit gate ("can I create another project?"). */
    canCreateProject: (): boolean => isWithinProjectLimitCore(plan, projectCount),
    /** What plan name unlocks this feature? */
    requiredPlanForFeature,
    requiredPlanForExportFormat,
  };
}

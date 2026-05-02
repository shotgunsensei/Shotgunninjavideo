import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Loader2,
  Download,
  FileJson,
  FileText,
  Clapperboard,
  CheckCircle2,
  FileSpreadsheet,
  Mic2,
  Wand2,
  Smartphone,
  Film,
  ScrollText,
  Megaphone,
  Lock,
} from "lucide-react";
import { PLAN_CATALOG } from "@workspace/billing";
import { useBilling } from "@/hooks/use-billing";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StickyMobileBar } from "@/components/StickyMobileBar";
import {
  useListExports,
  useCreateExport,
  getListExportsQueryKey,
  useGetProject,
  getGetProjectQueryKey,
  type ExportFormat,
  type ExportRecord,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface FormatCard {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "accent" | "white" | "muted";
  group: "production" | "data" | "edit" | "social";
}

const FORMAT_CARDS: FormatCard[] = [
  { format: "production_plan", label: "Full Production Plan", description: "Call sheet, wardrobe, shot list, continuity & editing notes (.txt)", icon: Clapperboard, accent: "primary", group: "production" },
  { format: "treatment", label: "Client Treatment", description: "Polished, client-facing creative treatment document (.md)", icon: ScrollText, accent: "primary", group: "production" },
  { format: "ai_prompt_pack", label: "AI Video Prompt Pack", description: "Per-scene prompts formatted for every supported AI model (.txt)", icon: Wand2, accent: "primary", group: "production" },
  { format: "json", label: "JSON Project File", description: "Machine-readable full project state for backups & APIs (.json)", icon: FileJson, accent: "accent", group: "data" },
  { format: "csv_shot_list", label: "CSV Shot List", description: "Spreadsheet-ready shot list for Excel, Sheets, Numbers (.csv)", icon: FileSpreadsheet, accent: "white", group: "data" },
  { format: "lyrics_timing", label: "Lyrics Timing Sheet", description: "Timecoded lyric lines mapped to scenes (.txt)", icon: Mic2, accent: "accent", group: "data" },
  { format: "capcut_guide", label: "CapCut Edit Guide", description: "Mobile editing recipe with beat markers & cut tempo (.md)", icon: Smartphone, accent: "white", group: "edit" },
  { format: "davinci_guide", label: "DaVinci Resolve Guide", description: "Pro NLE recipe — color, audio markers, delivery presets (.md)", icon: Film, accent: "white", group: "edit" },
  { format: "social_captions", label: "Social Caption Pack", description: "Captions for YouTube, TikTok, Reels, Feed, X, Facebook (.txt)", icon: Megaphone, accent: "accent", group: "social" },
];

const GROUPS: { id: FormatCard["group"]; label: string; accent: string }[] = [
  { id: "production", label: "Production", accent: "text-primary" },
  { id: "data", label: "Data & Backup", accent: "text-accent" },
  { id: "edit", label: "Editing Recipes", accent: "text-fuchsia-300" },
  { id: "social", label: "Social", accent: "text-yellow-300" },
];

const ACCENT_CLASSES: Record<FormatCard["accent"], string> = {
  primary: "border-primary/30 hover:border-primary/70 text-primary",
  accent: "border-accent/30 hover:border-accent/70 text-accent",
  white: "border-border/50 hover:border-foreground/40 text-foreground",
  muted: "border-border/50 hover:border-border text-muted-foreground",
};

const ASPECT_RATIOS = [
  { code: "16:9", use: "YouTube long-form" },
  { code: "9:16", use: "TikTok / Reels / Shorts" },
  { code: "1:1", use: "Instagram Square" },
  { code: "4:5", use: "Facebook / Instagram Feed" },
];

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

function safeFilename(input: string): string {
  return (
    input
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase() || "project"
  );
}

export default function ExportPage() {
  const [, params] = useRoute("/projects/:id/export");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const billing = useBilling();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const { data: exports, isLoading } = useListExports(projectId, {
    query: { enabled: !!projectId, queryKey: getListExportsQueryKey(projectId) },
  });

  const createExport = useCreateExport();

  const handleGenerate = (formatCard: FormatCard) => {
    setPending(formatCard.format);
    createExport.mutate(
      { id: projectId, data: { format: formatCard.format } },
      {
        onSuccess: (record: ExportRecord) => {
          const baseName = safeFilename(project?.title || "project");
          const filename = `${baseName}_${formatCard.format}.${record.fileExtension}`;
          downloadBlob(record.content, filename, record.mimeType);
          toast({
            title: "Export ready",
            description: `Downloaded ${filename}`,
          });
          queryClient.invalidateQueries({
            queryKey: getListExportsQueryKey(projectId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetProjectQueryKey(projectId),
          });
        },
        onError: (err: unknown) => {
          toast({
            title: "Export failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
        onSettled: () => setPending(null),
      },
    );
  };

  const handleRedownload = (record: ExportRecord) => {
    const baseName = safeFilename(project?.title || "project");
    const filename = `${baseName}_${record.format}.${record.fileExtension}`;
    downloadBlob(record.content, filename, record.mimeType);
  };

  const cardLabelFor = (fmt: string) =>
    FORMAT_CARDS.find((c) => c.format === fmt)?.label ?? fmt.replace(/_/g, " ");

  const productionCard = FORMAT_CARDS.find((c) => c.format === "production_plan")!;
  const productionAllowed = billing.isExportAllowed(productionCard.format);

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-24 md:pb-0">
      <PageHeader
        eyebrow="Deliverables"
        icon={Download}
        title="Export Center"
        subtitle="Nine professional deliverables — one click each"
      />

      {/* Aspect ratios */}
      <div className="surface-card border border-border/50 p-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3 font-mono">
          Suggested Aspect Ratios — included in every export
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ASPECT_RATIOS.map((a) => (
            <div
              key={a.code}
              className="flex items-center gap-3 px-3 py-2 border border-border/40 bg-background/40 hover:border-primary/40 transition-colors"
            >
              <span className="font-mono text-sm font-bold text-primary tracking-tighter">
                {a.code}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                {a.use}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grouped format grid */}
      {GROUPS.map((group) => {
        const cardsInGroup = FORMAT_CARDS.filter((c) => c.group === group.id);
        if (cardsInGroup.length === 0) return null;

        return (
          <section key={group.id} className="space-y-3">
            <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.25em]">
              <span className={cn("w-1 h-4", group.accent.replace("text-", "bg-"))} />
              <span className={group.accent}>{group.label}</span>
              <span className="text-[11px] font-mono text-muted-foreground">
                · {cardsInGroup.length} formats
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cardsInGroup.map((card, i) => {
                const Icon = card.icon;
                const isPending = pending === card.format && createExport.isPending;
                const allowed = billing.isExportAllowed(card.format);
                const requiredPlan = allowed
                  ? null
                  : billing.requiredPlanForExportFormat(card.format);
                return (
                  <motion.div
                    key={card.format}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                  >
                    <Card
                      data-testid={`export-card-${card.format}`}
                      className={cn(
                        "rounded-none transition-colors group relative h-full surface-card hover-lift overflow-hidden",
                        allowed
                          ? ACCENT_CLASSES[card.accent]
                          : "border-border/40 opacity-90 hover:opacity-100",
                      )}
                    >
                      {!allowed && (
                        <div className="absolute inset-0 pointer-events-none bg-black/40 backdrop-blur-[1px]" />
                      )}
                      {!allowed && (
                        <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[10px] font-mono uppercase tracking-widest z-10">
                          <Lock className="w-3 h-3" />
                          {requiredPlan ? PLAN_CATALOG[requiredPlan].name : "Upgrade"}
                        </div>
                      )}
                      <CardHeader className="relative">
                        <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-8 h-8 border shrink-0",
                              allowed
                                ? card.accent === "primary"
                                  ? "bg-primary/10 border-primary/40 text-primary"
                                  : card.accent === "accent"
                                    ? "bg-accent/10 border-accent/40 text-accent"
                                    : "bg-white/5 border-white/15 text-foreground"
                                : "bg-muted/40 border-border/40 text-muted-foreground",
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="truncate">{card.label}</span>
                        </CardTitle>
                        <CardDescription className="text-[11px] font-mono leading-relaxed text-muted-foreground min-h-[3rem] pt-1">
                          {card.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="relative">
                        {allowed ? (
                          <Button
                            className="w-full rounded-none uppercase tracking-widest text-xs font-bold"
                            onClick={() => handleGenerate(card)}
                            disabled={createExport.isPending}
                            data-testid={`button-generate-${card.format}`}
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                Generating…
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3 mr-2" />
                                Generate &amp; Download
                              </>
                            )}
                          </Button>
                        ) : (
                          <Link
                            href="/pricing"
                            data-testid={`button-upgrade-${card.format}`}
                            className="block"
                          >
                            <Button
                              variant="outline"
                              className="w-full rounded-none uppercase tracking-widest text-xs font-bold border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-200"
                            >
                              <Lock className="w-3 h-3 mr-2" />
                              Upgrade to{" "}
                              {requiredPlan
                                ? PLAN_CATALOG[requiredPlan].name
                                : "unlock"}
                            </Button>
                          </Link>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="pt-8 border-t border-border/40">
        <h2 className="text-xl font-bold uppercase tracking-widest mb-6 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 border border-accent/40 bg-accent/10 text-accent">
            <FileText className="w-4 h-4" />
          </span>
          Export History
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-none" />
            ))}
          </div>
        ) : !exports || exports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No exports yet"
            description="Generated files will appear here. You can re-download anything you've previously exported."
            variant="compact"
          />
        ) : (
          <div className="space-y-2">
            {[...exports]
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .map((exp) => (
                <div
                  key={exp.id}
                  data-testid={`history-row-${exp.format}`}
                  className="flex flex-col sm:flex-row gap-4 p-3 border border-border/50 surface-card items-start sm:items-center justify-between hover:border-primary/40 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="font-bold uppercase tracking-wider text-sm flex items-center gap-2 flex-wrap">
                        {cardLabelFor(exp.format)}
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-mono uppercase text-muted-foreground border border-border/50 px-1.5 py-0.5">
                          .{exp.fileExtension}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">
                        {format(new Date(exp.createdAt), "MMM dd, yyyy HH:mm")}{" "}
                        · ID {exp.id.substring(0, 8)}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none uppercase tracking-wider text-xs border-border/50 bg-background/50 hover:bg-primary hover:text-primary-foreground hover:border-primary w-full sm:w-auto"
                    onClick={() => handleRedownload(exp)}
                    data-testid={`button-redownload-${exp.id}`}
                  >
                    <Download className="w-3 h-3 mr-2" /> Download again
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Sticky mobile primary CTA — generate the production plan */}
      {productionAllowed && (
        <StickyMobileBar>
          <Button
            className="w-full rounded-none uppercase tracking-widest text-xs font-bold bg-gradient-crimson border border-primary/60 text-primary-foreground shadow-glow-soft h-11"
            onClick={() => handleGenerate(productionCard)}
            disabled={createExport.isPending}
            data-testid="mobile-generate-production"
          >
            {pending === productionCard.format && createExport.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Generating Production Plan…
              </>
            ) : (
              <>
                <Download className="w-3 h-3 mr-2" /> Generate Full Production Plan
              </>
            )}
          </Button>
        </StickyMobileBar>
      )}
    </div>
  );
}

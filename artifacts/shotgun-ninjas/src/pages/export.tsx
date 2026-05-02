import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import {
  useListExports,
  useCreateExport,
  getListExportsQueryKey,
  useGetProject,
  getGetProjectQueryKey,
  type ExportFormat,
  type ExportRecord,
} from "@workspace/api-client-react";

interface FormatCard {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "accent" | "white" | "muted";
}

const FORMAT_CARDS: FormatCard[] = [
  {
    format: "production_plan",
    label: "Full Production Plan",
    description: "Call sheet, wardrobe, shot list, continuity & editing notes (.txt)",
    icon: Clapperboard,
    accent: "primary",
  },
  {
    format: "json",
    label: "JSON Project File",
    description: "Machine-readable full project state for backups & APIs (.json)",
    icon: FileJson,
    accent: "accent",
  },
  {
    format: "csv_shot_list",
    label: "CSV Shot List",
    description: "Spreadsheet-ready shot list for Excel, Sheets, Numbers (.csv)",
    icon: FileSpreadsheet,
    accent: "white",
  },
  {
    format: "lyrics_timing",
    label: "Lyrics Timing Sheet",
    description: "Timecoded lyric lines mapped to scenes (.txt)",
    icon: Mic2,
    accent: "accent",
  },
  {
    format: "ai_prompt_pack",
    label: "AI Video Prompt Pack",
    description: "Per-scene prompts formatted for every supported AI model (.txt)",
    icon: Wand2,
    accent: "primary",
  },
  {
    format: "capcut_guide",
    label: "CapCut Edit Guide",
    description: "Mobile editing recipe with beat markers & cut tempo (.md)",
    icon: Smartphone,
    accent: "white",
  },
  {
    format: "davinci_guide",
    label: "DaVinci Resolve Guide",
    description: "Pro NLE recipe — color, audio markers, delivery presets (.md)",
    icon: Film,
    accent: "white",
  },
  {
    format: "treatment",
    label: "Client Treatment",
    description: "Polished, client-facing creative treatment document (.md)",
    icon: ScrollText,
    accent: "primary",
  },
  {
    format: "social_captions",
    label: "Social Caption Pack",
    description: "Captions for YouTube, TikTok, Reels, Feed, X, Facebook (.txt)",
    icon: Megaphone,
    accent: "accent",
  },
];

const ACCENT_CLASSES: Record<FormatCard["accent"], string> = {
  primary: "border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary",
  accent: "border-accent/30 bg-accent/5 hover:bg-accent/10 text-accent",
  white: "border-border/50 bg-card/20 hover:bg-card/40 text-white",
  muted: "border-border/50 bg-card/10 hover:bg-card/30 text-muted-foreground",
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
          <Download className="w-8 h-8 text-primary" /> Export Center
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
          Nine professional deliverables — one click each
        </p>
      </div>

      <div className="border border-border/50 bg-card/10 p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Suggested Aspect Ratios (included in every export)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ASPECT_RATIOS.map((a) => (
            <div
              key={a.code}
              className="flex items-center gap-3 px-3 py-2 border border-border/40 bg-background/40"
            >
              <span className="font-mono text-sm font-bold text-primary">
                {a.code}
              </span>
              <span className="text-xs text-muted-foreground">{a.use}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FORMAT_CARDS.map((card) => {
          const Icon = card.icon;
          const isPending = pending === card.format && createExport.isPending;
          const allowed = billing.isExportAllowed(card.format);
          const requiredPlan = allowed
            ? null
            : billing.requiredPlanForExportFormat(card.format);
          return (
            <Card
              key={card.format}
              data-testid={`export-card-${card.format}`}
              className={`rounded-none transition-colors group relative ${
                allowed ? ACCENT_CLASSES[card.accent] : "border-border/40 bg-card/10 opacity-90"
              }`}
            >
              {!allowed && (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[10px] font-mono uppercase tracking-widest">
                  <Lock className="w-3 h-3" />
                  {requiredPlan ? PLAN_CATALOG[requiredPlan].name : "Upgrade"}
                </div>
              )}
              <CardHeader>
                <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{card.label}</span>
                </CardTitle>
                <CardDescription className="text-xs font-mono leading-relaxed text-muted-foreground min-h-[3rem]">
                  {card.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                      Upgrade to {requiredPlan ? PLAN_CATALOG[requiredPlan].name : "unlock"}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="pt-8 border-t border-border/50">
        <h2 className="text-xl font-bold uppercase tracking-widest mb-6">
          Export History
        </h2>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !exports || exports.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground font-mono text-sm bg-card/10 border border-dashed border-border/50">
            No exports generated yet.
          </div>
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
                  className="flex flex-col sm:flex-row gap-4 p-3 border border-border/50 bg-card/20 items-start sm:items-center justify-between hover:bg-card/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-background flex items-center justify-center border border-border">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                        {cardLabelFor(exp.format)}
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          .{exp.fileExtension}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">
                        {format(new Date(exp.createdAt), "MMM dd, yyyy HH:mm")}{" "}
                        // ID: {exp.id.substring(0, 8)}
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
    </div>
  );
}

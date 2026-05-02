import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Megaphone,
  Copy,
  RefreshCw,
  Download,
  FileText,
  FileJson,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useGetProject,
  getGetProjectQueryKey,
  useListMarketingAssets,
  getListMarketingAssetsQueryKey,
  useGenerateMarketingAssets,
  useRegenerateMarketingAsset,
  useGetMarketingAssetCatalog,
  getGetMarketingAssetCatalogQueryKey,
} from "@workspace/api-client-react";

type Kind =
  | "youtube_titles"
  | "youtube_description"
  | "tiktok_caption"
  | "instagram_caption"
  | "facebook_caption"
  | "hashtags"
  | "teaser_15s"
  | "teaser_30s"
  | "trailer_60s"
  | "thumbnail_prompt"
  | "cover_art_prompt"
  | "behind_the_scenes"
  | "release_announcement";

type Group = "platform" | "captions" | "video_plan" | "visual" | "content";

const GROUP_LABEL: Record<Group, string> = {
  platform: "Platform Copy",
  captions: "Social Captions",
  video_plan: "Cut-down Video Plans",
  visual: "Visual Asset Prompts",
  content: "Story Content",
};

const FORMAT_BUTTONS: Array<{
  format: "txt" | "csv" | "json";
  label: string;
  icon: typeof FileText;
}> = [
  { format: "txt", label: "TXT", icon: FileText },
  { format: "csv", label: "CSV", icon: FileSpreadsheet },
  { format: "json", label: "JSON", icon: FileJson },
];

export default function MarketingPage() {
  const [, params] = useRoute("/projects/:id/marketing");
  const projectId = params?.id ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const { data: catalog } = useGetMarketingAssetCatalog({
    query: { queryKey: getGetMarketingAssetCatalogQueryKey() },
  });

  const { data: assets, isLoading } = useListMarketingAssets(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getListMarketingAssetsQueryKey(projectId),
    },
  });

  const generateAll = useGenerateMarketingAssets({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMarketingAssetsQueryKey(projectId) });
        toast({ title: "All assets generated", description: "13 marketing assets are ready." });
      },
      onError: (e: unknown) =>
        toast({
          title: "Generation failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        }),
    },
  });

  const regenerate = useRegenerateMarketingAsset({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMarketingAssetsQueryKey(projectId) });
      },
      onError: (e: unknown) =>
        toast({
          title: "Regenerate failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        }),
    },
  });

  const [copiedKind, setCopiedKind] = useState<Kind | null>(null);
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);

  // Index assets by kind for fast lookup.
  const byKind = useMemo(() => {
    const m = new Map<Kind, { content: string; updatedAt: string | Date }>();
    (assets ?? []).forEach((a) => {
      m.set(a.kind as Kind, {
        content: a.content,
        updatedAt: a.updatedAt as string | Date,
      });
    });
    return m;
  }, [assets]);

  const groupedKinds = useMemo(() => {
    const groups: Record<Group, Array<{ kind: Kind; label: string; description: string }>> = {
      platform: [],
      captions: [],
      video_plan: [],
      visual: [],
      content: [],
    };
    (catalog?.kinds ?? []).forEach((k) => {
      groups[k.group as Group].push({
        kind: k.kind as Kind,
        label: k.label,
        description: k.description,
      });
    });
    return groups;
  }, [catalog]);

  const totalKinds = catalog?.kinds.length ?? 13;
  const generatedCount = assets?.length ?? 0;
  const allGenerated = generatedCount >= totalKinds;

  function handleCopy(kind: Kind, content: string) {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopiedKind(kind);
        setTimeout(() => setCopiedKind((k) => (k === kind ? null : k)), 1500);
      })
      .catch(() =>
        toast({
          title: "Copy failed",
          description: "Clipboard access was denied.",
          variant: "destructive",
        }),
      );
  }

  async function handleRegenerate(kind: Kind) {
    setPendingKind(kind);
    try {
      await regenerate.mutateAsync({ id: projectId, data: { kind } });
    } finally {
      setPendingKind(null);
    }
  }

  function handleExport(format: "txt" | "csv" | "json") {
    if (!allGenerated) {
      toast({
        title: "Nothing to export yet",
        description: "Generate the marketing assets first.",
        variant: "destructive",
      });
      return;
    }
    // Direct browser download — hits the proxied API path.
    window.location.assign(`/api/projects/${projectId}/marketing-assets/export/${format}`);
  }

  if (!projectId) return null;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6" data-testid="marketing-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-3 h-3" />
            Back to project
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-primary" />
            Batch Content Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Turn{" "}
            <span className="font-medium text-foreground">
              {project?.title ?? "this project"}
            </span>{" "}
            into 13 ready-to-post marketing assets in one click.
          </p>
        </div>
        <Badge variant="outline" data-testid="badge-progress">
          {generatedCount} / {totalKinds} generated
        </Badge>
      </div>

      {/* Action bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              generateAll.mutate(
                { id: projectId },
                {
                  onSuccess: () => undefined,
                },
              )
            }
            disabled={generateAll.isPending}
            data-testid="button-generate-all"
            size="lg"
          >
            {generateAll.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating all 13...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {allGenerated ? "Regenerate All" : "Generate All Assets"}
              </>
            )}
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-1">
              Export pack
            </span>
            {FORMAT_BUTTONS.map(({ format, label, icon: Icon }) => (
              <Button
                key={format}
                variant="outline"
                size="sm"
                onClick={() => handleExport(format)}
                disabled={!allGenerated}
                data-testid={`button-export-${format}`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!isLoading && generatedCount === 0 && (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">No marketing assets yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Click <span className="font-medium text-foreground">Generate All Assets</span> to
              produce YouTube copy, TikTok / Instagram / Facebook captions, hashtag bundles,
              15s/30s/60s teaser plans, AI thumbnail + cover art prompts, a behind-the-scenes
              post, and a release announcement — all from this project's metadata.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Asset cards by group */}
      {(["platform", "captions", "video_plan", "visual", "content"] as Group[]).map((group) => {
        const items = groupedKinds[group];
        if (items.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {GROUP_LABEL[group]}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) => {
                const asset = byKind.get(item.kind);
                const isCopied = copiedKind === item.kind;
                const isRegenerating =
                  pendingKind === item.kind ||
                  (regenerate.isPending && regenerate.variables?.data?.kind === item.kind);

                return (
                  <Card key={item.kind} data-testid={`card-asset-${item.kind}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base">{item.label}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!asset}
                            onClick={() => asset && handleCopy(item.kind, asset.content)}
                            title="Copy to clipboard"
                            data-testid={`button-copy-${item.kind}`}
                          >
                            {isCopied ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isRegenerating || generateAll.isPending}
                            onClick={() => handleRegenerate(item.kind)}
                            title={asset ? "Regenerate" : "Generate"}
                            data-testid={`button-regenerate-${item.kind}`}
                          >
                            {isRegenerating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {asset ? (
                        <Textarea
                          value={asset.content}
                          readOnly
                          className="font-mono text-xs min-h-[200px] resize-y bg-muted/30"
                          data-testid={`textarea-${item.kind}`}
                        />
                      ) : (
                        <div
                          className="border border-dashed rounded-md p-6 text-center text-sm text-muted-foreground"
                          data-testid={`empty-${item.kind}`}
                        >
                          Not generated yet — use{" "}
                          <span className="font-medium">Generate All</span> or{" "}
                          <RefreshCw className="inline w-3 h-3 mx-0.5" />.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

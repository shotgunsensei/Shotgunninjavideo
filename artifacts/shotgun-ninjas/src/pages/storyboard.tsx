import { useState, useMemo, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Clapperboard,
  Loader2,
  Play,
  RefreshCw,
  Pencil,
  Copy,
  Trash2,
  Plus,
  Lock,
  Unlock,
  Sparkles,
  Film,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Camera,
  Aperture,
  MapPin,
  Lightbulb,
  Palette,
  Wind,
  Heart,
  Wand2,
  Save,
  Settings2,
  Mic2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { StickyMobileBar } from "@/components/StickyMobileBar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  useGetStoryboard,
  useGenerateStoryboard,
  useUpdateScene,
  useDeleteScene,
  useRegenerateScene,
  useDuplicateScene,
  useAddScene,
  useUpdateProject,
  useGetLyrics,
  getGetStoryboardQueryKey,
  getGetLyricsQueryKey,
  useGetProject,
  getGetProjectQueryKey,
  type StoryboardScene,
} from "@workspace/api-client-react";

const VISUAL_STYLES: { id: string; label: string; tagline: string }[] = [
  { id: "cyberpunk_uprising", label: "Cyberpunk Uprising", tagline: "Neon rebellion in a megacity" },
  { id: "gritty_urban", label: "Gritty Urban Grind", tagline: "Concrete realism, sodium amber" },
  { id: "anime_cinematic", label: "Anime Cinematic", tagline: "Painterly skies, dramatic light" },
  { id: "dark_industrial", label: "Dark Industrial", tagline: "Steel, sparks, oppressive scale" },
  { id: "motivational_founder", label: "Motivational Founder", tagline: "Quiet golden-hour conviction" },
  { id: "street_mv", label: "Street-Level MV", tagline: "Crew, block, swagger" },
  { id: "luxury_cinematic", label: "Luxury Cinematic", tagline: "Marble, tungsten, restraint" },
  { id: "horror_energy", label: "Horror Energy", tagline: "Held breath, observed dread" },
  { id: "scifi_neon", label: "Sci-Fi Neon", tagline: "Vast scale, cool starlight" },
  { id: "custom", label: "Custom", tagline: "Brand-led direction" },
];

const MOTION_INTENSITY = ["still", "low", "medium", "high", "explosive"];

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function paletteSwatches(palette: string): string[] {
  return palette
    .split(/[,;]/)
    .map((c) => c.trim())
    .filter((c) => /^#?[0-9a-f]{3,8}$/i.test(c.replace("#", "")))
    .slice(0, 6)
    .map((c) => (c.startsWith("#") ? c : `#${c}`));
}

export default function Storyboard() {
  const [, params] = useRoute("/projects/:id/storyboard");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const enabledForFetch = !!projectId &&
    ["analyzed", "storyboarded", "prompted", "exported"].includes(project?.status || "");

  const { data: scenes, isLoading } = useGetStoryboard(projectId, {
    query: {
      enabled: enabledForFetch,
      queryKey: getGetStoryboardQueryKey(projectId),
    },
  });

  const { data: lyricLines = [] } = useGetLyrics(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetLyricsQueryKey(projectId),
    },
  });

  const lyricsBySceneId = useMemo(() => {
    // Mirrors lyricsForScene() in the backend: manual sceneId always wins,
    // otherwise fall back to timestamp window matching.
    const m = new Map<string, string[]>();
    if (!scenes) return m;
    for (const s of scenes) {
      const matched = lyricLines.filter((l) => {
        if (l.sceneId) return l.sceneId === s.id;
        if (l.timestampSec !== null && l.timestampSec !== undefined) {
          return l.timestampSec >= s.startSec && l.timestampSec < s.endSec;
        }
        return false;
      });
      m.set(s.id, matched.map((l) => l.text));
    }
    return m;
  }, [scenes, lyricLines]);

  const generate = useGenerateStoryboard();
  const updateScene = useUpdateScene();
  const deleteScene = useDeleteScene();
  const regen = useRegenerateScene();
  const duplicate = useDuplicateScene();
  const addScene = useAddScene();
  const updateProject = useUpdateProject();

  const [styleId, setStyleId] = useState<string>(project?.visualStyle ?? "cyberpunk_uprising");
  const [brandDirection, setBrandDirection] = useState<string>(project?.brandDirection ?? "");
  const [lyrics, setLyrics] = useState<string>(project?.lyrics ?? "");
  const [showLyrics, setShowLyrics] = useState(false);

  useEffect(() => {
    if (project?.visualStyle) setStyleId(project.visualStyle);
    if (project?.brandDirection !== undefined) setBrandDirection(project.brandDirection ?? "");
    if (project?.lyrics !== undefined) setLyrics(project.lyrics ?? "");
  }, [project?.visualStyle, project?.brandDirection, project?.lyrics]);

  const [editing, setEditing] = useState<StoryboardScene | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingScene, setPendingScene] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const invalidateScenes = () => {
    queryClient.invalidateQueries({ queryKey: getGetStoryboardQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
  };

  const handleGenerate = (force = false) => {
    generate.mutate(
      {
        id: projectId,
        data: { visualStyle: styleId, brandDirection, lyrics, force },
      },
      {
        onSuccess: () => {
          toast({
            title: force ? "Storyboard regenerated" : "Storyboard generated",
            description: `${scenes?.length || ""} scenes drafted in ${VISUAL_STYLES.find((s) => s.id === styleId)?.label}.`,
          });
          invalidateScenes();
        },
        onError: () => toast({ title: "Generation failed", description: "Check the analysis is complete.", variant: "destructive" }),
      },
    );
  };

  const handleSaveStyle = () => {
    updateProject.mutate(
      { id: projectId, data: { visualStyle: styleId, brandDirection, lyrics } },
      {
        onSuccess: () => {
          toast({ title: "Direction saved", description: "Style and brand notes stored on project." });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        },
        onError: (err) => {
          toast({
            title: "Failed to save direction",
            description: err instanceof Error ? err.message : "Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleRegenOne = (scene: StoryboardScene) => {
    setPendingScene(scene.id);
    regen.mutate(
      { sceneId: scene.id },
      {
        onSuccess: () => {
          toast({ title: `Scene ${String(scene.index + 1).padStart(2, "0")} regenerated` });
          invalidateScenes();
        },
        onError: () => toast({ title: "Regenerate failed", variant: "destructive" }),
        onSettled: () => setPendingScene(null),
      },
    );
  };

  const handleDuplicate = (scene: StoryboardScene) => {
    setPendingScene(scene.id);
    duplicate.mutate(
      { sceneId: scene.id },
      {
        onSuccess: () => {
          toast({ title: "Scene duplicated" });
          invalidateScenes();
        },
        onError: () => toast({ title: "Failed to duplicate scene", variant: "destructive" }),
        onSettled: () => setPendingScene(null),
      },
    );
  };

  const handleDelete = (sceneId: string) => {
    setPendingScene(sceneId);
    deleteScene.mutate(
      { sceneId },
      {
        onSuccess: () => {
          toast({ title: "Scene deleted" });
          invalidateScenes();
        },
        onError: () => toast({ title: "Failed to delete scene", variant: "destructive" }),
        onSettled: () => {
          setPendingScene(null);
          setConfirmDeleteId(null);
        },
      },
    );
  };

  const handleAdd = (afterIndex?: number) => {
    addScene.mutate(
      { id: projectId, data: afterIndex !== undefined ? { afterIndex } : {} },
      {
        onSuccess: () => {
          toast({ title: "Scene added" });
          invalidateScenes();
        },
        onError: () => toast({ title: "Failed to add scene", variant: "destructive" }),
      },
    );
  };

  const handleToggleLock = (scene: StoryboardScene) => {
    setPendingScene(scene.id);
    updateScene.mutate(
      { sceneId: scene.id, data: { locked: !scene.locked } },
      {
        onSuccess: () => {
          toast({ title: scene.locked ? "Scene unlocked" : "Scene locked", description: scene.locked ? "Will regenerate on next batch." : "Protected from regeneration." });
          invalidateScenes();
        },
        onError: (err) => {
          toast({
            title: "Failed to update lock",
            description: err instanceof Error ? err.message : "Try again in a moment.",
            variant: "destructive",
          });
        },
        onSettled: () => setPendingScene(null),
      },
    );
  };

  const toggleExpanded = (sceneId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const styleMeta = useMemo(() => VISUAL_STYLES.find((s) => s.id === styleId) ?? VISUAL_STYLES[0]!, [styleId]);
  const hasScenes = !!scenes && scenes.length > 0;

  // -------- States --------

  if (!enabledForFetch) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <EmptyState
          icon={Clapperboard}
          title="Analysis Required"
          description="Run acoustic analysis before generating a storyboard. Beat and emotional segmentation power scene timing."
          action={
            <Button
              asChild
              className="rounded-none uppercase tracking-widest font-bold bg-gradient-crimson border border-primary/60 text-primary-foreground shadow-glow-soft"
            >
              <Link href={`/projects/${projectId}/analysis`}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Go to Analysis
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-32 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary/80">
              Director's Cut
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 border border-primary/30 bg-gradient-crimson-soft">
              <Film className="w-5 h-5 text-primary" />
            </span>
            Storyboard
          </h1>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            {project?.title}
            {project?.artist ? ` — ${project.artist}` : ""} ·{" "}
            {hasScenes ? `${scenes!.length} Scenes` : "No scenes yet"}
            {project?.bpm ? ` · ${Math.round(project.bpm)} BPM` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            className="rounded-none uppercase tracking-widest text-xs h-9"
          >
            <Link href={`/projects/${projectId}/analysis`}>
              <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Analysis
            </Link>
          </Button>
          {hasScenes && (
            <Button
              asChild
              variant="ghost"
              className="rounded-none uppercase tracking-widest text-xs h-9 hover:text-accent"
            >
              <Link href={`/projects/${projectId}/export`}>Export →</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Direction bar */}
      <div className="border border-border/60 surface-card relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-60 bg-[radial-gradient(circle_at_0%_0%,hsl(320_100%_50%/0.08),transparent_55%)]" />
        <div className="relative p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest">Director's Direction</h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSaveStyle}
              disabled={updateProject.isPending}
              className="rounded-none uppercase tracking-widest text-[10px] h-7"
            >
              {updateProject.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              Save Direction
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-2">
              <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                Visual Style
              </Label>
              <Select value={styleId} onValueChange={setStyleId}>
                <SelectTrigger className="rounded-none bg-background/80 border-border/60 font-mono text-sm h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-border/60 max-h-[60vh]">
                  {VISUAL_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="rounded-none">
                      <div className="flex flex-col">
                        <span className="font-bold uppercase tracking-wide text-sm">{s.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{s.tagline}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary/80 pt-1">
                {styleMeta.tagline}
              </p>
            </div>

            <div className="lg:col-span-2 space-y-2">
              <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                Brand Direction
              </Label>
              <Input
                value={brandDirection}
                onChange={(e) => setBrandDirection(e.target.value)}
                placeholder="e.g. Defiant industrial pop with crimson neon iconography"
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm h-10"
              />
              <p className="text-[10px] font-mono text-muted-foreground/70 pt-1">
                Optional — describe the artist's brand identity to steer environments, wardrobe, and tone.
              </p>
            </div>
          </div>

          <Collapsible open={showLyrics} onOpenChange={setShowLyrics}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                {showLyrics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Lyrics (optional)
                {lyrics && <span className="text-primary/70">· {lyrics.split(/\r?\n/).filter(Boolean).length} lines</span>}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Paste lyrics line-by-line. Each scene anchors to one line."
                className="rounded-none bg-background/80 border-border/60 font-mono text-xs min-h-[140px]"
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border/40">
            <Button
              size="lg"
              onClick={() => handleGenerate(false)}
              disabled={generate.isPending}
              className="rounded-none uppercase tracking-widest font-bold bg-white text-black hover:bg-gray-200 flex-1 sm:flex-none"
            >
              {generate.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : hasScenes ? (
                <RefreshCw className="w-4 h-4 mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2 fill-current" />
              )}
              {generate.isPending ? "Drafting Scenes..." : hasScenes ? "Regenerate All" : "Generate Storyboard"}
            </Button>
            {hasScenes && (
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
                Locked scenes will be preserved.{" "}
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={generate.isPending}
                  className="text-primary/80 hover:text-primary underline-offset-2 hover:underline"
                >
                  Force regenerate all
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!hasScenes && !isLoading && (
        <EmptyState
          icon={Clapperboard}
          title="Ready for the director's cut"
          description="Pick a visual style above, add your brand direction, and generate a beat-synced storyboard. Scenes inherit your timeline structure and emotional arc — lock, edit, duplicate, or regenerate any scene afterward."
        />
      )}

      {/* Scene list */}
      {hasScenes && (
        <div className="space-y-4">
          {scenes!.map((scene, idx) => {
            const isExpanded = expanded.has(scene.id);
            const isPending = pendingScene === scene.id;
            const swatches = paletteSwatches(scene.colorPalette);
            return (
              <div key={scene.id}>
                <Card
                  className={`rounded-none border-border/60 surface-card overflow-hidden transition-all hover-lift relative group/card ${scene.locked ? "border-l-4 border-l-amber-500/80" : "border-l-4 border-l-primary/50 hover:border-l-primary"}`}
                  data-testid={`scene-card-${scene.id}`}
                >
                  {/* Subtle ambient gradient on hover */}
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity bg-[radial-gradient(circle_at_100%_0%,hsl(320_100%_50%/0.06),transparent_60%)]" />
                  {/* Card header */}
                  <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-black/50 border-b border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="font-mono text-[10px] text-primary font-bold uppercase tracking-widest shrink-0">
                        Plot {String(scene.index + 1).padStart(3, "0")}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground bg-background/60 px-2 py-1 border border-border/50 shrink-0">
                        {fmtTime(scene.startSec)} – {fmtTime(scene.endSec)}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground/70 hidden sm:block shrink-0">
                        {(scene.endSec - scene.startSec).toFixed(1)}s
                      </div>
                      {scene.locked && (
                        <Badge className="rounded-none bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] uppercase tracking-widest">
                          <Lock className="w-2.5 h-2.5 mr-1" /> Locked
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleLock(scene)}
                        disabled={isPending}
                        className="rounded-none h-7 w-7 p-0"
                        title={scene.locked ? "Unlock scene" : "Lock scene"}
                        aria-label={scene.locked ? "Unlock scene" : "Lock scene"}
                        data-testid={`lock-${scene.id}`}
                      >
                        {scene.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRegenOne(scene)}
                        disabled={isPending || scene.locked}
                        className="rounded-none h-7 w-7 p-0"
                        title={scene.locked ? "Unlock to regenerate" : "Regenerate this scene"}
                        aria-label={scene.locked ? "Unlock to regenerate scene" : "Regenerate this scene"}
                        data-testid={`regenerate-${scene.id}`}
                      >
                        {isPending && regen.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(scene)}
                        className="rounded-none h-7 w-7 p-0"
                        title="Edit scene"
                        aria-label="Edit scene"
                        data-testid={`edit-${scene.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(scene)}
                        disabled={isPending}
                        className="rounded-none h-7 w-7 p-0"
                        title="Duplicate scene"
                        aria-label="Duplicate scene"
                        data-testid={`duplicate-${scene.id}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDeleteId(scene.id)}
                        className="rounded-none h-7 w-7 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                        title="Delete scene"
                        aria-label="Delete scene"
                        data-testid={`delete-${scene.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="rounded-none h-7 w-7 p-0"
                        title="Open scene + AI prompt editor"
                        aria-label="Open scene and AI prompt editor"
                      >
                        <Link href={`/projects/${projectId}/scenes/${scene.id}`}>
                          <Settings2 className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="relative p-4 sm:p-5 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-wider leading-tight mb-2">
                        {scene.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{scene.description}</p>
                      {(lyricsBySceneId.get(scene.id)?.length ?? 0) > 0 && (
                        <div
                          className="mt-3 border-l-2 border-accent/60 pl-3 py-1 space-y-0.5"
                          data-testid={`scene-lyrics-${scene.id}`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-accent/80">
                            <Mic2 className="w-3 h-3" /> Lyrics in this scene
                          </div>
                          {lyricsBySceneId.get(scene.id)!.map((line, li) => (
                            <p
                              key={li}
                              className="text-xs text-foreground/80 italic leading-snug"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick fields grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <Field icon={<Camera className="w-3 h-3" />} label="Shot Type" value={scene.shotType} />
                      <Field icon={<Aperture className="w-3 h-3" />} label="Camera" value={scene.cameraMovement} />
                      <Field icon={<Wind className="w-3 h-3" />} label="Motion" value={scene.motionIntensity} />
                      <Field icon={<Heart className="w-3 h-3" />} label="Purpose" value={scene.emotionalPurpose} />
                    </div>

                    {/* Palette swatches */}
                    {swatches.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
                          Palette
                        </span>
                        <div className="flex gap-0 flex-1 h-6 overflow-hidden border border-border/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                          {swatches.map((c, i) => (
                            <div
                              key={i}
                              className="flex-1 h-full transition-transform hover:scale-y-110"
                              style={{ backgroundColor: c, boxShadow: `inset 0 0 0 1px ${c}` }}
                              title={c}
                            />
                          ))}
                        </div>
                        <code className="text-[10px] font-mono text-muted-foreground hidden md:block truncate max-w-xs">
                          {scene.colorPalette}
                        </code>
                      </div>
                    )}

                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(scene.id)}
                      className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {isExpanded ? "Hide" : "Show"} full breakdown & AI prompt
                    </button>

                    {isExpanded && (
                      <div className="pt-3 border-t border-border/40 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <Field
                            icon={<MapPin className="w-3 h-3" />}
                            label="Environment"
                            value={scene.environment || scene.location}
                            block
                          />
                          <Field
                            icon={<Sparkles className="w-3 h-3" />}
                            label="Character Action"
                            value={scene.characterAction}
                            block
                          />
                          <Field
                            icon={<Lightbulb className="w-3 h-3" />}
                            label="Lighting"
                            value={scene.lighting}
                            block
                          />
                          <Field
                            icon={<Palette className="w-3 h-3" />}
                            label="Wardrobe"
                            value={scene.wardrobe ?? "—"}
                            block
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-mono tracking-widest text-accent flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> AI Video Prompt
                          </Label>
                          <pre className="rounded-none bg-background/80 border border-accent/20 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                            {scene.aiPrompt || "—"}
                          </pre>
                        </div>

                        {scene.notes && (
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                              Director's Notes
                            </Label>
                            <p className="text-xs font-mono text-muted-foreground italic">{scene.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Insert-after divider */}
                <div className="flex items-center gap-3 py-2 group">
                  <div className="flex-1 h-px bg-border/30 group-hover:bg-primary/30 transition-colors" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAdd(idx)}
                    disabled={addScene.isPending}
                    className="rounded-none uppercase tracking-widest text-[10px] h-6 opacity-40 hover:opacity-100"
                    data-testid={`add-after-${scene.id}`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Insert Scene
                  </Button>
                  <div className="flex-1 h-px bg-border/30 group-hover:bg-primary/30 transition-colors" />
                </div>
              </div>
            );
          })}

          {/* Append button */}
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => handleAdd()}
              disabled={addScene.isPending}
              className="w-full rounded-none uppercase tracking-widest text-xs border-dashed border-border/50 h-12 hover:border-primary/60"
              data-testid="add-scene-end"
            >
              {addScene.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 mr-2" />
              )}
              Add Scene at End
            </Button>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <SceneEditDialog
        scene={editing}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          if (!editing) return;
          updateScene.mutate(
            { sceneId: editing.id, data },
            {
              onSuccess: () => {
                toast({ title: "Scene saved" });
                invalidateScenes();
                setEditing(null);
              },
              onError: () =>
                toast({ title: "Save failed", variant: "destructive" }),
            },
          );
        }}
        saving={updateScene.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent className="rounded-none border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest">Delete scene?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              This removes the scene from the storyboard. Remaining scenes are renumbered.
              Generated prompts for this scene will also be removed when prompts are regenerated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none uppercase tracking-widest text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              className="rounded-none uppercase tracking-widest text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky mobile generate button */}
      <StickyMobileBar>
        <Button
          onClick={() => handleGenerate(false)}
          disabled={generate.isPending}
          className="w-full rounded-none uppercase tracking-widest font-bold bg-gradient-crimson border border-primary/60 text-primary-foreground shadow-glow-soft h-11"
          data-testid="mobile-generate-storyboard"
        >
          {generate.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Drafting Scenes…
            </>
          ) : hasScenes ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Storyboard
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2 fill-current" /> Generate Storyboard
            </>
          )}
        </Button>
      </StickyMobileBar>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  block = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  block?: boolean;
}) {
  return (
    <div className={block ? "space-y-1" : "space-y-1 min-w-0"}>
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-xs font-mono ${block ? "leading-relaxed" : "truncate"}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function SceneEditDialog({
  scene,
  onClose,
  onSave,
  saving,
}: {
  scene: StoryboardScene | null;
  onClose: () => void;
  onSave: (data: Partial<StoryboardScene>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<StoryboardScene>>({});

  useEffect(() => {
    if (scene) setForm({ ...scene });
  }, [scene]);

  if (!scene) return null;

  const set = (k: keyof StoryboardScene, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <Dialog open={!!scene} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-none border-border/60 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Edit Scene {String(scene.index + 1).padStart(3, "0")}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] uppercase tracking-widest">
            {fmtTime(scene.startSec)} – {fmtTime(scene.endSec)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Row label="Title">
            <Input
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              className="rounded-none bg-background/80 border-border/60 font-bold uppercase"
            />
          </Row>
          <Row label="Description">
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              className="rounded-none bg-background/80 border-border/60 min-h-[100px]"
            />
          </Row>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Row label="Shot Type">
              <Input
                value={form.shotType ?? ""}
                onChange={(e) => set("shotType", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Camera Movement">
              <Input
                value={form.cameraMovement ?? ""}
                onChange={(e) => set("cameraMovement", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Environment">
              <Input
                value={form.environment ?? ""}
                onChange={(e) => set("environment", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Character Action">
              <Input
                value={form.characterAction ?? ""}
                onChange={(e) => set("characterAction", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Emotional Purpose">
              <Input
                value={form.emotionalPurpose ?? ""}
                onChange={(e) => set("emotionalPurpose", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Motion Intensity">
              <Select
                value={form.motionIntensity ?? "medium"}
                onValueChange={(v) => set("motionIntensity", v)}
              >
                <SelectTrigger className="rounded-none bg-background/80 border-border/60 font-mono text-sm h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-border/60">
                  {MOTION_INTENSITY.map((m) => (
                    <SelectItem key={m} value={m} className="rounded-none uppercase">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Lighting">
              <Input
                value={form.lighting ?? ""}
                onChange={(e) => set("lighting", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Color Palette">
              <Input
                value={form.colorPalette ?? ""}
                onChange={(e) => set("colorPalette", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Wardrobe">
              <Input
                value={form.wardrobe ?? ""}
                onChange={(e) => set("wardrobe", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
            <Row label="Notes">
              <Input
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                className="rounded-none bg-background/80 border-border/60 font-mono text-sm"
              />
            </Row>
          </div>
          <Row label="AI Video Prompt">
            <Textarea
              value={form.aiPrompt ?? ""}
              onChange={(e) => set("aiPrompt", e.target.value)}
              className="rounded-none bg-background/80 border-accent/30 min-h-[140px] font-mono text-xs"
            />
          </Row>
        </div>

        <DialogFooter className="border-t border-border/40 pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-none uppercase tracking-widest text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={saving}
            className="rounded-none uppercase tracking-widest text-xs font-bold"
            data-testid="save-scene-edit"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-2" />
            )}
            Save Scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

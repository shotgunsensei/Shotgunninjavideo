import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Loader2,
  Music,
  Zap,
  Clapperboard,
  Download,
  Edit2,
  Check,
  X,
  Trash2,
  Palette,
  Save,
  ArrowRight,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useGetProject,
  getGetProjectQueryKey,
  useUpdateProject,
  useDeleteProject,
  useListBrandPresets,
  getListBrandPresetsQueryKey,
  useApplyBrandPresetToProject,
  useSaveProjectAsBrandPreset,
} from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProjectCompletionMeter } from "@/components/ProjectCompletionMeter";
import { cn } from "@/lib/utils";

export default function ProjectHub() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectQueryKey(projectId),
    },
  });

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { data: presets } = useListBrandPresets();
  const applyPreset = useApplyBrandPresetToProject();
  const saveAsPreset = useSaveProjectAsBrandPreset();
  const [saveAsName, setSaveAsName] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", artist: "", genre: "" });

  useEffect(() => {
    if (project) {
      setEditForm({
        title: project.title,
        artist: project.artist || "",
        genre: project.genre || "",
      });
    }
  }, [project]);

  const handleSave = () => {
    updateProject.mutate(
      { id: projectId, data: editForm },
      {
        onSuccess: () => {
          setIsEditing(false);
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: "Project updated" });
        },
      },
    );
  };

  const handleApplyPreset = (value: string) => {
    const presetId = value === "__none__" ? null : value;
    applyPreset.mutate(
      { id: projectId, data: { presetId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: presetId ? "Brand preset applied" : "Brand preset detached" });
        },
        onError: () => toast({ title: "Failed to apply preset", variant: "destructive" }),
      },
    );
  };

  const handleSaveAsPreset = () => {
    saveAsPreset.mutate(
      { id: projectId, data: saveAsName.trim() ? { name: saveAsName.trim() } : {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBrandPresetsQueryKey() });
          setSaveAsName("");
          toast({ title: "Saved as new brand preset" });
        },
        onError: () => toast({ title: "Failed to save preset", variant: "destructive" }),
      },
    );
  };

  const handleDelete = () => {
    deleteProject.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          window.location.href = "/dashboard";
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center p-12 text-muted-foreground font-mono uppercase tracking-widest">
        Project not found
      </div>
    );
  }

  const steps: {
    id: string;
    label: string;
    icon: LucideIcon;
    path: string;
    done: boolean;
  }[] = [
    {
      id: "upload",
      label: "Audio Upload",
      icon: Music,
      path: `/projects/${projectId}/upload`,
      done: ["uploaded", "analyzed", "storyboarded", "prompted", "exported"].includes(
        project.status,
      ),
    },
    {
      id: "analyze",
      label: "Analysis",
      icon: Zap,
      path: `/projects/${projectId}/analysis`,
      done: ["analyzed", "storyboarded", "prompted", "exported"].includes(project.status),
    },
    {
      id: "storyboard",
      label: "Storyboard",
      icon: Clapperboard,
      path: `/projects/${projectId}/storyboard`,
      done: ["storyboarded", "prompted", "exported"].includes(project.status),
    },
    {
      id: "export",
      label: "Export",
      icon: Download,
      path: `/projects/${projectId}/export`,
      done: ["exported"].includes(project.status),
    },
  ];

  const nextStep = steps.find((s) => !s.done) ?? steps[steps.length - 1];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="relative surface-card border border-border/50 overflow-hidden">
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: project.coverColor || "hsl(var(--primary))" }}
        />
        <div className="absolute inset-0 pointer-events-none opacity-60 bg-[radial-gradient(circle_at_100%_0%,hsl(320_100%_50%/0.10),transparent_55%)]" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 pl-7">
          <div className="flex-1 w-full">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="text-2xl font-bold rounded-none h-12 bg-background/50 border-primary"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Artist"
                    value={editForm.artist}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, artist: e.target.value }))
                    }
                    className="rounded-none bg-background/50"
                  />
                  <Input
                    placeholder="Genre"
                    value={editForm.genre}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, genre: e.target.value }))
                    }
                    className="rounded-none bg-background/50"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    className="rounded-none uppercase tracking-wider text-xs"
                    disabled={updateProject.isPending}
                  >
                    {updateProject.isPending ? (
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3 mr-2" />
                    )}{" "}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="rounded-none uppercase tracking-wider text-xs"
                  >
                    <X className="w-3 h-3 mr-2" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary/80">
                    Project Hub
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <h1 className="text-3xl font-bold tracking-tighter uppercase">
                    {project.title}
                  </h1>
                  <Badge
                    variant="outline"
                    className="uppercase font-mono text-[10px] rounded-none bg-background/50 border-border/60"
                  >
                    {project.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="h-6 w-6 ml-1 rounded-none opacity-50 hover:opacity-100"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider mt-1">
                  {project.artist || "Unknown Artist"}{" "}
                  {project.genre && `// ${project.genre}`}
                </p>
                <div className="text-[11px] text-muted-foreground font-mono mt-3 uppercase tracking-widest">
                  ID: {project.id} · Created{" "}
                  {format(new Date(project.createdAt), "yyyy-MM-dd")}
                </div>
              </div>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-none uppercase tracking-wider text-xs bg-destructive/15 text-destructive hover:bg-destructive hover:text-white border border-destructive/40"
              >
                <Trash2 className="w-3 h-3 mr-2" /> Delete Project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-none border-destructive/50 bg-black">
              <AlertDialogHeader>
                <AlertDialogTitle className="uppercase tracking-wider">
                  Terminate Project?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All audio, analysis data, storyboards,
                  and prompts will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none uppercase tracking-wider">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="rounded-none uppercase tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Proceed
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Completion meter */}
      <ProjectCompletionMeter
        steps={steps.map((s) => ({ id: s.id, label: s.label, done: s.done }))}
        label="Production Pipeline"
      />

      {project.audio && (
        <Card className="rounded-none border-border/50 surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Source Material
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SourceField label="File" value={project.audio.fileName} mono />
              <SourceField
                label="Duration"
                value={
                  project.audio.durationSec
                    ? `${Math.floor(project.audio.durationSec / 60)}:${Math.floor(project.audio.durationSec % 60).toString().padStart(2, "0")}`
                    : "Unknown"
                }
                mono
              />
              {project.bpm && (
                <SourceField
                  label="BPM"
                  value={Math.round(project.bpm).toString()}
                  accent="primary"
                  mono
                />
              )}
              {project.keySignature && (
                <SourceField
                  label="Key"
                  value={project.keySignature}
                  accent="accent"
                  mono
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-none border-border/50 surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Palette className="w-3.5 h-3.5" /> Brand Preset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                Apply Preset
              </label>
              <Select
                value={project.brandPresetId ?? "__none__"}
                onValueChange={handleApplyPreset}
                disabled={applyPreset.isPending}
              >
                <SelectTrigger
                  className="rounded-none bg-background/50 font-mono text-sm"
                  data-testid="select-apply-preset"
                >
                  <SelectValue placeholder="Choose a brand preset..." />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="__none__" data-testid="option-no-preset">
                    — None —
                  </SelectItem>
                  {presets?.map((p) => (
                    <SelectItem key={p.id} value={p.id} data-testid={`option-preset-${p.id}`}>
                      {p.name}
                      {p.isDefault ? " · default" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] font-mono text-muted-foreground">
                Applies the preset's visual style, brand direction, and cover color to this project.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                Save Current as New Preset
              </label>
              <div className="flex gap-2">
                <Input
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder={`${project.title} (Saved Preset)`}
                  className="rounded-none bg-background/50 font-mono text-sm"
                  data-testid="input-save-as-name"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveAsPreset}
                  disabled={saveAsPreset.isPending}
                  className="rounded-none uppercase tracking-wider text-xs shrink-0"
                  data-testid="button-save-as-preset"
                >
                  {saveAsPreset.isPending ? (
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3 mr-2" />
                  )}
                  Save
                </Button>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                Snapshots this project's brand fields, palette, and camera language into a new reusable preset.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/brand-presets">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none uppercase tracking-wider text-xs text-muted-foreground hover:text-primary"
              >
                Manage Brand Presets →
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Production Pipeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold uppercase tracking-widest flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 border border-primary/40 bg-primary/10 text-primary">
              <Clapperboard className="w-4 h-4" />
            </span>
            Production Pipeline
          </h2>
          {nextStep && !nextStep.done && (
            <Button
              asChild
              size="sm"
              className="rounded-none uppercase tracking-widest text-xs font-bold bg-gradient-crimson border border-primary/60 text-primary-foreground shadow-glow-soft hidden sm:inline-flex"
            >
              <Link href={nextStep.path} data-testid="next-step-cta">
                Continue → {nextStep.label}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => {
            const isNext = !step.done && nextStep?.id === step.id;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link href={step.path}>
                  <Card
                    className={cn(
                      "rounded-none border cursor-pointer transition-all duration-300 group overflow-hidden relative h-full surface-card hover-lift",
                      step.done && "border-emerald-500/40 hover:border-emerald-400",
                      !step.done && isNext && "border-primary/60 ring-1 ring-primary/40",
                      !step.done && !isNext && "border-border/50 hover:border-primary/40",
                    )}
                    data-testid={`pipeline-card-${step.id}`}
                  >
                    {step.done && (
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent" />
                    )}
                    {isNext && (
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
                    )}

                    <div className="absolute top-2 right-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    <CardContent className="p-6 relative z-10 flex flex-col items-center text-center gap-4">
                      <div
                        className={cn(
                          "relative p-4 border transition-all",
                          step.done
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)]"
                            : isNext
                              ? "border-primary bg-primary/15 text-primary shadow-[0_0_20px_-4px_hsl(320_100%_50%/0.6)] animate-pulse-glow"
                              : "bg-background/40 border-border text-muted-foreground group-hover:text-foreground group-hover:border-primary/40",
                        )}
                      >
                        <step.icon className="w-6 h-6" />
                        {step.done && (
                          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 bg-emerald-500 border border-background">
                            <CheckCircle2 className="w-3 h-3 text-background" />
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold uppercase tracking-wider text-sm">
                          {step.label}
                        </div>
                        <div
                          className={cn(
                            "text-[10px] font-mono mt-1 uppercase tracking-widest",
                            step.done
                              ? "text-emerald-400"
                              : isNext
                                ? "text-primary"
                                : "text-muted-foreground",
                          )}
                        >
                          {step.done ? "Complete" : isNext ? "Next Step ↓" : "Pending"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SourceField({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "primary" | "accent";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground font-mono mb-1 tracking-widest">
        {label}
      </div>
      <div
        className={cn(
          "text-sm truncate",
          mono && "font-mono",
          accent === "primary" && "text-primary",
          accent === "accent" && "text-accent",
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

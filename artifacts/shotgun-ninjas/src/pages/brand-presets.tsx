import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Palette,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Save,
  X,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useListBrandPresets,
  useCreateBrandPreset,
  useUpdateBrandPreset,
  useDuplicateBrandPreset,
  useDeleteBrandPreset,
  getListBrandPresetsQueryKey,
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

type DraftPreset = {
  name: string;
  characterDescription: string;
  colorPalette: string;
  visualStyle: string;
  logoDescription: string;
  voiceTone: string;
  recurringSymbols: string;
  cameraLanguage: string;
  negativePromptRules: string;
  watermarkText: string;
};

const EMPTY_DRAFT: DraftPreset = {
  name: "",
  characterDescription: "",
  colorPalette: "",
  visualStyle: "",
  logoDescription: "",
  voiceTone: "",
  recurringSymbols: "",
  cameraLanguage: "",
  negativePromptRules: "",
  watermarkText: "",
};

const FIELD_LABELS: { key: keyof DraftPreset; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: "name", label: "Brand Name", placeholder: "e.g. Shotgun Ninjas Productions" },
  { key: "characterDescription", label: "Main Character Description", placeholder: "Wardrobe, body language, signature look…", multiline: true },
  { key: "colorPalette", label: "Color Palette", placeholder: "#C40000, #1B1B1F, #F4A261" },
  { key: "visualStyle", label: "Visual Style", placeholder: "Gritty urban uprising, anamorphic widescreen…", multiline: true },
  { key: "logoDescription", label: "Logo Description", placeholder: "Hand-drawn red ninja insignia…", multiline: true },
  { key: "voiceTone", label: "Voice / Tone", placeholder: "Defiant, brotherhood-first, quiet menace" },
  { key: "recurringSymbols", label: "Recurring Symbols", placeholder: "red ninja, rooftop, hammer + sparks…" },
  { key: "cameraLanguage", label: "Preferred Camera Language", placeholder: "Low-angle hero, slow dolly-in…", multiline: true },
  { key: "negativePromptRules", label: "Negative Prompt Rules", placeholder: "fantasy, daylight clean, polished CGI…", multiline: true },
  { key: "watermarkText", label: "Export Watermark Text", placeholder: "SHOTGUN NINJAS" },
];

function parsePalette(palette: string | null | undefined): string[] {
  if (!palette) return [];
  return palette
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^#[0-9A-Fa-f]{6}$/.test(s));
}

export default function BrandPresetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: presets, isLoading } = useListBrandPresets();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<DraftPreset>(EMPTY_DRAFT);

  const createPreset = useCreateBrandPreset();
  const updatePreset = useUpdateBrandPreset();
  const duplicatePreset = useDuplicateBrandPreset();
  const deletePreset = useDeleteBrandPreset();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListBrandPresetsQueryKey() });

  const sorted = useMemo(() => {
    if (!presets) return [];
    return [...presets].sort((a, b) => {
      if (a.isDefault === b.isDefault) return a.name.localeCompare(b.name);
      return a.isDefault ? -1 : 1;
    });
  }, [presets]);

  const handleStartCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setIsCreating(true);
  };

  const handleStartEdit = (id: string) => {
    const p = presets?.find((x) => x.id === id);
    if (!p) return;
    setDraft({
      name: p.name,
      characterDescription: p.characterDescription ?? "",
      colorPalette: p.colorPalette ?? "",
      visualStyle: p.visualStyle ?? "",
      logoDescription: p.logoDescription ?? "",
      voiceTone: p.voiceTone ?? "",
      recurringSymbols: p.recurringSymbols ?? "",
      cameraLanguage: p.cameraLanguage ?? "",
      negativePromptRules: p.negativePromptRules ?? "",
      watermarkText: p.watermarkText ?? "",
    });
    setIsCreating(false);
    setEditingId(id);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setDraft(EMPTY_DRAFT);
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      toast({ title: "Brand name required", variant: "destructive" });
      return;
    }
    if (isCreating) {
      createPreset.mutate(
        {
          data: {
            name: draft.name.trim(),
            characterDescription: draft.characterDescription || undefined,
            colorPalette: draft.colorPalette || undefined,
            visualStyle: draft.visualStyle || undefined,
            logoDescription: draft.logoDescription || undefined,
            voiceTone: draft.voiceTone || undefined,
            recurringSymbols: draft.recurringSymbols || undefined,
            cameraLanguage: draft.cameraLanguage || undefined,
            negativePromptRules: draft.negativePromptRules || undefined,
            watermarkText: draft.watermarkText || undefined,
          },
        },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Brand preset created" });
            handleCancel();
          },
          onError: () => toast({ title: "Failed to create preset", variant: "destructive" }),
        }
      );
    } else if (editingId) {
      updatePreset.mutate(
        {
          id: editingId,
          data: {
            name: draft.name.trim(),
            characterDescription: draft.characterDescription || null,
            colorPalette: draft.colorPalette || null,
            visualStyle: draft.visualStyle || null,
            logoDescription: draft.logoDescription || null,
            voiceTone: draft.voiceTone || null,
            recurringSymbols: draft.recurringSymbols || null,
            cameraLanguage: draft.cameraLanguage || null,
            negativePromptRules: draft.negativePromptRules || null,
            watermarkText: draft.watermarkText || null,
          },
        },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Brand preset updated" });
            handleCancel();
          },
          onError: () => toast({ title: "Failed to update preset", variant: "destructive" }),
        }
      );
    }
  };

  const handleDuplicate = (id: string) => {
    duplicatePreset.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Preset duplicated" });
        },
        onError: () => toast({ title: "Failed to duplicate preset", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: string) => {
    deletePreset.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Preset deleted" });
        },
        onError: () => toast({ title: "Cannot delete default preset", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isFormOpen = isCreating || editingId !== null;
  const isSaving = createPreset.isPending || updatePreset.isPending;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 border border-border/50 bg-card/20 backdrop-blur">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Palette className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tighter uppercase">Brand Presets</h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            Reusable visual identity packs // {sorted.length} preset{sorted.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          onClick={handleStartCreate}
          disabled={isFormOpen}
          className="rounded-none uppercase tracking-wider text-xs"
          data-testid="button-new-preset"
        >
          <Plus className="w-4 h-4 mr-2" /> New Preset
        </Button>
      </div>

      {isFormOpen && (
        <Card className="rounded-none border-primary/40 bg-card/30 backdrop-blur" data-testid="preset-form">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-widest">
                {isCreating ? "New Brand Preset" : "Edit Brand Preset"}
              </h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  className="rounded-none uppercase tracking-wider text-xs"
                  data-testid="button-cancel-preset"
                >
                  <X className="w-3 h-3 mr-2" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-none uppercase tracking-wider text-xs"
                  data-testid="button-save-preset"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
                  {isCreating ? "Create" : "Save"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FIELD_LABELS.map((f) => (
                <div
                  key={f.key}
                  className={f.multiline ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}
                >
                  <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <Textarea
                      value={draft[f.key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={3}
                      className="rounded-none bg-background/50 font-mono text-sm"
                      data-testid={`input-${f.key}`}
                    />
                  ) : (
                    <Input
                      value={draft[f.key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="rounded-none bg-background/50 font-mono text-sm"
                      data-testid={`input-${f.key}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map((p) => {
          const colors = parsePalette(p.colorPalette);
          return (
            <Card
              key={p.id}
              className="rounded-none border-border/50 bg-card/20 backdrop-blur relative overflow-hidden"
              data-testid={`preset-card-${p.id}`}
            >
              {colors[0] && (
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: colors[0] }}
                />
              )}
              <CardContent className="p-5 pl-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold uppercase tracking-wider truncate">{p.name}</h3>
                      {p.isDefault && (
                        <Badge variant="outline" className="uppercase font-mono text-[9px] rounded-none bg-background/50">
                          <Lock className="w-2.5 h-2.5 mr-1" /> Default
                        </Badge>
                      )}
                    </div>
                    {p.voiceTone && (
                      <p className="text-xs font-mono text-muted-foreground mt-1 line-clamp-2">
                        {p.voiceTone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-none"
                      onClick={() => handleStartEdit(p.id)}
                      title="Edit"
                      data-testid={`button-edit-${p.id}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-none"
                      onClick={() => handleDuplicate(p.id)}
                      title="Duplicate"
                      data-testid={`button-duplicate-${p.id}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {!p.isDefault && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-none text-destructive hover:bg-destructive/10"
                            title="Delete"
                            data-testid={`button-delete-${p.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-none border-destructive/50 bg-black">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="uppercase tracking-wider">Delete preset?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{p.name}" will be removed. Projects currently using it will be detached but otherwise unaffected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-none uppercase tracking-wider">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(p.id)}
                              className="rounded-none uppercase tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-${p.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {colors.length > 0 && (
                  <div className="flex gap-1.5">
                    {colors.map((c) => (
                      <div
                        key={c}
                        className="w-6 h-6 border border-border/50"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                )}

                {p.visualStyle && (
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">
                      Visual Style
                    </div>
                    <p className="text-xs font-mono text-foreground/80 line-clamp-3">{p.visualStyle}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {p.cameraLanguage && (
                    <div>
                      <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mb-0.5">
                        Camera
                      </div>
                      <p className="text-[11px] font-mono text-foreground/70 line-clamp-2">{p.cameraLanguage}</p>
                    </div>
                  )}
                  {p.recurringSymbols && (
                    <div>
                      <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mb-0.5">
                        Symbols
                      </div>
                      <p className="text-[11px] font-mono text-foreground/70 line-clamp-2">{p.recurringSymbols}</p>
                    </div>
                  )}
                </div>

                {p.watermarkText && (
                  <div className="pt-2 border-t border-border/30">
                    <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mb-0.5">
                      Watermark
                    </div>
                    <p className="text-xs font-mono tracking-widest text-accent">{p.watermarkText}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

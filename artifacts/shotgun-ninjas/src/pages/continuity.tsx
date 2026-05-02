import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ShieldCheck,
  ShieldOff,
  Save,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import {
  useGetContinuity,
  useUpdateContinuity,
  useApplyContinuity,
  getGetContinuityQueryKey,
  getGetPromptEngineQueryKey,
  getGetStoryboardQueryKey,
} from "@workspace/api-client-react";

interface ContinuityForm {
  mainCharacter: string;
  outfit: string;
  faceStyle: string;
  vehicleProps: string;
  logoSymbol: string;
  brandStyle: string;
  colorPalette: string;
  locationWorld: string;
  environmentRules: string;
  recurringMotifs: string;
  negativePromptLibrary: string;
  lockEnabled: boolean;
}

const EMPTY: ContinuityForm = {
  mainCharacter: "",
  outfit: "",
  faceStyle: "",
  vehicleProps: "",
  logoSymbol: "",
  brandStyle: "",
  colorPalette: "",
  locationWorld: "",
  environmentRules: "",
  recurringMotifs: "",
  negativePromptLibrary: "",
  lockEnabled: false,
};

export default function ContinuityPage() {
  const [, params] = useRoute("/projects/:id/continuity");
  const projectId = params?.id ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ContinuityForm>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  const {
    data: continuity,
    isLoading,
    isSuccess,
  } = useGetContinuity(projectId, {
    query: { enabled: !!projectId, queryKey: getGetContinuityQueryKey(projectId) },
  });

  const updateMut = useUpdateContinuity();
  const applyMut = useApplyContinuity();

  useEffect(() => {
    if (!isSuccess || hydrated || !continuity) return;
    setForm({
      mainCharacter: continuity.mainCharacter ?? "",
      outfit: continuity.outfit ?? "",
      faceStyle: continuity.faceStyle ?? "",
      vehicleProps: continuity.vehicleProps ?? "",
      logoSymbol: continuity.logoSymbol ?? "",
      brandStyle: continuity.brandStyle ?? "",
      colorPalette: continuity.colorPalette ?? "",
      locationWorld: continuity.locationWorld ?? "",
      environmentRules: continuity.environmentRules ?? "",
      recurringMotifs: continuity.recurringMotifs ?? "",
      negativePromptLibrary: continuity.negativePromptLibrary ?? "",
      lockEnabled: !!continuity.lockEnabled,
    });
    setHydrated(true);
  }, [isSuccess, continuity, hydrated]);

  const setField = <K extends keyof ContinuityForm>(k: K, v: ContinuityForm[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const handleSave = () => {
    updateMut.mutate(
      { id: projectId, data: form },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetContinuityQueryKey(projectId) });
          queryClient.invalidateQueries({
            queryKey: getGetPromptEngineQueryKey(projectId),
          });
          toast({ title: "Continuity saved", description: "Identity and world locked in." });
        },
        onError: (err) => {
          toast({
            title: "Save failed",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleToggleLock = (next: boolean) => {
    const previous = form.lockEnabled;
    setField("lockEnabled", next);
    // Persist immediately so the lock state is reflected everywhere without
    // needing the user to remember to press Save. On failure we revert the
    // local UI state so the toggle never lies about server state.
    updateMut.mutate(
      { id: projectId, data: { ...form, lockEnabled: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetContinuityQueryKey(projectId) });
          queryClient.invalidateQueries({
            queryKey: getGetPromptEngineQueryKey(projectId),
          });
          toast({
            title: next ? "Continuity LOCKED" : "Continuity UNLOCKED",
            description: next
              ? "Every scene prompt will now preserve identity, world, and brand."
              : "Scene prompts no longer auto-inject continuity.",
          });
        },
        onError: (err) => {
          setField("lockEnabled", previous);
          toast({
            title: "Lock toggle failed",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleApply = () => {
    setConfirmApplyOpen(false);
    applyMut.mutate(
      { id: projectId },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetPromptEngineQueryKey(projectId) });
          queryClient.invalidateQueries({
            queryKey: getGetStoryboardQueryKey(projectId),
          });
          toast({
            title: "Continuity applied",
            description: `Updated ${data.updatedSceneCount} of ${data.totalScenes} scenes (${data.skippedLockedCount} locked, skipped).`,
          });
        },
        onError: (err) => {
          toast({
            title: "Apply failed",
            description: (err as Error).message,
            variant: "destructive",
          });
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

  return (
    <div className="max-w-5xl mx-auto space-y-8" data-testid="continuity-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" /> Continuity Control
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
            Global identity, world &amp; brand — applied across every scene
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmApplyOpen(true)}
            disabled={applyMut.isPending}
            className="rounded-none uppercase tracking-widest text-xs font-mono"
            data-testid="button-apply-continuity"
          >
            {applyMut.isPending ? (
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 mr-2" />
            )}
            Apply to all scenes
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMut.isPending}
            className="rounded-none uppercase tracking-widest text-xs font-mono"
            data-testid="button-save-continuity"
          >
            {updateMut.isPending ? (
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            ) : (
              <Save className="w-3 h-3 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Card
        className={`rounded-none border-2 ${
          form.lockEnabled
            ? "border-primary/40 bg-primary/5"
            : "border-border/50 bg-card/20"
        } backdrop-blur`}
        data-testid="continuity-lock-card"
      >
        <CardContent className="p-6 flex items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {form.lockEnabled ? (
              <ShieldCheck className="w-8 h-8 text-primary mt-1" />
            ) : (
              <ShieldOff className="w-8 h-8 text-muted-foreground mt-1" />
            )}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold uppercase tracking-widest">
                  Continuity Lock
                </h2>
                <Badge
                  variant={form.lockEnabled ? "default" : "outline"}
                  className="rounded-none font-mono uppercase tracking-widest text-[10px]"
                  data-testid="badge-lock-status"
                >
                  {form.lockEnabled ? "ENGAGED" : "OFF"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1 max-w-md">
                When engaged, every prompt automatically preserves the protagonist,
                outfit, world, lighting style, and brand identity defined below.
              </p>
            </div>
          </div>
          <Switch
            checked={form.lockEnabled}
            onCheckedChange={handleToggleLock}
            data-testid="switch-continuity-lock"
          />
        </CardContent>
      </Card>

      <Section title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldArea
            label="Main Character"
            placeholder="e.g. A weathered samurai with silver hair, mid-30s"
            value={form.mainCharacter}
            onChange={(v) => setField("mainCharacter", v)}
            testid="field-mainCharacter"
            rows={2}
          />
          <FieldArea
            label="Outfit"
            placeholder="e.g. Black tactical hoodie, ripped denim, scuffed boots"
            value={form.outfit}
            onChange={(v) => setField("outfit", v)}
            testid="field-outfit"
            rows={2}
          />
          <FieldArea
            label="Face Style"
            placeholder="e.g. Sharp jaw, scar above left brow, calm intensity"
            value={form.faceStyle}
            onChange={(v) => setField("faceStyle", v)}
            testid="field-faceStyle"
            rows={2}
          />
          <FieldArea
            label="Vehicle / Props"
            placeholder="e.g. Black 1972 Charger, katana, vintage Polaroid"
            value={form.vehicleProps}
            onChange={(v) => setField("vehicleProps", v)}
            testid="field-vehicleProps"
            rows={2}
          />
        </div>
      </Section>

      <Section title="World">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldArea
            label="Location / World Description"
            placeholder="e.g. Neo-Tokyo at perpetual dusk, monsoon-soaked, neon-drenched"
            value={form.locationWorld}
            onChange={(v) => setField("locationWorld", v)}
            testid="field-locationWorld"
            rows={3}
          />
          <FieldArea
            label="Environment Rules"
            placeholder="e.g. Always raining; no daylight; reflections in puddles required"
            value={form.environmentRules}
            onChange={(v) => setField("environmentRules", v)}
            testid="field-environmentRules"
            rows={3}
          />
        </div>
      </Section>

      <Section title="Brand">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldArea
            label="Brand Style"
            placeholder="e.g. High-contrast monochrome with crimson accents, grain overlay"
            value={form.brandStyle}
            onChange={(v) => setField("brandStyle", v)}
            testid="field-brandStyle"
            rows={2}
          />
          <FieldArea
            label="Color Palette"
            placeholder="e.g. Deep teal, cadmium red, charcoal, bone white"
            value={form.colorPalette}
            onChange={(v) => setField("colorPalette", v)}
            testid="field-colorPalette"
            rows={2}
          />
          <FieldArea
            label="Logo / Brand Symbol"
            placeholder="e.g. A circular crow-skull crest, embroidered on the back of the jacket"
            value={form.logoSymbol}
            onChange={(v) => setField("logoSymbol", v)}
            testid="field-logoSymbol"
            rows={2}
          />
          <FieldArea
            label="Recurring Visual Motifs"
            placeholder="e.g. Falling cherry blossoms, broken neon kanji, slow-motion smoke"
            value={form.recurringMotifs}
            onChange={(v) => setField("recurringMotifs", v)}
            testid="field-recurringMotifs"
            rows={2}
          />
        </div>
      </Section>

      <Section title="Negative Prompt Library">
        <FieldArea
          label="Things to Avoid (appended to every scene's negative prompt)"
          placeholder="e.g. extra fingers, modern skyscrapers, daylight, cartoon style, cluttered background"
          value={form.negativePromptLibrary}
          onChange={(v) => setField("negativePromptLibrary", v)}
          testid="field-negativePromptLibrary"
          rows={3}
        />
      </Section>

      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent
          className="rounded-none border-border/50 bg-background"
          data-testid="dialog-confirm-apply"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-widest text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Apply continuity to every unlocked scene?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs leading-relaxed">
              This rewrites <strong>character action</strong>, <strong>wardrobe</strong>,{" "}
              <strong>environment</strong>, <strong>color palette</strong>, and{" "}
              <strong>notes</strong> on every storyboard scene that is not locked. Locked
              scenes are skipped. The continuity row itself stays editable. This action
              cannot be undone — it modifies stored scene data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none uppercase tracking-widest text-xs font-mono">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApply}
              className="rounded-none uppercase tracking-widest text-xs font-mono"
              data-testid="button-confirm-apply"
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
      <CardContent className="p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

interface FieldAreaProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  testid: string;
  rows?: number;
}

function FieldArea({ label, value, placeholder, onChange, testid, rows = 2 }: FieldAreaProps) {
  return (
    <div className="space-y-2">
      <Label className="uppercase tracking-widest text-[10px] text-muted-foreground">
        {label}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-none bg-background/50 border-border/50 font-mono text-sm resize-none"
        data-testid={testid}
      />
    </div>
  );
}

// Export placeholder Input usage to keep the import tree-shaker happy when the
// future single-line variant is needed without retouching imports.
const _Input = Input;
void _Input;

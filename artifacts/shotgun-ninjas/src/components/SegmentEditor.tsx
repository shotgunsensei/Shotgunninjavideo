import { useState } from "react";
import {
  Plus,
  Trash2,
  Scissors,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateSegment,
  useUpdateSegment,
  useDeleteSegment,
  useSplitSegment,
  getGetAnalysisQueryKey,
  getGetTimelineQueryKey,
} from "@workspace/api-client-react";

type Section =
  | "intro"
  | "verse"
  | "pre_chorus"
  | "chorus"
  | "bridge"
  | "drop"
  | "breakdown"
  | "outro";

interface Segment {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  section: string;
  intensity: number;
  emotion: string;
}

const SECTIONS: Section[] = [
  "intro",
  "verse",
  "pre_chorus",
  "chorus",
  "bridge",
  "drop",
  "breakdown",
  "outro",
];

const SECTION_COLORS: Record<string, string> = {
  intro: "bg-zinc-700",
  verse: "bg-indigo-700",
  pre_chorus: "bg-purple-700",
  chorus: "bg-primary",
  bridge: "bg-accent",
  drop: "bg-red-600",
  breakdown: "bg-yellow-700",
  outro: "bg-zinc-600",
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function intensityLabel(i: number): "Low" | "Medium" | "High" {
  if (i >= 0.7) return "High";
  if (i >= 0.4) return "Medium";
  return "Low";
}

export function SegmentEditor({
  projectId,
  segments,
  durationSec,
}: {
  projectId: string;
  segments: Segment[];
  durationSec: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmotion, setEditEmotion] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetTimelineQueryKey(projectId) });
  };

  const createSeg = useCreateSegment();
  const updateSeg = useUpdateSegment();
  const deleteSeg = useDeleteSegment();
  const splitSeg = useSplitSegment();

  const handleAdd = () => {
    if (segments.length === 0) {
      createSeg.mutate(
        {
          id: projectId,
          data: { startSec: 0, endSec: Math.min(15, durationSec), section: "verse", intensity: 0.5, emotion: "drive" },
        },
        {
          onSuccess: () => {
            toast({ title: "Segment added" });
            invalidate();
          },
        },
      );
      return;
    }
    // Insert after last segment, taking up the remaining tail (or carving 10s if at end)
    const last = segments[segments.length - 1]!;
    const tailStart = last.endSec;
    const tailEnd = Math.min(durationSec, tailStart + 10);
    if (tailEnd <= tailStart + 0.5) {
      toast({
        variant: "destructive",
        title: "No room",
        description: "Split an existing segment instead — there's no space left in the timeline.",
      });
      return;
    }
    createSeg.mutate(
      {
        id: projectId,
        data: { startSec: tailStart, endSec: tailEnd, section: "verse", intensity: 0.5, emotion: "drive" },
      },
      {
        onSuccess: () => {
          toast({ title: "Segment added" });
          invalidate();
        },
      },
    );
  };

  const handleSplit = (id: string) => {
    splitSeg.mutate(
      { segmentId: id, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Segment split", description: "Two new segments at the midpoint." });
          invalidate();
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    if (segments.length <= 1) {
      toast({ variant: "destructive", title: "Can't delete the last segment" });
      return;
    }
    deleteSeg.mutate(
      { segmentId: id },
      {
        onSuccess: () => {
          toast({ title: "Segment removed" });
          invalidate();
        },
      },
    );
  };

  const handleSection = (id: string, section: Section) => {
    updateSeg.mutate(
      { segmentId: id, data: { section } },
      {
        onSuccess: () => invalidate(),
      },
    );
  };

  const handleIntensity = (id: string, intensity: number) => {
    updateSeg.mutate(
      { segmentId: id, data: { intensity } },
      {
        onSuccess: () => invalidate(),
      },
    );
  };

  const startRename = (seg: Segment) => {
    setEditingId(seg.id);
    setEditEmotion(seg.emotion);
  };

  const saveRename = (id: string) => {
    updateSeg.mutate(
      { segmentId: id, data: { emotion: editEmotion } },
      {
        onSuccess: () => {
          setEditingId(null);
          invalidate();
        },
      },
    );
  };

  const isMutating =
    createSeg.isPending || updateSeg.isPending || deleteSeg.isPending || splitSeg.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="uppercase tracking-widest text-sm font-bold">Manual Timeline Editor</h3>
          <p className="text-[11px] font-mono text-muted-foreground mt-1">
            {segments.length} segment{segments.length === 1 ? "" : "s"} · {formatTime(durationSec)} total
          </p>
        </div>
        <Button
          onClick={handleAdd}
          disabled={isMutating}
          variant="outline"
          size="sm"
          className="rounded-none uppercase tracking-widest text-xs border-primary/40 hover:bg-primary/10"
        >
          <Plus className="w-3 h-3 mr-2" /> Add Segment
        </Button>
      </div>

      <div className="space-y-2">
        {segments.length === 0 && (
          <div className="text-center text-sm font-mono text-muted-foreground py-12 border border-dashed border-border/50">
            No segments. Add one to start building your structural timeline.
          </div>
        )}
        {segments.map((seg) => {
          const colorClass = SECTION_COLORS[seg.section] ?? "bg-zinc-600";
          const isEditing = editingId === seg.id;
          return (
            <div
              key={seg.id}
              className="border border-border/50 bg-card/20 hover:border-border transition-colors"
            >
              <div className="flex items-stretch">
                <div className={`w-1 ${colorClass}`} />
                <div className="flex-1 p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-1 font-mono text-xs">
                    <div className="text-muted-foreground text-[9px] uppercase">Idx</div>
                    <div className="text-primary font-bold text-base">#{seg.index + 1}</div>
                  </div>

                  <div className="md:col-span-2 font-mono text-xs">
                    <div className="text-muted-foreground text-[9px] uppercase">Time</div>
                    <div>
                      {formatTime(seg.startSec)} – {formatTime(seg.endSec)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {(seg.endSec - seg.startSec).toFixed(1)}s
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-muted-foreground text-[9px] uppercase font-mono mb-1">Section</div>
                    <Select
                      value={seg.section}
                      onValueChange={(v) => handleSection(seg.id, v as Section)}
                    >
                      <SelectTrigger className="rounded-none h-8 text-xs uppercase tracking-wider font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        {SECTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="rounded-none uppercase text-xs font-mono">
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[9px] uppercase font-mono">Intensity</span>
                      <span className="text-[10px] font-mono text-primary">
                        {Math.round(seg.intensity * 100)}% / {intensityLabel(seg.intensity)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={seg.intensity}
                      onChange={(e) => handleIntensity(seg.id, Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-muted-foreground text-[9px] uppercase font-mono mb-1">Emotion</div>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Input
                          value={editEmotion}
                          onChange={(e) => setEditEmotion(e.target.value)}
                          className="rounded-none h-8 text-xs font-mono"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(seg.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => saveRename(seg.id)}
                          className="text-primary hover:text-primary/80 p-1"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRename(seg)}
                        className="font-mono text-xs hover:text-primary transition-colors text-left flex items-center gap-1 group"
                      >
                        <span className="truncate">{seg.emotion}</span>
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    )}
                  </div>

                  <div className="md:col-span-2 flex items-center justify-end gap-1">
                    <Button
                      onClick={() => handleSplit(seg.id)}
                      disabled={isMutating || seg.endSec - seg.startSec < 1}
                      variant="ghost"
                      size="icon"
                      className="rounded-none h-8 w-8 hover:bg-accent/20"
                      title="Split at midpoint"
                    >
                      <Scissors className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(seg.id)}
                      disabled={isMutating}
                      variant="ghost"
                      size="icon"
                      className="rounded-none h-8 w-8 hover:bg-red-950/40 hover:text-red-400"
                      title="Delete segment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isMutating && (
        <div className="flex items-center justify-center text-xs font-mono text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Syncing…
        </div>
      )}
    </div>
  );
}

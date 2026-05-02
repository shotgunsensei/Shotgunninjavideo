import { useState, useEffect, useMemo, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mic2,
  Wand2,
  Save,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  Clock3,
  AlignLeft,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  useGetLyrics,
  useSaveLyrics,
  useParseLyrics,
  useUpdateLyricLine,
  useDeleteLyricLine,
  useAutoAssignLyrics,
  useGetStoryboard,
  useGenerateStoryboard,
  useGetProject,
  getGetLyricsQueryKey,
  getGetStoryboardQueryKey,
  getGetProjectQueryKey,
  type LyricLine,
} from "@workspace/api-client-react";

function fmtTime(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || isNaN(sec)) return "--:--";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const ws = Math.floor(s).toString().padStart(2, "0");
  const cs = Math.floor((s - Math.floor(s)) * 100)
    .toString()
    .padStart(2, "0");
  return `${m.toString().padStart(2, "0")}:${ws}.${cs}`;
}

function parseTimeInput(input: string): number | null {
  if (!input || !input.trim()) return null;
  const m = input.trim().match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (!m) return null;
  const min = parseInt(m[1] ?? "0", 10);
  const sec = parseInt(m[2] ?? "0", 10);
  let frac = 0;
  const csRaw = m[3];
  if (csRaw !== undefined) {
    if (csRaw.length === 3) frac = parseInt(csRaw, 10) / 1000;
    else if (csRaw.length === 2) frac = parseInt(csRaw, 10) / 100;
    else frac = parseInt(csRaw, 10) / 10;
  }
  return min * 60 + sec + frac;
}

export default function LyricsPage() {
  const [, params] = useRoute("/projects/:id/lyrics");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const { data: scenes = [] } = useGetStoryboard(projectId, {
    query: { enabled: !!projectId, queryKey: getGetStoryboardQueryKey(projectId) },
  });

  const {
    data: serverLines = [],
    isLoading,
    isSuccess,
  } = useGetLyrics(projectId, {
    query: { enabled: !!projectId, queryKey: getGetLyricsQueryKey(projectId) },
  });

  const [raw, setRaw] = useState("");
  const [draftLines, setDraftLines] = useState<
    Array<{
      id: string | null;
      text: string;
      timestampSec: number | null;
      sceneId: string | null;
    }>
  >([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const hydratedForProject = useRef<string | null>(null);

  function hydrateFromServer(lines: LyricLine[]) {
    setDraftLines(
      lines.map((l) => ({
        id: l.id,
        text: l.text,
        timestampSec: l.timestampSec ?? null,
        sceneId: l.sceneId ?? null,
      })),
    );
  }

  // Hydrate once per project from the server snapshot — but only AFTER the
  // query has actually resolved, so we don't lock in the empty default and
  // then ignore the real data when it arrives. After hydration the draft is
  // owned by user edits + the response of explicit mutations
  // (save/auto-assign/delete/parse), so we never silently stomp pending
  // changes nor hold onto stale row ids after a save replaces them.
  useEffect(() => {
    if (!projectId) return;
    if (!isSuccess) return;
    if (hydratedForProject.current === projectId) return;
    hydrateFromServer(serverLines);
    hydratedForProject.current = projectId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isSuccess, serverLines]);

  const hasTimestamps = useMemo(
    () => draftLines.some((l) => l.timestampSec !== null && l.timestampSec !== undefined),
    [draftLines],
  );
  const isDirty = useMemo(() => {
    if (draftLines.length !== serverLines.length) return true;
    return draftLines.some((d, i) => {
      const s = serverLines[i];
      if (!s) return true;
      return (
        d.text !== s.text ||
        (d.timestampSec ?? null) !== (s.timestampSec ?? null) ||
        (d.sceneId ?? null) !== (s.sceneId ?? null)
      );
    });
  }, [draftLines, serverLines]);

  const parseM = useParseLyrics();
  const saveM = useSaveLyrics();
  const updateLineM = useUpdateLyricLine();
  const deleteLineM = useDeleteLyricLine();
  const autoAssignM = useAutoAssignLyrics();
  const generateM = useGenerateStoryboard();

  function invalidateLyrics() {
    queryClient.invalidateQueries({ queryKey: getGetLyricsQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetStoryboardQueryKey(projectId) });
  }

  async function handleParse() {
    if (!raw.trim()) {
      toast({ title: "Paste lyrics first", variant: "destructive" });
      return;
    }
    try {
      const result = await parseM.mutateAsync({ id: projectId, data: { raw } });
      setDraftLines(
        result.lines.map((l) => ({
          id: null,
          text: l.text,
          timestampSec: l.timestampSec ?? null,
          sceneId: null,
        })),
      );
      toast({
        title: result.hasTimestamps
          ? `Parsed ${result.lines.length} timestamped lines`
          : `Parsed ${result.lines.length} plain lines`,
        description: result.hasTimestamps
          ? "Lyrics will auto-align to scene time windows."
          : "You can manually assign each line to a scene below.",
      });
    } catch (err) {
      toast({
        title: "Failed to parse lyrics",
        description: err instanceof Error ? err.message : "Check the format and try again.",
        variant: "destructive",
      });
    }
  }

  async function handleSave() {
    try {
      const fresh = await saveM.mutateAsync({
        id: projectId,
        data: {
          lines: draftLines.map((l) => ({
            text: l.text,
            timestampSec: l.timestampSec,
            sceneId: l.sceneId,
          })),
        },
      });
      // Replace draft with the canonical server response so row ids align with
      // the freshly-inserted rows (the PUT does delete+insert and re-issues ids).
      hydrateFromServer(fresh);
      invalidateLyrics();
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      toast({ title: "Lyrics saved", description: `${fresh.length} lines persisted.` });
    } catch (err) {
      // mutateAsync rethrows — surface a destructive toast instead of leaving
      // the user with a silent unhandled promise rejection.
      toast({
        title: "Failed to save lyrics",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  }

  function updateDraft(idx: number, patch: Partial<(typeof draftLines)[number]>) {
    setDraftLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addDraftLine() {
    setDraftLines((prev) => [
      ...prev,
      { id: null, text: "", timestampSec: null, sceneId: null },
    ]);
  }

  async function handleDeleteDraft(idx: number) {
    const line = draftLines[idx];
    if (!line) return;
    try {
      if (line.id) {
        // Persist deletion immediately if it exists on server
        const remaining = await deleteLineM.mutateAsync({ lineId: line.id });
        hydrateFromServer(remaining);
        invalidateLyrics();
      } else {
        setDraftLines((prev) => prev.filter((_, i) => i !== idx));
      }
      setPendingDeleteId(null);
      toast({ title: "Line removed" });
    } catch (err) {
      toast({
        title: "Failed to remove line",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  }

  async function handleAutoAssign() {
    if (scenes.length === 0) {
      toast({
        title: "Generate a storyboard first",
        description: "We need scenes to assign lyrics to.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (isDirty) await handleSave();
      const fresh = await autoAssignM.mutateAsync({ id: projectId });
      hydrateFromServer(fresh);
      invalidateLyrics();
      toast({ title: "Lyrics auto-assigned to scenes" });
    } catch (err) {
      toast({
        title: "Auto-assign failed",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  }

  async function handleImproveStoryboard() {
    if (scenes.length === 0) {
      toast({
        title: "No storyboard yet",
        description: "Generate a storyboard from the Storyboard page first.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (isDirty) await handleSave();
      await generateM.mutateAsync({
        id: projectId,
        data: {
          lyrics: draftLines.map((l) => l.text).join("\n"),
          force: false,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetStoryboardQueryKey(projectId) });
      toast({
        title: "Storyboard refreshed",
        description: "Unlocked scenes were re-imagined using your lyrics.",
      });
    } catch (err) {
      toast({
        title: "Failed to refresh storyboard",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  }

  const sceneLookup = useMemo(() => {
    const m = new Map<string, { idx: number; title: string; startSec: number; endSec: number }>();
    scenes.forEach((s, i) => {
      m.set(s.id, { idx: i, title: s.title, startSec: s.startSec, endSec: s.endSec });
    });
    return m;
  }, [scenes]);

  function sceneFor(line: (typeof draftLines)[number]): { idx: number; title: string } | null {
    if (line.timestampSec !== null && line.timestampSec !== undefined) {
      const found = scenes.find(
        (s) => s.startSec <= (line.timestampSec ?? -1) && (line.timestampSec ?? -1) < s.endSec,
      );
      if (found) {
        const meta = sceneLookup.get(found.id);
        return meta ? { idx: meta.idx, title: meta.title } : null;
      }
      return null;
    }
    if (line.sceneId) {
      const meta = sceneLookup.get(line.sceneId);
      return meta ? { idx: meta.idx, title: meta.title } : null;
    }
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 text-xs uppercase font-mono tracking-widest text-muted-foreground hover:text-foreground"
          data-testid="link-back-hub"
        >
          <ArrowLeft className="w-3 h-3" /> Project Hub
        </Link>
        <Link
          href={`/projects/${projectId}/storyboard`}
          className="flex items-center gap-2 text-xs uppercase font-mono tracking-widest text-muted-foreground hover:text-foreground"
          data-testid="link-storyboard"
        >
          <Film className="w-3 h-3" /> Storyboard
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Mic2 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">Lyrics</h1>
        </div>
        <p className="text-sm text-muted-foreground font-mono leading-relaxed max-w-2xl">
          {project?.title ? `"${project.title}" — ` : ""}paste your lyrics, with or without
          timestamps. Timestamped lyrics auto-align to scene time windows; plain lyrics can
          be hand-assigned to scenes.
        </p>
      </header>

      {/* Import box */}
      <Card className="rounded-none border-border/40 bg-card/30">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <h2 className="text-sm uppercase font-mono tracking-widest text-foreground">
                Import / Paste
              </h2>
              <p className="text-xs font-mono text-muted-foreground">
                Recognised: <code>[mm:ss]</code>, <code>[mm:ss.cs]</code>, <code>[hh:mm:ss]</code>.
                Untimed lines work too.
              </p>
            </div>
            <Button
              onClick={handleParse}
              disabled={parseM.isPending || !raw.trim()}
              className="rounded-none uppercase tracking-widest text-xs"
              data-testid="button-parse"
            >
              {parseM.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5 mr-2" />
              )}
              Parse Lyrics
            </Button>
          </div>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={
              "[00:03.30] This the band of record\n[00:06.10] This the rooftop record\n[00:10.50] We don't ride the wave we are the wave"
            }
            rows={8}
            className="rounded-none font-mono text-sm bg-background/60"
            data-testid="textarea-raw-lyrics"
          />
        </div>
      </Card>

      {/* Editable list */}
      <Card className="rounded-none border-border/40">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <AlignLeft className="w-4 h-4 text-accent" />
              <h2 className="text-sm uppercase font-mono tracking-widest">
                {hasTimestamps ? "Timestamped Lines" : "Plain Lines"}
                <Badge
                  variant="outline"
                  className="ml-2 rounded-none border-border/50 font-mono text-[10px]"
                  data-testid="badge-line-count"
                >
                  {draftLines.length}
                </Badge>
              </h2>
              {hasTimestamps && (
                <Badge className="rounded-none bg-primary/15 text-primary border-primary/30 text-[10px] font-mono uppercase tracking-widest">
                  Auto-aligned by time
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!hasTimestamps && draftLines.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAutoAssign}
                  disabled={autoAssignM.isPending || saveM.isPending || scenes.length === 0}
                  className="rounded-none uppercase tracking-widest text-[10px]"
                  data-testid="button-auto-assign"
                >
                  {autoAssignM.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                  )}
                  Auto-assign to scenes
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={addDraftLine}
                className="rounded-none uppercase tracking-widest text-[10px]"
                data-testid="button-add-line"
              >
                <Plus className="w-3.5 h-3.5 mr-2" /> Add line
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveM.isPending || !isDirty}
                className="rounded-none uppercase tracking-widest text-[10px]"
                data-testid="button-save-lyrics"
              >
                {saveM.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-2" />
                )}
                {isDirty ? "Save Changes" : "Saved"}
              </Button>
            </div>
          </div>

          {isLoading && draftLines.length === 0 ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : draftLines.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground font-mono border border-dashed border-border/40">
              No lyrics yet. Paste raw text above and hit{" "}
              <span className="text-foreground">Parse</span>.
            </div>
          ) : (
            <div className="space-y-2">
              {draftLines.map((line, idx) => {
                const matchedScene = sceneFor(line);
                return (
                  <div
                    key={line.id ?? `new-${idx}`}
                    className="grid grid-cols-12 gap-2 items-start border border-border/30 bg-background/40 p-2"
                    data-testid={`lyric-row-${idx}`}
                  >
                    <div className="col-span-3 sm:col-span-2 flex flex-col gap-1">
                      <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground flex items-center gap-1">
                        <Clock3 className="w-3 h-3" /> Time
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="--:--"
                        value={
                          line.timestampSec !== null && line.timestampSec !== undefined
                            ? fmtTime(line.timestampSec)
                            : ""
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v.trim()) {
                            updateDraft(idx, { timestampSec: null });
                            return;
                          }
                          const parsed = parseTimeInput(v);
                          updateDraft(idx, {
                            timestampSec: parsed,
                          });
                        }}
                        className="rounded-none h-8 font-mono text-xs bg-background"
                        data-testid={`input-time-${idx}`}
                      />
                    </div>
                    <div className="col-span-9 sm:col-span-7 flex flex-col gap-1">
                      <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                        Lyric
                      </Label>
                      <Input
                        value={line.text}
                        onChange={(e) => updateDraft(idx, { text: e.target.value })}
                        className="rounded-none h-8 text-sm"
                        data-testid={`input-text-${idx}`}
                      />
                    </div>
                    <div className="col-span-10 sm:col-span-2 flex flex-col gap-1">
                      <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                        Scene
                      </Label>
                      {line.timestampSec !== null && line.timestampSec !== undefined ? (
                        <div
                          className="h-8 px-2 flex items-center text-[11px] font-mono text-muted-foreground bg-background/60 border border-border/30 truncate"
                          data-testid={`scene-auto-${idx}`}
                        >
                          {matchedScene
                            ? `#${(matchedScene.idx + 1)
                                .toString()
                                .padStart(2, "0")} ${matchedScene.title}`
                            : "auto: no match"}
                        </div>
                      ) : (
                        <Select
                          value={line.sceneId ?? "__none__"}
                          onValueChange={(v) =>
                            updateDraft(idx, { sceneId: v === "__none__" ? null : v })
                          }
                        >
                          <SelectTrigger
                            className="rounded-none h-8 text-[11px] font-mono"
                            data-testid={`select-scene-${idx}`}
                          >
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {scenes.map((s, sidx) => (
                              <SelectItem key={s.id} value={s.id}>
                                #{(sidx + 1).toString().padStart(2, "0")} {s.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end justify-end h-full">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          line.id ? setPendingDeleteId(line.id) : handleDeleteDraft(idx)
                        }
                        className="rounded-none h-8 w-8 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                        title="Delete line"
                        aria-label={`Delete lyric line ${idx + 1}`}
                        data-testid={`button-delete-${idx}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Improve storyboard CTA */}
      <Card className="rounded-none border-accent/30 bg-accent/5">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <h3 className="text-sm uppercase font-mono tracking-widest text-accent flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Use Lyrics to Improve Storyboard
            </h3>
            <p className="text-xs font-mono text-muted-foreground mt-1 max-w-xl">
              Saves lyrics, then regenerates unlocked scenes so each one's description and
              AI prompt incorporates the lyrics from its time window.
            </p>
          </div>
          <Button
            onClick={handleImproveStoryboard}
            disabled={
              saveM.isPending ||
              generateM.isPending ||
              draftLines.length === 0
            }
            className="rounded-none uppercase tracking-widest text-xs whitespace-nowrap"
            data-testid="button-improve-storyboard"
          >
            {generateM.isPending || saveM.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 mr-2" />
            )}
            Improve Storyboard
          </Button>
        </div>
      </Card>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
      >
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lyric line?</AlertDialogTitle>
            <AlertDialogDescription>
              The line will be removed permanently from this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const id = pendingDeleteId;
                const idx = draftLines.findIndex((l) => l.id === id);
                if (idx >= 0) handleDeleteDraft(idx);
              }}
              data-testid="button-confirm-delete-line"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suppress unused var warning when LyricLine type isn't referenced */}
      <span className="hidden">{(undefined as unknown as LyricLine | undefined)?.id}</span>
    </div>
  );
}

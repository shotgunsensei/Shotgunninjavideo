import { useState, useRef, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload as UploadIcon,
  FileAudio,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  useUploadAudio,
  getGetProjectQueryKey,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { putAudio, deleteAudio } from "@/lib/audioStorage";

const ACCEPTED = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/flac", "audio/x-flac", "audio/ogg"];
const ACCEPTED_HINT = "MP3, WAV, M4A, FLAC, OGG";
const MAX_BYTES = 100 * 1024 * 1024; // 100MB

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(s: number) {
  if (!isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function detectFormat(file: File): string {
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "AUDIO";
  return ext;
}

export default function UploadAudio() {
  const [, params] = useRoute("/projects/:id/upload");
  const [, navigate] = useLocation();
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const uploadAudio = useUploadAudio();

  useEffect(() => {
    return () => {
      // no-op cleanup, blob URLs handled inline
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    setProbeError(null);
    setDuration(null);

    if (file.size > MAX_BYTES) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: `Max ${formatBytes(MAX_BYTES)}. Yours is ${formatBytes(file.size)}.`,
      });
      return;
    }

    const looksLikeAudio =
      file.type.startsWith("audio/") ||
      ACCEPTED.includes(file.type) ||
      /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name);

    if (!looksLikeAudio) {
      toast({
        variant: "destructive",
        title: "Unsupported file",
        description: `Please drop ${ACCEPTED_HINT}.`,
      });
      return;
    }

    setSelectedFile(file);

    // Probe duration via HTMLAudioElement
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      if (isFinite(d) && d > 0) {
        setDuration(d);
      } else {
        setProbeError("Could not read audio duration. The browser may not support this format.");
      }
      URL.revokeObjectURL(objectUrl);
    };
    audio.onerror = () => {
      setProbeError(
        "This browser couldn't decode the file for preview. Analysis may still work — try uploading anyway.",
      );
      URL.revokeObjectURL(objectUrl);
    };
  };

  const handleClear = () => {
    setSelectedFile(null);
    setDuration(null);
    setProbeError(null);
    setStorageStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile || !projectId) return;
    const file = selectedFile;
    const dur = duration ?? 0;

    setStorageStatus("saving");
    try {
      // Persist file blob to IndexedDB so analysis page can re-analyze without re-upload
      await deleteAudio(projectId).catch(() => {});
      await putAudio(projectId, {
        blob: file,
        fileName: file.name,
        mimeType: file.type || "audio/mpeg",
        sizeBytes: file.size,
        durationSec: dur,
      });
      setStorageStatus("saved");
    } catch (err) {
      setStorageStatus("error");
      toast({
        variant: "destructive",
        title: "Local storage failed",
        description:
          "Could not cache the audio in your browser for re-analysis. Upload will still proceed.",
      });
    }

    uploadAudio.mutate(
      {
        id: projectId,
        data: {
          fileName: file.name,
          mimeType: file.type || "audio/mpeg",
          sizeBytes: file.size,
          durationSec: dur > 0 ? dur : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Source registered",
            description: "Routing to deep analysis.",
          });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(projectId) });
          // Auto-advance to analysis
          setTimeout(() => navigate(`/projects/${projectId}/analysis`), 600);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: "Could not register the audio file. Try again.",
          });
        },
      },
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase">Source Injection</h1>
        <p className="text-muted-foreground font-mono text-sm">
          Upload master audio file. Analysis runs in your browser — your file never leaves the device.
        </p>
      </div>

      {uploadAudio.isSuccess ? (
        <Card className="bg-primary/5 border-primary/30 rounded-none">
          <CardContent className="p-12 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(219,39,119,0.5)]">
              <FileAudio className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-bold uppercase tracking-wider mb-2">Source Registered</h3>
              <p className="text-muted-foreground font-mono">
                File cached locally for deep analysis. Routing now…
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="rounded-none uppercase tracking-widest font-bold min-w-[200px] mt-4"
            >
              <Link href={`/projects/${projectId}/analysis`}>
                Proceed to Analysis <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={`rounded-none border-dashed border-2 transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/50 bg-card/20 hover:border-border hover:bg-card/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
        >
          <CardContent className="p-10 flex flex-col items-center text-center space-y-6">
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <div className="w-20 h-20 rounded-full bg-background border border-border/50 flex items-center justify-center text-muted-foreground">
              <UploadIcon className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold uppercase tracking-wider mb-2">Drag & Drop Audio</h3>
              <p className="text-muted-foreground font-mono text-sm max-w-sm mx-auto">
                {ACCEPTED_HINT} supported. Max {formatBytes(MAX_BYTES)}.
                <br />
                Browser-side decode extracts BPM, structure, and emotional intensity.
              </p>
            </div>

            {selectedFile ? (
              <div className="w-full max-w-md border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-primary truncate">
                      {selectedFile.name}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground mt-2 uppercase">
                      <div>
                        <div className="opacity-60">Size</div>
                        <div className="text-foreground">{formatBytes(selectedFile.size)}</div>
                      </div>
                      <div>
                        <div className="opacity-60">Format</div>
                        <div className="text-foreground">{detectFormat(selectedFile)}</div>
                      </div>
                      <div>
                        <div className="opacity-60">Duration</div>
                        <div className="text-foreground">
                          {duration === null ? "…" : formatTime(duration)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleClear}
                    className="text-muted-foreground hover:text-foreground p-1"
                    aria-label="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {probeError && (
                  <div className="flex items-start gap-2 text-[11px] font-mono text-yellow-500/90 border border-yellow-600/30 bg-yellow-950/20 p-2">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{probeError}</span>
                  </div>
                )}

                {storageStatus === "saved" && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-primary">
                    <CheckCircle2 className="w-3 h-3" /> Cached locally for analysis
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={uploadAudio.isPending || duration === null}
                  className="w-full rounded-none uppercase tracking-wider text-xs"
                >
                  {uploadAudio.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registering…
                    </>
                  ) : (
                    <>
                      Register & Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-none uppercase tracking-widest text-xs border-border/50 hover:bg-white/5"
              >
                Browse Files
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

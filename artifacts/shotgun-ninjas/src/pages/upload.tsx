import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Upload as UploadIcon, FileAudio, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUploadAudio, getGetProjectQueryKey } from "@workspace/api-client-react";

export default function UploadAudio() {
  const [, params] = useRoute("/projects/:id/upload");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const uploadAudio = useUploadAudio();

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an audio file (MP3, WAV, etc)."
      });
      return;
    }

    setSelectedFile(file);

    // Read duration
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);
    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
      URL.revokeObjectURL(objectUrl);
    };
  };

  const handleUpload = () => {
    if (!selectedFile || !projectId) return;

    uploadAudio.mutate({
      id: projectId,
      data: {
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        sizeBytes: selectedFile.size,
        durationSec: duration || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Audio payload accepted", description: "Ready for analysis." });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        // Navigate or stay, for now stay and show success
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase">Source Injection</h1>
        <p className="text-muted-foreground font-mono text-sm">Upload master audio file</p>
      </div>

      {uploadAudio.isSuccess ? (
        <Card className="bg-primary/5 border-primary/30 rounded-none">
          <CardContent className="p-12 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(219,39,119,0.5)]">
              <FileAudio className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-bold uppercase tracking-wider mb-2">Upload Complete</h3>
              <p className="text-muted-foreground font-mono">Source material registered in system.</p>
            </div>
            <Button asChild size="lg" className="rounded-none uppercase tracking-widest font-bold min-w-[200px] mt-4">
              <Link href={`/projects/${projectId}/analysis`}>
                Proceed to Analysis <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className={`rounded-none border-dashed border-2 transition-all duration-200 ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border/50 bg-card/20 hover:border-border hover:bg-card/40'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
        >
          <CardContent className="p-12 flex flex-col items-center text-center space-y-6">
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="audio/*" 
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
                MP3, WAV, AAC supported. Max 50MB. <br/>
                We extract BPM, structure, and emotional intensity.
              </p>
            </div>

            {selectedFile ? (
              <div className="w-full max-w-sm p-4 border border-primary/30 bg-primary/5 flex items-center justify-between">
                <div className="truncate text-left font-mono text-sm text-primary flex-1 mr-4">
                  {selectedFile.name}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB 
                    {duration && ` // ${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`}
                  </div>
                </div>
                <Button 
                  onClick={handleUpload}
                  disabled={uploadAudio.isPending}
                  className="rounded-none uppercase tracking-wider text-xs shrink-0"
                >
                  {uploadAudio.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload"}
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
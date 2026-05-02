import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Music, Zap, Clapperboard, Download, Edit2, Check, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetProject, 
  getGetProjectQueryKey,
  useUpdateProject,
  useDeleteProject
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

export default function ProjectHub() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: getGetProjectQueryKey(projectId)
    }
  });

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", artist: "", genre: "" });

  useEffect(() => {
    if (project) {
      setEditForm({
        title: project.title,
        artist: project.artist || "",
        genre: project.genre || ""
      });
    }
  }, [project]);

  const handleSave = () => {
    updateProject.mutate({
      id: projectId,
      data: editForm
    }, {
      onSuccess: () => {
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        toast({ title: "Project updated" });
      }
    });
  };

  const handleDelete = () => {
    deleteProject.mutate({ id: projectId }, {
      onSuccess: () => {
        window.location.href = "/dashboard";
      }
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!project) {
    return <div className="text-center p-12 text-muted-foreground font-mono">Project not found</div>;
  }

  const steps = [
    { id: "upload", label: "Audio Upload", icon: Music, path: `/projects/${projectId}/upload`, done: ["uploaded", "analyzed", "storyboarded", "prompted", "exported"].includes(project.status) },
    { id: "analyze", label: "Analysis", icon: Zap, path: `/projects/${projectId}/analysis`, done: ["analyzed", "storyboarded", "prompted", "exported"].includes(project.status) },
    { id: "storyboard", label: "Storyboard", icon: Clapperboard, path: `/projects/${projectId}/storyboard`, done: ["storyboarded", "prompted", "exported"].includes(project.status) },
    { id: "export", label: "Export", icon: Download, path: `/projects/${projectId}/export`, done: ["exported"].includes(project.status) },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border border-border/50 bg-card/20 backdrop-blur relative overflow-hidden">
        <div 
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: project.coverColor || 'var(--color-primary)' }}
        />
        
        <div className="flex-1 w-full relative z-10 pl-2">
          {isEditing ? (
            <div className="space-y-3">
              <Input 
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className="text-2xl font-bold rounded-none h-12 bg-background/50 border-primary"
              />
              <div className="flex gap-2">
                <Input 
                  placeholder="Artist"
                  value={editForm.artist}
                  onChange={e => setEditForm(f => ({ ...f, artist: e.target.value }))}
                  className="rounded-none bg-background/50"
                />
                <Input 
                  placeholder="Genre"
                  value={editForm.genre}
                  onChange={e => setEditForm(f => ({ ...f, genre: e.target.value }))}
                  className="rounded-none bg-background/50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} className="rounded-none uppercase tracking-wider text-xs" disabled={updateProject.isPending}>
                  {updateProject.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin"/> : <Check className="w-3 h-3 mr-2"/>} Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="rounded-none uppercase tracking-wider text-xs">
                  <X className="w-3 h-3 mr-2"/> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tighter uppercase">{project.title}</h1>
                <Badge variant="outline" className="uppercase font-mono text-[10px] rounded-none bg-background/50">
                  {project.status}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-6 w-6 ml-2 rounded-none opacity-50 hover:opacity-100">
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
                {project.artist || 'Unknown Artist'} {project.genre && `// ${project.genre}`}
              </p>
              <div className="text-[10px] text-muted-foreground font-mono mt-4 uppercase">
                ID: {project.id} // Created: {format(new Date(project.createdAt), 'yyyy-MM-dd')}
              </div>
            </div>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="rounded-none uppercase tracking-wider text-xs bg-destructive/20 text-destructive hover:bg-destructive hover:text-white border border-destructive/50">
              <Trash2 className="w-3 h-3 mr-2" /> Delete Project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-none border-destructive/50 bg-black">
            <AlertDialogHeader>
              <AlertDialogTitle className="uppercase tracking-wider">Terminate Project?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All audio, analysis data, storyboards, and prompts will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-none uppercase tracking-wider">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="rounded-none uppercase tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Proceed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {project.audio && (
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Source Material</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground font-mono mb-1">File</div>
                <div className="font-mono text-sm truncate" title={project.audio.fileName}>{project.audio.fileName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground font-mono mb-1">Duration</div>
                <div className="font-mono text-sm">{project.audio.durationSec ? `${Math.floor(project.audio.durationSec / 60)}:${Math.floor(project.audio.durationSec % 60).toString().padStart(2, '0')}` : 'Unknown'}</div>
              </div>
              {project.bpm && (
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-mono mb-1">BPM</div>
                  <div className="font-mono text-sm text-primary">{Math.round(project.bpm)}</div>
                </div>
              )}
              {project.keySignature && (
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-mono mb-1">Key</div>
                  <div className="font-mono text-sm text-accent">{project.keySignature}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-xl font-bold uppercase tracking-widest mb-4">Production Pipeline</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <Link key={step.id} href={step.path}>
              <Card className={`rounded-none border-border/50 cursor-pointer transition-all duration-300 group overflow-hidden relative ${step.done ? 'bg-primary/5 border-primary/30' : 'bg-card/20 hover:bg-card/40'}`}>
                {step.done && <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />}
                <CardContent className="p-6 relative z-10 flex flex-col items-center text-center gap-4">
                  <div className={`p-4 rounded-full border ${step.done ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_-3px_rgba(219,39,119,0.4)]' : 'bg-background border-border text-muted-foreground group-hover:text-foreground'}`}>
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold uppercase tracking-wider text-sm">{step.label}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">
                      {step.done ? 'Complete' : 'Pending'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Loader2, Play, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetStoryboard, 
  useGenerateStoryboard,
  getGetStoryboardQueryKey,
  useGetProject,
  getGetProjectQueryKey
} from "@workspace/api-client-react";

export default function Storyboard() {
  const [, params] = useRoute("/projects/:id/storyboard");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: scenes, isLoading } = useGetStoryboard(projectId, {
    query: { 
      enabled: !!projectId && ["storyboarded", "prompted", "exported"].includes(project?.status || ""), 
      queryKey: getGetStoryboardQueryKey(projectId) 
    }
  });

  const generateStoryboard = useGenerateStoryboard();

  const handleGenerate = () => {
    generateStoryboard.mutate({ id: projectId }, {
      onSuccess: () => {
        toast({ title: "Storyboard generated", description: "Scenes created from acoustic analysis." });
        queryClient.invalidateQueries({ queryKey: getGetStoryboardQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  if (!["analyzed", "storyboarded", "prompted", "exported"].includes(project?.status || "")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border/50 bg-card/10 text-center p-6 max-w-2xl mx-auto mt-12">
        <Clapperboard className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2 uppercase tracking-wider">Analysis Required</h3>
        <p className="text-sm text-muted-foreground font-mono mb-4">Run acoustic analysis before generating storyboard.</p>
      </div>
    );
  }

  if (project?.status === "analyzed" && (!scenes || scenes.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] border border-border/50 bg-card/20 text-center p-12 mx-auto mt-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-50" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 border border-primary/30 rounded-full flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin [animation-duration:3s]" />
            <Clapperboard className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-3xl font-bold mb-4 uppercase tracking-widest">Director's Cut</h3>
          <p className="text-sm text-muted-foreground font-mono mb-8 max-w-lg leading-relaxed">
            Generate a complete beat-synced storyboard. The AI will interpret the emotional map and structural timeline to plan shots, camera movements, and lighting setups.
          </p>
          <Button 
            size="lg" 
            onClick={handleGenerate} 
            disabled={generateStoryboard.isPending}
            className="rounded-none uppercase tracking-widest font-bold px-12 bg-white text-black hover:bg-gray-200"
          >
            {generateStoryboard.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
            {generateStoryboard.isPending ? "Drafting Scenes..." : "Generate Storyboard"}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <Film className="w-8 h-8 text-primary" /> Storyboard
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
            {scenes?.length || 0} Scenes Generated
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleGenerate}
          disabled={generateStoryboard.isPending}
          className="rounded-none uppercase tracking-widest text-xs border-border/50"
        >
          {generateStoryboard.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-2" />}
          Regenerate All
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto pb-8 pt-4">
        <div className="flex gap-6 min-w-max px-2 h-full items-stretch">
          {scenes?.map((scene) => (
            <Link key={scene.id} href={`/projects/${projectId}/scenes/${scene.id}`}>
              <Card className="w-[320px] sm:w-[400px] h-full shrink-0 cursor-pointer group border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/50 transition-all rounded-none relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-50 group-hover:opacity-100 transition-opacity" />
                
                <div className="p-4 border-b border-border/50 flex justify-between items-center bg-black/40">
                  <div className="font-mono text-xs text-primary font-bold">SCENE {String(scene.index).padStart(3, '0')}</div>
                  <div className="font-mono text-[10px] text-muted-foreground bg-background px-2 py-1 border border-border">
                    {Math.floor(scene.startSec / 60)}:{(scene.startSec % 60).toString().padStart(2, '0')} - {Math.floor(scene.endSec / 60)}:{(scene.endSec % 60).toString().padStart(2, '0')}
                  </div>
                </div>

                <CardContent className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold uppercase tracking-wider mb-2 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {scene.title}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed flex-1">
                    {scene.description}
                  </p>

                  <div className="space-y-3 mt-auto pt-4 border-t border-border/50">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-none text-[10px] uppercase font-mono border-primary/30 text-primary/80">
                        {scene.shotType}
                      </Badge>
                      <Badge variant="outline" className="rounded-none text-[10px] uppercase font-mono border-accent/30 text-accent/80">
                        {scene.cameraMovement}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase text-muted-foreground">
                      <div><span className="opacity-50">LOC:</span> {scene.location}</div>
                      <div><span className="opacity-50">LIT:</span> {scene.lighting}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground opacity-50">Palette:</span>
                      <div className="flex gap-1 flex-1">
                        {scene.colorPalette.split(',').slice(0, 4).map((color, i) => (
                          <div 
                            key={i} 
                            className="h-2 flex-1 rounded-sm" 
                            style={{ backgroundColor: color.trim().startsWith('#') ? color.trim() : `var(--color-${['primary','accent','secondary','muted'][i%4]})` }}
                            title={color.trim()}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground p-1">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
// Adding missed imports
import { Film } from "lucide-react";
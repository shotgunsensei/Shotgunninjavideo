import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Save, Sparkles, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { 
  useGetStoryboard, 
  useGetPrompts,
  useUpdateScene,
  useUpdatePrompt,
  useGeneratePrompts,
  getGetStoryboardQueryKey,
  getGetPromptsQueryKey
} from "@workspace/api-client-react";

export default function SceneEditor() {
  const [, params] = useRoute("/projects/:id/scenes/:sceneId");
  const projectId = params?.id as string;
  const sceneId = params?.sceneId as string;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scenes, isLoading: scenesLoading } = useGetStoryboard(projectId, {
    query: { enabled: !!projectId, queryKey: getGetStoryboardQueryKey(projectId) }
  });

  const { data: prompts, isLoading: promptsLoading } = useGetPrompts(projectId, {
    query: { enabled: !!projectId, queryKey: getGetPromptsQueryKey(projectId) }
  });

  const scene = scenes?.find(s => s.id === sceneId);
  const prompt = prompts?.find(p => p.sceneId === sceneId);

  const updateScene = useUpdateScene();
  const updatePrompt = useUpdatePrompt();
  const generatePrompts = useGeneratePrompts();

  // Local state for forms
  const [sceneForm, setSceneForm] = useState<any>({});
  const [promptForm, setPromptForm] = useState<any>({});

  useEffect(() => {
    if (scene) setSceneForm({ ...scene });
    if (prompt) setPromptForm({ ...prompt });
  }, [scene, prompt]);

  const handleSaveScene = () => {
    updateScene.mutate({
      sceneId: sceneId,
      data: {
        title: sceneForm.title,
        description: sceneForm.description,
        shotType: sceneForm.shotType,
        cameraMovement: sceneForm.cameraMovement,
        location: sceneForm.location,
        lighting: sceneForm.lighting,
        colorPalette: sceneForm.colorPalette,
        wardrobe: sceneForm.wardrobe,
        notes: sceneForm.notes
      }
    }, {
      onSuccess: () => {
        toast({ title: "Scene saved", description: "Director's notes updated." });
        queryClient.invalidateQueries({ queryKey: getGetStoryboardQueryKey(projectId) });
      }
    });
  };

  const handleSavePrompt = () => {
    if (!prompt) return;
    updatePrompt.mutate({
      promptId: prompt.id,
      data: {
        text: promptForm.text,
        negativePrompt: promptForm.negativePrompt,
        model: promptForm.model,
        aspectRatio: promptForm.aspectRatio,
        durationSec: Number(promptForm.durationSec)
      }
    }, {
      onSuccess: () => {
        toast({ title: "Prompt saved", description: "Generation parameters updated." });
        queryClient.invalidateQueries({ queryKey: getGetPromptsQueryKey(projectId) });
      }
    });
  };

  const handleGeneratePrompts = () => {
    generatePrompts.mutate({ id: projectId }, {
      onSuccess: () => {
        toast({ title: "Prompts generated", description: "AI prompts created for all scenes." });
        queryClient.invalidateQueries({ queryKey: getGetPromptsQueryKey(projectId) });
      }
    });
  };

  if (scenesLoading || promptsLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!scene) {
    return (
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto mt-24 p-8 border border-dashed border-border/50 bg-card/10 space-y-4">
        <h2 className="text-2xl font-bold uppercase tracking-wider">Scene Not Found</h2>
        <p className="text-sm text-muted-foreground font-mono">
          This scene may have been regenerated or removed. Return to the storyboard to pick a current scene.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button asChild className="rounded-none uppercase tracking-widest">
            <Link href={`/projects/${projectId}/storyboard`}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Storyboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-none uppercase tracking-widest">
            <Link href={`/projects/${projectId}`}>Project Hub</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-none border border-border/50">
            <Link href={`/projects/${projectId}/storyboard`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tighter uppercase">Scene {String(scene.index).padStart(3, '0')}</h1>
              <span className="font-mono text-xs text-muted-foreground bg-card/50 px-2 py-1 border border-border/50">
                {Math.floor(scene.startSec / 60)}:{(scene.startSec % 60).toString().padStart(2, '0')} - {Math.floor(scene.endSec / 60)}:{(scene.endSec % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {!prompt && (
          <Button 
            onClick={handleGeneratePrompts}
            disabled={generatePrompts.isPending}
            className="rounded-none uppercase tracking-widest text-xs font-bold bg-accent hover:bg-accent/90"
          >
            {generatePrompts.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate AI Prompts
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Scene Definition */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <h2 className="text-lg font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <Clapperboard className="w-5 h-5" /> Director's Blueprint
            </h2>
            <Button 
              size="sm" 
              onClick={handleSaveScene} 
              disabled={updateScene.isPending}
              className="rounded-none uppercase tracking-wider text-[10px] h-7"
            >
              {updateScene.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
              Save Scene
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Title</Label>
              <Input 
                value={sceneForm.title || ''} 
                onChange={e => setSceneForm({...sceneForm, title: e.target.value})}
                className="rounded-none bg-background/50 border-border/50 font-bold uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Action / Description</Label>
              <Textarea 
                value={sceneForm.description || ''} 
                onChange={e => setSceneForm({...sceneForm, description: e.target.value})}
                className="rounded-none bg-background/50 border-border/50 min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Shot Type</Label>
                <Input 
                  value={sceneForm.shotType || ''} 
                  onChange={e => setSceneForm({...sceneForm, shotType: e.target.value})}
                  className="rounded-none bg-background/50 border-border/50 font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Camera Movement</Label>
                <Input 
                  value={sceneForm.cameraMovement || ''} 
                  onChange={e => setSceneForm({...sceneForm, cameraMovement: e.target.value})}
                  className="rounded-none bg-background/50 border-border/50 font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Location</Label>
                <Input 
                  value={sceneForm.location || ''} 
                  onChange={e => setSceneForm({...sceneForm, location: e.target.value})}
                  className="rounded-none bg-background/50 border-border/50 font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Lighting</Label>
                <Input 
                  value={sceneForm.lighting || ''} 
                  onChange={e => setSceneForm({...sceneForm, lighting: e.target.value})}
                  className="rounded-none bg-background/50 border-border/50 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Color Palette</Label>
              <Input 
                value={sceneForm.colorPalette || ''} 
                onChange={e => setSceneForm({...sceneForm, colorPalette: e.target.value})}
                className="rounded-none bg-background/50 border-border/50 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Wardrobe</Label>
              <Input 
                value={sceneForm.wardrobe || ''} 
                onChange={e => setSceneForm({...sceneForm, wardrobe: e.target.value})}
                className="rounded-none bg-background/50 border-border/50 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Prompt Generation */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <h2 className="text-lg font-bold uppercase tracking-widest text-accent flex items-center gap-2">
              <ImageIcon className="w-5 h-5" /> AI Generation Params
            </h2>
            {prompt && (
              <Button 
                size="sm" 
                onClick={handleSavePrompt} 
                disabled={updatePrompt.isPending}
                className="rounded-none uppercase tracking-wider text-[10px] h-7 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {updatePrompt.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
                Save Prompt
              </Button>
            )}
          </div>

          {!prompt ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-border/50 bg-card/5">
              <Sparkles className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg uppercase tracking-wider font-bold mb-2">No Prompts Found</h3>
              <p className="text-sm text-muted-foreground font-mono mb-6 max-w-sm">
                Run the prompt generator to convert director's blueprints into optimized AI video generation prompts.
              </p>
              <Button 
                onClick={handleGeneratePrompts}
                disabled={generatePrompts.isPending}
                className="rounded-none uppercase tracking-widest font-bold"
              >
                {generatePrompts.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Generate Now
              </Button>
            </div>
          ) : (
            <div className="space-y-4 bg-card/20 p-6 border border-border/50 relative">
              <div className="absolute top-0 right-0 p-2 font-mono text-[10px] text-muted-foreground uppercase bg-background/50 border-b border-l border-border/50">
                ID: {prompt.id.substring(0,8)}
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono tracking-widest text-accent">Generation Prompt</Label>
                <Textarea 
                  value={promptForm.text || ''} 
                  onChange={e => setPromptForm({...promptForm, text: e.target.value})}
                  className="rounded-none bg-background/80 border-accent/30 min-h-[200px] font-mono text-sm leading-relaxed focus-visible:ring-accent"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Negative Prompt</Label>
                <Textarea 
                  value={promptForm.negativePrompt || ''} 
                  onChange={e => setPromptForm({...promptForm, negativePrompt: e.target.value})}
                  className="rounded-none bg-background/50 border-border/50 min-h-[80px] font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Model</Label>
                  <Select value={promptForm.model} onValueChange={(val) => setPromptForm({...promptForm, model: val})}>
                    <SelectTrigger className="rounded-none bg-background/50 border-border/50 font-mono text-sm">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border/50">
                      <SelectItem value="runway">Runway Gen-3</SelectItem>
                      <SelectItem value="sora">OpenAI Sora</SelectItem>
                      <SelectItem value="kling">Kling</SelectItem>
                      <SelectItem value="pika">Pika Labs</SelectItem>
                      <SelectItem value="luma">Luma Dream Machine</SelectItem>
                      <SelectItem value="generic">Generic/Midjourney</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Aspect Ratio</Label>
                  <Select value={promptForm.aspectRatio} onValueChange={(val) => setPromptForm({...promptForm, aspectRatio: val})}>
                    <SelectTrigger className="rounded-none bg-background/50 border-border/50 font-mono text-sm">
                      <SelectValue placeholder="Ratio" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border/50">
                      <SelectItem value="16:9">16:9 (Cinematic)</SelectItem>
                      <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                      <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      <SelectItem value="21:9">21:9 (Ultrawide)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// adding missing import
import { Clapperboard } from "lucide-react";
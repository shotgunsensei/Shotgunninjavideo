import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Zap, Play, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetAnalysis, 
  useAnalyzeAudio,
  getGetAnalysisQueryKey,
  useGetProject,
  getGetProjectQueryKey
} from "@workspace/api-client-react";

export default function Analysis() {
  const [, params] = useRoute("/projects/:id/analysis");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: analysis, isLoading: analysisLoading } = useGetAnalysis(projectId, {
    query: { enabled: !!projectId && project?.status !== "uploaded" && project?.status !== "draft", queryKey: getGetAnalysisQueryKey(projectId) }
  });

  const analyzeAudio = useAnalyzeAudio();

  const handleAnalyze = () => {
    analyzeAudio.mutate({ id: projectId }, {
      onSuccess: () => {
        toast({ title: "Analysis complete", description: "Audio structure extracted." });
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  if (project?.status === "draft") {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border/50 bg-card/10 text-center p-6 max-w-2xl mx-auto mt-12">
        <Activity className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2 uppercase tracking-wider">No Source Material</h3>
        <p className="text-sm text-muted-foreground font-mono mb-4">Upload an audio file first before running analysis.</p>
      </div>
    );
  }

  if (project?.status === "uploaded" && !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-96 border border-border/50 bg-card/20 text-center p-12 max-w-3xl mx-auto mt-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex flex-col items-center">
          <Zap className="w-16 h-16 text-primary mb-6 animate-pulse shadow-[0_0_30px_rgba(219,39,119,0.5)] rounded-full" />
          <h3 className="text-2xl font-bold mb-3 uppercase tracking-widest">Acoustic Extraction</h3>
          <p className="text-sm text-muted-foreground font-mono mb-8 max-w-md">
            Initialize deep scan. System will map beats, segment structure, and graph emotional intensity over time.
          </p>
          <Button 
            size="lg" 
            onClick={handleAnalyze} 
            disabled={analyzeAudio.isPending}
            className="rounded-none uppercase tracking-widest font-bold px-12 bg-primary hover:bg-primary/90 shadow-[0_0_20px_-5px_rgba(219,39,119,0.5)]"
          >
            {analyzeAudio.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
            {analyzeAudio.isPending ? "Scanning..." : "Execute Scan"}
          </Button>
        </div>
      </div>
    );
  }

  if (analysisLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!analysis) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" /> Analysis Results
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
          Acoustic Profile Extracted
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2">Tempo (BPM)</div>
            <div className="text-3xl font-bold font-mono text-primary">{Math.round(analysis.bpm)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2">Key Signature</div>
            <div className="text-3xl font-bold font-mono text-accent">{analysis.keySignature}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2">Duration</div>
            <div className="text-3xl font-bold font-mono">
              {Math.floor(analysis.durationSec / 60)}:{Math.floor(analysis.durationSec % 60).toString().padStart(2, '0')}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
          <CardContent className="p-6">
            <div className="text-[10px] uppercase text-muted-foreground font-mono mb-2 flex justify-between">
              <span>Overall Energy</span>
              <span>{Math.round(analysis.energy * 100)}%</span>
            </div>
            <Progress value={analysis.energy * 100} className="h-2 rounded-none bg-background mt-4 [&>div]:bg-primary" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm">Structural Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 relative flex items-end w-full border-b border-border bg-background/50">
            {analysis.segments.map((seg, i) => {
              const width = ((seg.endSec - seg.startSec) / analysis.durationSec) * 100;
              const left = (seg.startSec / analysis.durationSec) * 100;
              const height = Math.max(10, seg.intensity * 100);
              
              // Color map for sections
              const colors: Record<string, string> = {
                intro: 'bg-gray-600',
                verse: 'bg-blue-600',
                pre_chorus: 'bg-purple-600',
                chorus: 'bg-primary',
                bridge: 'bg-accent',
                drop: 'bg-red-600',
                breakdown: 'bg-yellow-600',
                outro: 'bg-gray-600',
              };

              const colorClass = colors[seg.section] || 'bg-primary';

              return (
                <div 
                  key={i}
                  className={`absolute bottom-0 border-r border-black/50 ${colorClass} opacity-80 hover:opacity-100 transition-opacity cursor-crosshair group`}
                  style={{ width: `${width}%`, left: `${left}%`, height: `${height}%` }}
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-black border border-border px-2 py-1 text-[10px] font-mono whitespace-nowrap z-10 pointer-events-none">
                    {seg.section.toUpperCase()} <br/>
                    {Math.floor(seg.startSec)}-{Math.floor(seg.endSec)}s ({Math.round(seg.intensity*100)}%)
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground">
            <span>0:00</span>
            <span>{Math.floor(analysis.durationSec / 60)}:{Math.floor(analysis.durationSec % 60).toString().padStart(2, '0')}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm">Emotional Map</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analysis.emotionalMap} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="timeSec" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(val) => `${Math.floor(val)}s`} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'black', borderRadius: 0, border: '1px solid hsl(var(--border))', fontFamily: 'monospace', fontSize: '12px' }}
                labelFormatter={(val) => `Time: ${val}s`}
              />
              <Line type="monotone" dataKey="arousal" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Intensity (Arousal)" />
              <Line type="monotone" dataKey="valence" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Positivity (Valence)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
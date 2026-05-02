import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Download, FileJson, FileText, Clapperboard, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  useListExports, 
  useCreateExport,
  getListExportsQueryKey,
  useGetProject,
  getGetProjectQueryKey
} from "@workspace/api-client-react";

export default function Export() {
  const [, params] = useRoute("/projects/:id/export");
  const projectId = params?.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  const { data: exports, isLoading } = useListExports(projectId, {
    query: { enabled: !!projectId, queryKey: getListExportsQueryKey(projectId) }
  });

  const createExport = useCreateExport();

  const handleCreate = (formatType: 'json' | 'txt' | 'production_plan') => {
    createExport.mutate({
      id: projectId,
      data: { format: formatType }
    }, {
      onSuccess: () => {
        toast({ title: "Export generated", description: `Created ${formatType} payload.` });
        queryClient.invalidateQueries({ queryKey: getListExportsQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  const handleDownload = (content: string, formatType: string) => {
    const ext = formatType === 'json' ? 'json' : 'txt';
    const mime = formatType === 'json' ? 'application/json' : 'text/plain';
    const filename = `${project?.title?.replace(/\s+/g, '_').toLowerCase() || 'project'}_export.${ext}`;
    
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isReady = ["storyboarded", "prompted", "exported"].includes(project?.status || "");

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border/50 bg-card/10 text-center p-6 max-w-2xl mx-auto mt-12">
        <Download className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2 uppercase tracking-wider">Export Unavailable</h3>
        <p className="text-sm text-muted-foreground font-mono mb-4">Complete storyboard generation before exporting plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
          <Download className="w-8 h-8 text-primary" /> Delivery & Export
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
          Generate production assets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border/50 bg-card/20 hover:bg-card/40 transition-colors group">
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <FileJson className="w-4 h-4" /> JSON Payload
            </CardTitle>
            <CardDescription className="text-xs font-mono">Raw system data for API integration</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full rounded-none uppercase tracking-widest text-xs font-bold"
              onClick={() => handleCreate('json')}
              disabled={createExport.isPending}
            >
              Generate JSON
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/50 bg-card/20 hover:bg-card/40 transition-colors group">
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-accent">
              <FileText className="w-4 h-4" /> Text Prompts
            </CardTitle>
            <CardDescription className="text-xs font-mono">Sequential list of generation prompts</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full rounded-none uppercase tracking-widest text-xs font-bold"
              onClick={() => handleCreate('txt')}
              disabled={createExport.isPending}
            >
              Generate TXT
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-none border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors group relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="relative z-10">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-white">
              <Clapperboard className="w-4 h-4" /> Production Plan
            </CardTitle>
            <CardDescription className="text-xs font-mono">Comprehensive human-readable shot list</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <Button 
              className="w-full rounded-none uppercase tracking-widest text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_-3px_rgba(219,39,119,0.4)]"
              onClick={() => handleCreate('production_plan')}
              disabled={createExport.isPending}
            >
              Generate Plan
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="pt-8 border-t border-border/50">
        <h2 className="text-xl font-bold uppercase tracking-widest mb-6">Export History</h2>
        
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : exports?.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground font-mono text-sm bg-card/10 border border-dashed border-border/50">
            No exports generated yet.
          </div>
        ) : (
          <div className="space-y-4">
            {exports?.map(exp => (
              <div key={exp.id} className="flex flex-col sm:flex-row gap-4 p-4 border border-border/50 bg-card/20 items-start sm:items-center justify-between group hover:bg-card/40 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-background flex items-center justify-center border border-border">
                    {exp.format === 'json' ? <FileJson className="w-5 h-5 text-primary" /> : 
                     exp.format === 'txt' ? <FileText className="w-5 h-5 text-accent" /> : 
                     <Clapperboard className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <div className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                      {exp.format.replace('_', ' ')}
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">
                      Generated: {format(new Date(exp.createdAt), 'MMM dd, yyyy HH:mm')} // ID: {exp.id.substring(0,8)}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none uppercase tracking-wider text-xs border-border/50 bg-background/50 hover:bg-primary hover:text-primary-foreground hover:border-primary w-full sm:w-auto"
                  onClick={() => handleDownload(exp.content, exp.format)}
                >
                  <Download className="w-3 h-3 mr-2" /> Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
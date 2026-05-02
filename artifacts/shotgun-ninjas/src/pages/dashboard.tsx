import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Plus, FolderOpen, Clapperboard, Zap, Film, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  useGetStatsOverview, 
  useGetRecentActivity, 
  useListProjects 
} from "@workspace/api-client-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStatsOverview();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase">Dashboard</h1>
          <p className="text-muted-foreground font-mono text-sm">System Overview // Status: Online</p>
        </div>
        <Button asChild className="rounded-none uppercase tracking-widest font-bold">
          <Link href="/projects/new">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: stats?.totalProjects, icon: FolderOpen },
          { label: "Analyzed Tracks", value: stats?.analyzedProjects, icon: Zap },
          { label: "Generated Scenes", value: stats?.totalScenes, icon: Film },
          { label: "AI Prompts", value: stats?.totalPrompts, icon: Image },
        ].map((stat, i) => (
          <Card key={i} className="bg-card/50 backdrop-blur border-border/50 rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {statsLoading ? "..." : stat.value || 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Projects Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-accent" /> Active Projects
          </h2>
          
          {projectsLoading ? (
            <div className="h-64 flex items-center justify-center border border-border/50 bg-card/30">
              <span className="font-mono text-muted-foreground animate-pulse">Loading data...</span>
            </div>
          ) : projects?.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border/50 bg-card/10 text-center p-6">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No projects found</h3>
              <p className="text-sm text-muted-foreground mb-4">Start by creating a new video project.</p>
              <Button asChild variant="outline" className="rounded-none uppercase tracking-wider">
                <Link href="/projects/new">Create Project</Link>
              </Button>
            </div>
          ) : (
            <motion.div 
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {projects?.map(project => (
                <motion.div key={project.id} variants={item}>
                  <Link href={`/projects/${project.id}`}>
                    <Card className="group cursor-pointer bg-card/40 hover:bg-card border-border/50 hover:border-primary/50 transition-all rounded-none overflow-hidden relative">
                      <div 
                        className="absolute top-0 left-0 w-1 h-full transition-colors group-hover:bg-primary"
                        style={{ backgroundColor: project.coverColor || 'var(--color-border)' }}
                      />
                      <CardHeader className="pl-6 pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">
                            {project.title}
                          </CardTitle>
                          <Badge variant="outline" className="uppercase text-[10px] font-mono rounded-none">
                            {project.status}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs uppercase tracking-wider">
                          {project.artist || 'Unknown Artist'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pl-6">
                        <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                          <span>SCENES: {project.sceneCount || 0}</span>
                          <span>PROMPTS: {project.promptCount || 0}</span>
                        </div>
                        <div className="mt-4 text-[10px] text-muted-foreground font-mono uppercase">
                          Last Updated: {format(new Date(project.updatedAt), 'MMM dd, yyyy')}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" /> System Log
          </h2>
          <Card className="bg-card/40 border-border/50 rounded-none h-[calc(100%-2.5rem)]">
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="p-6 text-center font-mono text-sm text-muted-foreground animate-pulse">
                  Syncing logs...
                </div>
              ) : activity?.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No recent activity.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activity?.map(log => (
                    <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          {log.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-muted text-muted-foreground">
                          {log.kind.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {format(new Date(log.createdAt), 'HH:mm - MMM dd')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
// Adding Activity import that was missed above
import { Activity } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Plus,
  FolderOpen,
  Clapperboard,
  Zap,
  Film,
  Image,
  Activity,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  useGetStatsOverview,
  useGetRecentActivity,
  useListProjects,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type StatAccent = "primary" | "accent" | "purple" | "white";

const STAT_ACCENT_CLASSES: Record<
  StatAccent,
  { ring: string; iconBg: string; iconText: string; numberText: string }
> = {
  primary: {
    ring: "border-primary/30 hover:border-primary/60",
    iconBg: "bg-primary/10 border-primary/40",
    iconText: "text-primary",
    numberText: "text-primary",
  },
  accent: {
    ring: "border-accent/30 hover:border-accent/60",
    iconBg: "bg-accent/10 border-accent/40",
    iconText: "text-accent",
    numberText: "text-accent",
  },
  purple: {
    ring: "border-secondary/40 hover:border-secondary/70",
    iconBg: "bg-secondary/15 border-secondary/40",
    iconText: "text-fuchsia-300",
    numberText: "text-fuchsia-300",
  },
  white: {
    ring: "border-border/50 hover:border-border",
    iconBg: "bg-white/5 border-white/15",
    iconText: "text-foreground",
    numberText: "text-foreground",
  },
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStatsOverview();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  const statCards: {
    label: string;
    value: number | undefined;
    icon: LucideIcon;
    accent: StatAccent;
  }[] = [
    { label: "Total Projects", value: stats?.totalProjects, icon: FolderOpen, accent: "primary" },
    { label: "Analyzed Tracks", value: stats?.analyzedProjects, icon: Zap, accent: "accent" },
    { label: "Generated Scenes", value: stats?.totalScenes, icon: Film, accent: "purple" },
    { label: "AI Prompts", value: stats?.totalPrompts, icon: Image, accent: "white" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Command Deck"
        title="Dashboard"
        subtitle="System Overview // Status: Online"
        actions={
          <Button
            asChild
            className="rounded-none uppercase tracking-widest font-bold bg-gradient-crimson border border-primary/60 text-primary-foreground hover:opacity-90 shadow-glow-soft"
          >
            <Link href="/projects/new" data-testid="dashboard-new-project">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Link>
          </Button>
        }
      />

      {/* Stats Row */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {statCards.map((stat) => {
          const a = STAT_ACCENT_CLASSES[stat.accent];
          return (
            <motion.div key={stat.label} variants={item}>
              <Card
                className={cn(
                  "relative rounded-none border surface-card hover-lift transition-colors overflow-hidden",
                  a.ring,
                )}
              >
                <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_100%_0%,hsl(320_100%_50%/0.06),transparent_60%)]" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-8 h-8 border",
                      a.iconBg,
                    )}
                  >
                    <stat.icon className={cn("w-4 h-4", a.iconText)} />
                  </span>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-9 w-16 rounded-none" />
                  ) : (
                    <div
                      className={cn(
                        "text-3xl sm:text-4xl font-bold font-mono tracking-tighter",
                        a.numberText,
                      )}
                      data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {stat.value ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Projects Grid */}
        <div className="lg:col-span-2 space-y-4">
          <SectionHeader icon={Clapperboard} accent="primary">
            Active Projects
          </SectionHeader>

          {projectsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  className="h-40 rounded-none border border-border/40 bg-card/30"
                />
              ))}
            </div>
          ) : projects?.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No projects yet"
              description="Start by creating a new music video project. Upload a track and we'll do the rest."
              action={
                <Button
                  asChild
                  className="rounded-none uppercase tracking-widest font-bold bg-gradient-crimson text-primary-foreground border border-primary/60 shadow-glow-soft"
                >
                  <Link href="/projects/new">
                    <Plus className="w-4 h-4 mr-2" /> Create Project
                  </Link>
                </Button>
              }
            />
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {projects?.map((project) => (
                <motion.div key={project.id} variants={item}>
                  <Link href={`/projects/${project.id}`}>
                    <Card
                      className="group relative cursor-pointer surface-card border-border/50 hover:border-primary/60 transition-all rounded-none overflow-hidden hover-lift"
                      data-testid={`project-card-${project.id}`}
                    >
                      <div
                        className="absolute top-0 left-0 w-1 h-full transition-all group-hover:w-1.5 group-hover:shadow-[0_0_12px_rgba(255,0,128,0.6)]"
                        style={{
                          backgroundColor:
                            project.coverColor || "hsl(var(--primary))",
                        }}
                      />
                      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_100%_0%,hsl(320_100%_50%/0.08),transparent_60%)]" />

                      <CardHeader className="pl-6 pb-2 relative">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-lg font-bold leading-tight uppercase tracking-tight group-hover:text-primary transition-colors">
                            {project.title}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="uppercase text-[10px] font-mono rounded-none border-border/60 bg-background/60 shrink-0"
                          >
                            {project.status}
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] uppercase tracking-widest font-mono">
                          {project.artist || "Unknown Artist"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pl-6 relative">
                        <div className="flex gap-3 text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 border border-primary/30 bg-primary/5 text-primary uppercase tracking-widest">
                            Scenes {project.sceneCount || 0}
                          </span>
                          <span className="px-1.5 py-0.5 border border-accent/30 bg-accent/5 text-accent uppercase tracking-widest">
                            Prompts {project.promptCount || 0}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                          <span>
                            Updated{" "}
                            {format(new Date(project.updatedAt), "MMM dd")}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
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
          <SectionHeader icon={Activity} accent="accent">
            System Log
          </SectionHeader>
          <Card className="surface-card border-border/50 rounded-none lg:h-[calc(100%-2.5rem)] overflow-hidden">
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="p-4 space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-none" />
                  ))}
                </div>
              ) : activity?.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground font-mono">
                  No recent activity.
                </div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
                  {activity?.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-white/[0.03] transition-colors group relative"
                      data-testid={`activity-${log.id}`}
                    >
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-8 bg-accent transition-all" />
                      <p className="text-sm font-medium leading-snug pl-1">
                        {log.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2 pl-1">
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/30 tracking-widest">
                          {log.kind.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {format(new Date(log.createdAt), "HH:mm · MMM dd")}
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

function SectionHeader({
  icon: Icon,
  accent,
  children,
}: {
  icon: LucideIcon;
  accent: "primary" | "accent";
  children: React.ReactNode;
}) {
  return (
    <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2.5">
      <span
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 border",
          accent === "primary"
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-accent/40 bg-accent/10 text-accent",
        )}
      >
        <Icon className="w-4 h-4" />
      </span>
      <span>{children}</span>
    </h2>
  );
}

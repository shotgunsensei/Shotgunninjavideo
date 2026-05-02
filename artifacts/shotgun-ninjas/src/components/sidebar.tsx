import { Link, useLocation, useRoute } from "wouter";
import { 
  LayoutDashboard, 
  PlusSquare, 
  Settings, 
  Clapperboard, 
  Upload, 
  Activity, 
  Film, 
  FileText, 
  Download 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const [match, params] = useRoute("/projects/:id/*?");
  const projectId = match ? params?.id : null;

  const { data: project } = useGetProject(projectId as string, {
    query: {
      enabled: !!projectId && projectId !== "new",
      queryKey: getGetProjectQueryKey(projectId as string)
    }
  });

  const mainLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects/new", label: "New Project", icon: PlusSquare },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const projectSteps = projectId && projectId !== "new" ? [
    { href: `/projects/${projectId}`, label: "Hub", icon: Clapperboard },
    { href: `/projects/${projectId}/upload`, label: "Upload", icon: Upload },
    { href: `/projects/${projectId}/analysis`, label: "Analyze", icon: Activity },
    { href: `/projects/${projectId}/storyboard`, label: "Storyboard", icon: Film },
    { href: `/projects/${projectId}/export`, label: "Export", icon: Download },
  ] : [];

  return (
    <aside className="w-64 border-r border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col h-full shrink-0">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 group">
          <Clapperboard className="w-6 h-6 text-primary group-hover:text-accent transition-colors" />
          <span className="font-bold tracking-widest uppercase text-sm">Shotgun Ninjas</span>
        </Link>
      </div>

      <div className="flex-1 px-4 space-y-8 overflow-y-auto">
        <div className="space-y-1">
          {mainLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                location === link.href || (link.href === "/projects/new" && location === "/projects/new")
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </div>

        {projectId && projectId !== "new" && (
          <div className="space-y-3">
            <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {project?.title || "Current Project"}
            </h4>
            <div className="space-y-1">
              {projectSteps.map((step) => {
                const isActive = location === step.href || (location.startsWith(`/projects/${projectId}/scenes`) && step.label === "Storyboard");
                return (
                  <Link 
                    key={step.href} 
                    href={step.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-accent/10 text-accent border border-accent/20" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <step.icon className="w-4 h-4" />
                    {step.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border/50 text-xs text-center text-muted-foreground font-mono">
        v0.1.0 // ONLINE
      </div>
    </aside>
  );
}
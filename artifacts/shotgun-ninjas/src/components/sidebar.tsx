import { Link, useLocation, useRoute } from "wouter";
import {
  LayoutDashboard,
  PlusSquare,
  Settings,
  Clapperboard,
  Upload,
  Activity,
  Film,
  Download,
  Mic2,
  Wand2,
  ShieldCheck,
  CreditCard,
  Palette,
  Megaphone,
  Hammer,
  Bug,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { PlanBadge } from "./PlanBadge";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function Sidebar() {
  const [location] = useLocation();
  const [match, params] = useRoute("/projects/:id/*?");
  const projectId = match ? params?.id : null;

  const { data: project } = useGetProject(projectId as string, {
    query: {
      enabled: !!projectId && projectId !== "new",
      queryKey: getGetProjectQueryKey(projectId as string),
    },
  });

  const mainLinks: NavLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects/new", label: "New Project", icon: PlusSquare },
    { href: "/brand-presets", label: "Brand Presets", icon: Palette },
    { href: "/pricing", label: "Pricing", icon: CreditCard },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/admin", label: "Admin / Debug", icon: Bug },
  ];

  const projectSteps: NavLink[] =
    projectId && projectId !== "new"
      ? [
          { href: `/projects/${projectId}`, label: "Hub", icon: Clapperboard },
          { href: `/projects/${projectId}/upload`, label: "Upload", icon: Upload },
          { href: `/projects/${projectId}/analysis`, label: "Analyze", icon: Activity },
          { href: `/projects/${projectId}/lyrics`, label: "Lyrics", icon: Mic2 },
          { href: `/projects/${projectId}/storyboard`, label: "Storyboard", icon: Film },
          { href: `/projects/${projectId}/continuity`, label: "Continuity", icon: ShieldCheck },
          { href: `/projects/${projectId}/prompt-engine`, label: "Prompt Engine", icon: Wand2 },
          { href: `/projects/${projectId}/marketing`, label: "Marketing", icon: Megaphone },
          { href: `/projects/${projectId}/render-plan`, label: "Render Plan", icon: Hammer },
          { href: `/projects/${projectId}/export`, label: "Export", icon: Download },
        ]
      : [];

  return (
    <aside className="w-64 border-r border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 flex flex-col h-full shrink-0 relative">
      {/* Subtle vertical glow on right edge */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent pointer-events-none" />

      <div className="p-6 border-b border-border/40">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          data-testid="sidebar-logo"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 border border-primary/40 bg-gradient-crimson-soft shadow-glow-soft group-hover:shadow-glow-primary transition-all">
            <Clapperboard className="w-5 h-5 text-primary" />
          </span>
          <div className="flex flex-col">
            <span className="font-bold tracking-widest uppercase text-sm leading-tight">
              Shotgun Ninjas
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
              Video Engine
            </span>
          </div>
        </Link>
      </div>

      <div className="flex-1 px-3 py-5 space-y-7 overflow-y-auto">
        <NavSection label="Workspace">
          {mainLinks.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              active={
                location === link.href ||
                (link.href === "/projects/new" && location === "/projects/new")
              }
            />
          ))}
        </NavSection>

        {projectId && projectId !== "new" && (
          <NavSection
            label={project?.title || "Current Project"}
            accent="accent"
          >
            {projectSteps.map((step) => {
              const isActive =
                location === step.href ||
                (location.startsWith(`/projects/${projectId}/scenes`) &&
                  step.label === "Storyboard");
              return (
                <NavItem
                  key={step.href}
                  link={step}
                  active={isActive}
                  accent="accent"
                />
              );
            })}
          </NavSection>
        )}
      </div>

      <div className="p-4 border-t border-border/50 space-y-3">
        <PlanBadge />
        <div className="text-[11px] text-center text-muted-foreground font-mono uppercase tracking-[0.2em] flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          v0.1.0 · Online
        </div>
      </div>
    </aside>
  );
}

function NavSection({
  label,
  accent = "primary",
  children,
}: {
  label: string;
  accent?: "primary" | "accent";
  children: React.ReactNode;
}) {
  const accentClass = accent === "accent" ? "text-accent" : "text-primary";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-3 mb-1.5">
        <span className={cn("w-1 h-3", accent === "accent" ? "bg-accent" : "bg-primary")} />
        <h4
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.25em] truncate",
            accentClass,
          )}
          title={label}
        >
          {label}
        </h4>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  link,
  active,
  accent = "primary",
}: {
  link: NavLink;
  active: boolean;
  accent?: "primary" | "accent";
}) {
  const Icon = link.icon;
  const accentBg = accent === "accent" ? "bg-accent/10" : "bg-primary/10";
  const accentText = accent === "accent" ? "text-accent" : "text-primary";
  const accentBar = accent === "accent" ? "bg-accent" : "bg-primary";

  return (
    <Link
      href={link.href}
      className={cn(
        "group relative flex items-center gap-3 pl-3 pr-3 py-2 text-sm font-medium transition-all duration-200 border border-transparent overflow-hidden",
        active
          ? cn(accentBg, accentText, "border-l-0")
          : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground hover:border-border/40",
      )}
      data-testid={`nav-${link.href.replace(/[^a-z0-9]+/gi, "-")}`}
    >
      {/* Active rail */}
      <span
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] transition-all duration-200",
          active ? cn(accentBar, "h-6 shadow-[0_0_10px_rgba(255,0,128,0.6)]") : "h-0",
        )}
        aria-hidden
      />
      <Icon
        className={cn(
          "w-4 h-4 shrink-0 transition-transform",
          active ? "" : "group-hover:scale-110",
        )}
      />
      <span className="truncate uppercase tracking-wider text-[11px] font-bold">
        {link.label}
      </span>
    </Link>
  );
}

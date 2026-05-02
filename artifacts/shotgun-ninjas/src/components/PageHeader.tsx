import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-border/40",
        className,
      )}
    >
      <div className="space-y-2">
        {eyebrow && (
          <div className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary animate-pulse-glow rounded-full" />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary/80">
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter uppercase flex items-center gap-3">
          {Icon && (
            <span className="inline-flex items-center justify-center w-10 h-10 border border-primary/30 bg-gradient-crimson-soft">
              <Icon className="w-5 h-5 text-primary" />
            </span>
          )}
          <span>{title}</span>
        </h1>
        {subtitle && (
          <p className="text-muted-foreground font-mono text-xs sm:text-sm uppercase tracking-widest">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      )}
    </div>
  );
}

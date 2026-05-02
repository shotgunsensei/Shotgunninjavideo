import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  variant?: "default" | "compact";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative flex flex-col items-center justify-center text-center surface-card border border-dashed border-border/50",
        isCompact ? "p-6 min-h-[160px]" : "p-10 sm:p-14 min-h-[280px]",
        className,
      )}
    >
      <div className="absolute inset-0 pointer-events-none opacity-60 bg-[radial-gradient(circle_at_50%_0%,hsl(320_100%_50%/0.06),transparent_60%)]" />
      <div
        className={cn(
          "relative inline-flex items-center justify-center mb-5 border border-primary/30 bg-primary/5",
          isCompact ? "w-10 h-10" : "w-14 h-14",
        )}
      >
        <div className="absolute inset-0 bg-gradient-crimson-soft" />
        <Icon
          className={cn(
            "relative text-primary",
            isCompact ? "w-5 h-5" : "w-7 h-7",
          )}
        />
      </div>
      <h3
        className={cn(
          "relative font-bold uppercase tracking-widest mb-2",
          isCompact ? "text-sm" : "text-xl",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "relative text-muted-foreground font-mono leading-relaxed max-w-md",
            isCompact ? "text-[11px]" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="relative mt-6">{action}</div>}
    </motion.div>
  );
}

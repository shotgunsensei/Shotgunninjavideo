import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StickyMobileBarProps {
  children: ReactNode;
  className?: string;
}

/** Fixed bottom action bar visible only on mobile.
 *  Useful for primary CTAs on long pages (storyboard, export, pricing). */
export function StickyMobileBar({ children, className }: StickyMobileBarProps) {
  return (
    <div
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60",
        "bg-background/85 backdrop-blur-md",
        "px-4 py-3",
        "shadow-[0_-12px_32px_-12px_hsl(320_100%_50%/0.25)]",
        className,
      )}
      data-testid="sticky-mobile-bar"
    >
      <div
        className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        aria-hidden
      />
      {children}
    </div>
  );
}

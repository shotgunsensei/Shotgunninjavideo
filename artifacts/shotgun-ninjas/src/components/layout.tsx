import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Clapperboard } from "lucide-react";
import { Sidebar } from "./sidebar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLandingPage = location === "/";

  if (isLandingPage) {
    return <main className="min-h-screen bg-background text-foreground">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border/40 bg-background/90 backdrop-blur px-4 h-14">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-primary" />
            <span className="font-bold tracking-widest uppercase text-xs">Shotgun Ninjas</span>
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-none border border-border/40">
                <Menu className="w-4 h-4" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-72 border-r border-border/50 bg-background"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Project navigation menu
              </SheetDescription>
              <div onClick={() => setMobileOpen(false)} className="h-full">
                <Sidebar />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="relative z-10 p-4 sm:p-6 md:p-8 lg:p-12 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

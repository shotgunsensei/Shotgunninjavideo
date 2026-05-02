import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { useLocation } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isLandingPage = location === "/";

  if (isLandingPage) {
    return <main className="min-h-screen bg-background text-foreground">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
        <div className="relative z-10 p-6 md:p-8 lg:p-12 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
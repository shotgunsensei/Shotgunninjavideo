import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Clapperboard,
  ArrowRight,
  PlayCircle,
  Music2,
  Waves,
  Layers,
  Download,
  Sparkles,
  Lock,
  FileText,
  Image as ImageIcon,
  Wand2,
  Megaphone,
  Hammer,
  Crown,
  ShieldOff,
  Building2,
  Check,
  TrendingDown,
  Boxes,
  Zap,
  Film,
  ListChecks,
  PanelsTopLeft,
  Mic2,
  Activity,
  Scissors,
  Quote,
  Plus,
  Minus,
} from "lucide-react";
import {
  PLAN_CATALOG,
  PLAN_IDS,
  PLAN_ORDER,
  type PlanId,
} from "@workspace/billing";
import { useListProjects } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRIMARY_CTA_HREF = "/projects/new";
// Fallback when the demo resolver can't find a project (fresh DB, list query
// errored, etc.). Sends visitors somewhere useful instead of a 404.
const SECONDARY_CTA_FALLBACK = "/dashboard";

/**
 * Resolves a "best demo project" id at runtime — preferring storyboarded /
 * exported projects (so the demo actually has scenes to look at). Falls back
 * to /dashboard if no projects exist yet (e.g. fresh DB on first deploy).
 *
 * This replaces a previously-hardcoded demo id, which broke the secondary
 * CTA in any environment where the seed hadn't run with that exact id.
 */
function useDemoProjectHref(): string {
  const { data: projects } = useListProjects();
  if (!projects || projects.length === 0) return SECONDARY_CTA_FALLBACK;

  const STATUS_RANK: Record<string, number> = {
    exported: 4,
    storyboarded: 3,
    analyzed: 2,
    uploaded: 1,
    draft: 0,
  };
  const ranked = [...projects].sort(
    (a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0),
  );
  const best = ranked[0];
  return best ? `/projects/${best.id}` : SECONDARY_CTA_FALLBACK;
}

const PLAN_ICONS: Record<PlanId, typeof Crown> = {
  free: ShieldOff,
  creator: Sparkles,
  studio: Crown,
  agency: Building2,
};

const PLAN_ACCENT: Record<
  PlanId,
  { ring: string; text: string; cta: string; subtle: string; glow: string; chip: string }
> = {
  free: {
    ring: "border-border/60",
    text: "text-muted-foreground",
    cta: "bg-white/5 text-foreground hover:bg-white/10 border border-border/60",
    subtle: "bg-background/40",
    glow: "",
    chip: "bg-muted text-muted-foreground",
  },
  creator: {
    ring: "border-primary/60",
    text: "text-primary",
    cta: "bg-gradient-crimson text-primary-foreground hover:opacity-90 border border-primary/60",
    subtle: "bg-primary/5",
    glow: "shadow-glow-primary",
    chip: "bg-primary/15 text-primary",
  },
  studio: {
    ring: "border-accent/60",
    text: "text-accent",
    cta: "bg-accent text-accent-foreground hover:bg-accent/90 border border-accent",
    subtle: "bg-accent/5",
    glow: "shadow-glow-accent",
    chip: "bg-accent/15 text-accent",
  },
  agency: {
    ring: "border-yellow-400/60",
    text: "text-yellow-300",
    cta: "bg-yellow-500 text-black hover:bg-yellow-400 border border-yellow-400",
    subtle: "bg-yellow-500/5",
    glow: "shadow-[0_8px_28px_-8px_rgba(234,179,8,0.5)]",
    chip: "bg-yellow-500/15 text-yellow-300",
  },
};

const RECOMMENDED_PLAN: PlanId = "creator";

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};
const STAGGER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

// ────────────────────────────────────────────────────────────────────────────
// Reusable bits

function SectionEyebrow({ children, color = "primary" }: { children: ReactNode; color?: "primary" | "accent" | "purple" }) {
  const colorMap = {
    primary: "border-primary/40 bg-primary/5 text-primary",
    accent: "border-accent/40 bg-accent/5 text-accent",
    purple: "border-purple-500/40 bg-purple-500/5 text-purple-300",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 border text-[10px] font-mono uppercase tracking-[0.25em]",
        colorMap[color],
      )}
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  eyebrowColor,
  title,
  highlight,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  eyebrowColor?: "primary" | "accent" | "purple";
  title: ReactNode;
  highlight?: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <motion.div
      variants={STAGGER}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className={cn(
        "max-w-3xl space-y-4 mb-12",
        align === "center" ? "mx-auto text-center" : "text-left",
      )}
    >
      <motion.div variants={FADE_UP}>
        <SectionEyebrow color={eyebrowColor}>{eyebrow}</SectionEyebrow>
      </motion.div>
      <motion.h2
        variants={FADE_UP}
        className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter uppercase leading-[1.05]"
      >
        {title}
        {highlight && (
          <>
            {" "}
            <span className="text-gradient-crimson">{highlight}</span>
          </>
        )}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={FADE_UP}
          className="text-muted-foreground text-base sm:text-lg leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}

function CTAButtons({
  demoHref,
  variant = "default",
  className,
}: {
  demoHref: string;
  variant?: "default" | "compact";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center",
        className,
      )}
    >
      <Button
        asChild
        size={variant === "compact" ? "default" : "lg"}
        className={cn(
          "rounded-none uppercase tracking-widest font-bold bg-gradient-crimson text-primary-foreground hover:opacity-90 border border-primary/60 shadow-glow-primary group",
          variant === "default" && "h-14 px-8 text-base",
        )}
        data-testid="cta-primary"
      >
        <Link href={PRIMARY_CTA_HREF}>
          Start Your First Video Plan
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Link>
      </Button>
      <Button
        asChild
        size={variant === "compact" ? "default" : "lg"}
        variant="outline"
        className={cn(
          "rounded-none uppercase tracking-widest font-bold border-white/20 hover:bg-white/5 hover:border-white/40 group",
          variant === "default" && "h-14 px-8 text-base",
        )}
        data-testid="cta-secondary"
      >
        <Link href={demoHref}>
          <PlayCircle className="w-4 h-4 mr-2" />
          View Demo Project
        </Link>
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Top nav

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/40"
          : "bg-transparent",
      )}
      data-testid="landing-nav"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group" data-testid="link-brand">
          <span className="inline-flex items-center justify-center w-8 h-8 border border-primary/40 bg-gradient-crimson-soft">
            <Clapperboard className="w-4 h-4 text-primary group-hover:text-accent transition-colors" />
          </span>
          <span className="font-bold tracking-widest uppercase text-xs sm:text-sm">
            Shotgun Ninjas
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-none uppercase tracking-widest text-[11px] font-bold hidden sm:inline-flex"
            data-testid="link-dashboard"
          >
            <Link href="/dashboard">Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-none uppercase tracking-widest text-[11px] font-bold bg-gradient-crimson text-primary-foreground hover:opacity-90 border border-primary/60"
          >
            <Link href={PRIMARY_CTA_HREF}>Start free</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sections

function HeroSection({ demoHref }: { demoHref: string }) {
  return (
    <section className="relative pt-32 pb-24 sm:pt-40 sm:pb-32 overflow-hidden" data-testid="section-hero">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-primary/15 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/15 blur-[140px] rounded-full" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={STAGGER}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center space-y-7"
        >
          <motion.div variants={FADE_UP}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Cinematic AI music-video planning · for creators, not enterprises
              </span>
            </div>
          </motion.div>

          <motion.h1
            variants={FADE_UP}
            className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter uppercase leading-[0.9]"
          >
            Plan music videos
            <br />
            like a <span className="text-gradient-crimson">studio.</span>
          </motion.h1>

          <motion.p
            variants={FADE_UP}
            className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl font-light leading-relaxed"
          >
            Shotgun Ninjas turns any track into a beat-synced cinematic storyboard,
            prompt pack, and full production plan — so the AI video tools you already
            pay for actually produce something coherent.
          </motion.p>

          <motion.div variants={FADE_UP} className="pt-4">
            <CTAButtons demoHref={demoHref} />
          </motion.div>

          <motion.div
            variants={FADE_UP}
            className="pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <Check className="w-3 h-3 text-primary" /> No credit card
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="w-3 h-3 text-primary" /> 2 free projects
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="w-3 h-3 text-primary" /> Plug into any AI video tool
            </span>
          </motion.div>
        </motion.div>

        {/* Hero stat band */}
        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 border border-border/40 surface-card"
        >
          {[
            { stat: "10", label: "Visual styles" },
            { stat: "10", label: "Export formats" },
            { stat: "13", label: "Marketing assets / project" },
            { stat: "$9.99", label: "Starting price / month" },
          ].map((s) => (
            <motion.div
              key={s.label}
              variants={FADE_UP}
              className="bg-background/80 px-4 py-6 sm:py-8 text-center"
            >
              <div className="text-3xl sm:text-4xl font-bold font-mono tracking-tighter text-gradient-crimson">
                {s.stat}
              </div>
              <div className="mt-1 text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    {
      icon: TrendingDown,
      title: "Per-video pricing kills momentum",
      body: "Runway, Pika, Sora, Luma all bill per clip. A 3-minute video is 30+ clips — $50–$200 in credits before you even know if it works.",
    },
    {
      icon: Boxes,
      title: "Planning chaos across 6 apps",
      body: "Notion docs, scattered prompts, Google Sheets shot lists, Logic for BPM, Premiere for cuts. Nothing talks. Nothing syncs to the beat.",
    },
    {
      icon: Wand2,
      title: "AI clips that don't connect",
      body: "Each generation forgets the last. No character continuity, no palette lock, no scene-to-scene flow. You end up with 30 unrelated 4-second clips.",
    },
  ];

  return (
    <section className="relative py-20 sm:py-32" data-testid="section-problem">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="The Problem"
          eyebrowColor="accent"
          title="Making music videos with AI"
          highlight="is broken."
          subtitle="The tools are powerful. The workflow is a mess. And every test costs real money."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5"
        >
          {problems.map((p) => (
            <motion.div
              key={p.title}
              variants={FADE_UP}
              className="surface-card border border-border/50 p-6 sm:p-7 space-y-4 hover-lift"
            >
              <div className="inline-flex items-center justify-center w-11 h-11 border border-accent/40 bg-accent/5">
                <p.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wider">{p.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function SolutionSection() {
  const points = [
    {
      icon: Waves,
      title: "Beat-synced from the first frame",
      body: "BPM detection + emotional segmentation means every scene change lands on a downbeat — without you ever opening a DAW.",
    },
    {
      icon: Lock,
      title: "Brand & character continuity lock",
      body: "Save a brand preset once. Every regeneration respects your character description, palette, recurring symbols, and camera language.",
    },
    {
      icon: Layers,
      title: "Plug into the AI tools you already pay for",
      body: "We export prompt packs tuned for Runway, Pika, Luma, Kling, Sora, PixVerse, Stable Diffusion, Midjourney, Leonardo, and CapCut.",
    },
    {
      icon: TrendingDown,
      title: "$9.99/mo flat. Plan unlimited videos.",
      body: "Sondo charges $50+ per video. We charge less than a streaming subscription, forever. You bring your own clip credits.",
    },
  ];

  return (
    <section className="relative py-20 sm:py-32 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" data-testid="section-solution">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="The Solution"
          title="One engine. The whole"
          highlight="creative pipeline."
          subtitle="Drop a track. Get a beat-synced storyboard, prompt pack, and shooting plan. Ship the video the same week."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5"
        >
          {points.map((p) => (
            <motion.div
              key={p.title}
              variants={FADE_UP}
              className="surface-card border border-primary/20 p-6 sm:p-8 flex gap-5 hover-lift"
            >
              <div className="shrink-0 inline-flex items-center justify-center w-12 h-12 border border-primary/40 bg-gradient-crimson-soft">
                <p.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold uppercase tracking-wider">{p.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{p.body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      icon: Music2,
      title: "Drop your track",
      body: "MP3, WAV, M4A — up to 100MB. Bytes stay in your browser; only metadata hits the server.",
    },
    {
      n: "02",
      icon: Activity,
      title: "Auto-analyze",
      body: "BPM, key, energy, loudness, emotional segmentation. Four-stage 'Deep Thinking' pass turns audio into structure.",
    },
    {
      n: "03",
      icon: Layers,
      title: "Generate storyboard",
      body: "Beat-synced scenes with shot type, camera, location, lighting, palette, wardrobe. Pick a visual style or bring a brand preset.",
    },
    {
      n: "04",
      icon: Download,
      title: "Export & shoot",
      body: "Production plan, AI prompt pack, CSV shot list, lyric timing sheet, CapCut/DaVinci editing guide — pick what you need.",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-20 sm:py-32 scroll-mt-20" data-testid="section-how-it-works">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          eyebrowColor="purple"
          title="From raw audio to finished plan in"
          highlight="under five minutes."
          subtitle="No DAW. No spreadsheets. No prompt-engineering forum lurking."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 relative"
        >
          {/* Connecting line on lg */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

          {steps.map((s) => (
            <motion.div
              key={s.n}
              variants={FADE_UP}
              className="relative surface-card border border-border/50 p-6 hover-lift"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Step {s.n}
                </span>
                <div className="inline-flex items-center justify-center w-9 h-9 border border-primary/40 bg-gradient-crimson-soft">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
              </div>
              <h3 className="text-base font-bold uppercase tracking-wider mb-2">
                {s.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function DemoPreviewSection({ demoHref }: { demoHref: string }) {
  // Hand-built mock storyboard. NOT pulled from real data — we want this to
  // render even if the seed didn't run, and it doubles as a teaser.
  const mockScenes = [
    { idx: "01", section: "Intro", emotion: "Tension", t: "0:00 – 0:14", shot: "Wide aerial", style: "Crimson night" },
    { idx: "02", section: "Verse 1", emotion: "Drive", t: "0:14 – 0:38", shot: "Tracking close-up", style: "Neon alley" },
    { idx: "03", section: "Pre-chorus", emotion: "Lift", t: "0:38 – 0:52", shot: "Whip pan", style: "Strobe rooftop" },
    { idx: "04", section: "Chorus", emotion: "Release", t: "0:52 – 1:18", shot: "Crane reveal", style: "Holographic crowd" },
    { idx: "05", section: "Verse 2", emotion: "Cool", t: "1:18 – 1:42", shot: "Steadicam", style: "Rain-slick city" },
    { idx: "06", section: "Bridge", emotion: "Surreal", t: "1:42 – 2:04", shot: "Dolly zoom", style: "Mirror room" },
  ];

  return (
    <section className="relative py-20 sm:py-32" data-testid="section-demo-preview">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="Demo preview"
          title="What you actually get back from"
          highlight="one upload."
          subtitle="A real storyboard from a real demo project. Each scene gets shot type, camera, lighting, palette, and a ready-to-paste prompt."
        />

        <motion.div
          variants={FADE_UP}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="surface-card border border-border/50 overflow-hidden ring-gradient-pulse rounded-none"
        >
          {/* Mock toolbar */}
          <div className="border-b border-border/50 bg-background/60 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-widest">
                Shotgun Ninjas Rise
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-widest">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                Storyboarded
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="hidden sm:inline">128 BPM</span>
              <span className="hidden sm:inline">·</span>
              <span>2:24</span>
              <span>·</span>
              <span>11 scenes</span>
            </div>
          </div>

          {/* Mock waveform / timeline */}
          <div className="border-b border-border/50 px-4 py-3 bg-background/40">
            <div className="h-12 flex items-end gap-[2px]">
              {Array.from({ length: 80 }).map((_, i) => {
                // Deterministic pseudo-waveform so SSR / re-renders match
                const v = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.21));
                const isAccent = i % 9 === 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-sm",
                      isAccent ? "bg-accent" : "bg-primary/60",
                    )}
                    style={{ height: `${v * 100}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span>0:00</span>
              <span>Beat-synced timeline · 11 emotional segments</span>
              <span>2:24</span>
            </div>
          </div>

          {/* Mock scene grid */}
          <div className="p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
            {mockScenes.map((s) => (
              <div
                key={s.idx}
                className="group relative border border-border/50 bg-background/60 overflow-hidden hover:border-primary/50 transition-colors"
              >
                {/* Pseudo-thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-primary/30 via-purple-700/20 to-accent/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(320_100%_50%/0.4),transparent_50%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(340_100%_50%/0.3),transparent_50%)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-8 h-8 text-white/30 group-hover:text-white/60 transition-colors" />
                  </div>
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 border border-white/20 text-[10px] font-mono">
                    {s.idx}
                  </div>
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 border border-white/20 text-[10px] font-mono">
                    {s.t}
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {s.section}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
                      {s.emotion}
                    </span>
                  </div>
                  <div className="text-sm font-bold leading-tight">{s.shot}</div>
                  <div className="text-xs text-muted-foreground">{s.style}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer band */}
          <div className="border-t border-border/50 px-4 py-3 bg-background/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Open the live demo to inspect prompts, scenes, and exports
            </span>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-none uppercase tracking-widest text-[11px] font-bold border-primary/40 text-primary hover:bg-primary/5 hover:border-primary"
              data-testid="cta-demo-inline"
            >
              <Link href={demoHref}>
                <PlayCircle className="w-3 h-3 mr-2" />
                Open demo project
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FeatureGridSection() {
  const features = [
    {
      icon: Activity,
      title: "Audio analysis",
      body: "BPM, key, energy, loudness, structural segmentation, and an emotional map — all in one pass.",
    },
    {
      icon: Layers,
      title: "Beat-synced storyboard",
      body: "Per-segment scenes with shot type, camera, location, lighting, palette, wardrobe, and prompts.",
    },
    {
      icon: Lock,
      title: "Brand presets",
      body: "Lock characters, palettes, symbols, and camera language. Apply across projects in one click.",
    },
    {
      icon: PanelsTopLeft,
      title: "10 visual style presets",
      body: "From Gritty Urban Grind to Holographic Synthwave to Custom — pick a vibe in one tap.",
    },
    {
      icon: Wand2,
      title: "Per-platform prompt packs",
      body: "Same scene, exported as Runway, Pika, Luma, Kling, Sora, PixVerse, SD, MJ, Leonardo prompts.",
    },
    {
      icon: Mic2,
      title: "Lyric integration",
      body: "Paste raw or timestamped lyrics. Auto-assign to scenes. Storyboard reads them on regen.",
    },
    {
      icon: Megaphone,
      title: "Marketing asset pack",
      body: "13 ready-to-post assets per project: captions, cut-down plans, story content, visual prompts.",
    },
    {
      icon: Hammer,
      title: "Local render planner",
      body: "Per-scene tool recommendations, prompts, trim notes, beat-keyed editing cues for free tools.",
    },
    {
      icon: Scissors,
      title: "CapCut & DaVinci guides",
      body: "Editor-specific timeline guides — markers, transitions, lyric overlays, beat alignment.",
    },
  ];

  return (
    <section id="features" className="relative py-20 sm:py-32 scroll-mt-20" data-testid="section-features">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Every tool a music-video director"
          highlight="actually needs."
          subtitle="No fluff. No 'AI-generated lorem ipsum'. Every feature exists because we use it ourselves."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={FADE_UP}
              className="group surface-card border border-border/50 p-5 sm:p-6 space-y-3 hover-lift hover:border-primary/40"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 border border-primary/30 bg-gradient-crimson-soft group-hover:shadow-glow-soft transition-shadow">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-base font-bold uppercase tracking-wider">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative py-20 sm:py-32 scroll-mt-20 bg-gradient-to-b from-transparent via-accent/[0.03] to-transparent"
      data-testid="section-pricing"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pricing"
          eyebrowColor="accent"
          title="Less than"
          highlight="a single AI clip credit pack."
          subtitle="Every plan unlocks more of the engine. Cancel anytime. Stripe coming soon — current upgrades are demo state only."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5"
        >
          {PLAN_IDS.map((id) => {
            const plan = PLAN_CATALOG[id];
            const Icon = PLAN_ICONS[id];
            const accent = PLAN_ACCENT[id];
            const isRecommended = id === RECOMMENDED_PLAN;

            return (
              <motion.div
                key={id}
                variants={FADE_UP}
                className={cn("relative", isRecommended && "xl:-translate-y-2")}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-crimson text-primary-foreground text-[10px] font-bold uppercase tracking-[0.25em] shadow-glow-primary">
                      <Sparkles className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "h-full flex flex-col border-2 transition-all surface-card relative overflow-hidden p-6",
                    accent.ring,
                    accent.subtle,
                    isRecommended && "shadow-glow-primary",
                  )}
                  data-testid={`landing-plan-${id}`}
                >
                  {isRecommended && (
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,hsl(320_100%_50%/0.10),transparent_60%)]" />
                  )}

                  <div className="relative space-y-1">
                    <div className={cn("inline-flex items-center gap-2", accent.text)}>
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-8 h-8 border",
                          accent.ring,
                          accent.subtle,
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-xl uppercase tracking-widest font-bold">
                        {plan.name}
                      </span>
                    </div>
                    <p className="font-mono text-xs leading-relaxed text-muted-foreground min-h-[2.5rem]">
                      {plan.tagline}
                    </p>
                  </div>

                  <div className="relative flex-1 flex flex-col gap-5 mt-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold font-mono tracking-tighter">
                        {plan.priceInterval === "free"
                          ? "$0"
                          : `$${(plan.priceCents / 100).toFixed(plan.priceCents % 100 === 0 ? 0 : 2)}`}
                      </span>
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        {plan.priceInterval === "free"
                          ? "forever"
                          : `/${plan.priceInterval === "month" ? "mo" : "yr"}`}
                      </span>
                    </div>

                    <ul className="space-y-2 flex-1">
                      {plan.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2 text-sm leading-snug">
                          <Check className={cn("w-4 h-4 mt-0.5 shrink-0", accent.text)} />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      className={cn(
                        "w-full rounded-none uppercase tracking-widest text-xs font-bold",
                        accent.cta,
                        isRecommended && accent.glow,
                      )}
                      data-testid={`landing-plan-cta-${id}`}
                    >
                      <Link href={id === "free" ? PRIMARY_CTA_HREF : "/pricing"}>
                        {id === "free" ? "Start free" : plan.ctaLabel}
                      </Link>
                    </Button>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-center text-muted-foreground">
                      {plan.projectLimit === null ? "Unlimited projects" : `${plan.projectLimit} projects`}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.p
          variants={FADE_UP}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
        >
          Compare to Sondo at $50+/video · or Runway Unlimited at $95/mo for clips alone
        </motion.p>
      </div>
    </section>
  );
}

function ExampleExportsSection() {
  const exports = [
    { icon: FileText, name: "Production plan", note: "Full shoot doc · Free", tier: "free" },
    { icon: FileText, name: "TXT outline", note: "Quick share · Free", tier: "free" },
    { icon: ListChecks, name: "JSON export", note: "Machine-readable · Creator", tier: "creator" },
    { icon: ListChecks, name: "CSV shot list", note: "Sheets-ready · Creator", tier: "creator" },
    { icon: Mic2, name: "Lyrics timing sheet", note: "Beat-synced lyrics · Creator", tier: "creator" },
    { icon: Wand2, name: "AI prompt pack", note: "10 platforms · Creator", tier: "creator" },
    { icon: Scissors, name: "CapCut guide", note: "Marker timeline · Studio", tier: "studio" },
    { icon: Scissors, name: "DaVinci guide", note: "Resolve markers · Studio", tier: "studio" },
    { icon: Quote, name: "Client treatment", note: "Pitch-ready PDF · Studio", tier: "studio" },
    { icon: Megaphone, name: "Social caption pack", note: "Platform-tuned · Studio", tier: "studio" },
  ];

  const tierColor: Record<string, string> = {
    free: "text-muted-foreground border-border/60",
    creator: "text-primary border-primary/40",
    studio: "text-accent border-accent/40",
  };

  return (
    <section className="relative py-20 sm:py-32" data-testid="section-exports">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="Example exports"
          title="Ten formats. One click."
          highlight="Every artifact you'll need."
          subtitle="From a quick TXT outline to a client-facing treatment, exports embed your project metadata, analysis, timeline, storyboard, and prompts — all consistent."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {exports.map((e) => (
            <motion.div
              key={e.name}
              variants={FADE_UP}
              className="surface-card border border-border/50 p-4 space-y-2 hover-lift hover:border-primary/40 group"
            >
              <div
                className={cn(
                  "inline-flex items-center justify-center w-9 h-9 border bg-background/40",
                  tierColor[e.tier],
                )}
              >
                <e.icon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider leading-tight">
                {e.name}
              </h3>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {e.note}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CreatorWorkflowSection() {
  const steps = [
    { n: "01", icon: Music2, title: "Upload your track", time: "~2 min", body: "Drop the WAV. The engine extracts everything it needs." },
    { n: "02", icon: Layers, title: "Generate storyboard", time: "~1 min", body: "Pick a style. 8–14 beat-synced scenes appear, each with a prompt." },
    { n: "03", icon: Wand2, title: "Generate clips with your AI tool", time: "~1–2 hrs", body: "Paste prompts into Runway, Pika, Luma — whatever you already pay for." },
    { n: "04", icon: ImageIcon, title: "Drop into CapCut or DaVinci", time: "~15 min", body: "Use our editor-specific guide to import clips and add markers." },
    { n: "05", icon: Activity, title: "Beat-align with the timing sheet", time: "~10 min", body: "Snap each clip to its segment using the BPM-keyed timestamps." },
    { n: "06", icon: Megaphone, title: "Export & post", time: "~5 min", body: "Render. Use the marketing pack to caption + cut down for socials." },
  ];

  return (
    <section className="relative py-20 sm:py-32" data-testid="section-workflow">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="The Creator Workflow"
          eyebrowColor="purple"
          title="Fresh track to finished render in"
          highlight="one evening."
          subtitle="Six steps. Real timestamps. The same workflow we use ourselves."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="space-y-3"
        >
          {steps.map((s) => (
            <motion.div
              key={s.n}
              variants={FADE_UP}
              className="surface-card border border-border/50 p-5 sm:p-6 grid grid-cols-[auto_auto_1fr] sm:grid-cols-[auto_auto_1fr_auto] gap-4 sm:gap-6 items-center hover-lift"
            >
              <span className="font-mono text-2xl sm:text-3xl font-bold text-gradient-crimson tracking-tighter">
                {s.n}
              </span>
              <div className="inline-flex items-center justify-center w-10 h-10 border border-primary/40 bg-gradient-crimson-soft">
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="col-span-3 sm:col-span-1 space-y-1 sm:space-y-1">
                <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider">
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.body}</p>
              </div>
              <span className="hidden sm:inline-flex items-center justify-end font-mono text-[11px] uppercase tracking-widest text-accent whitespace-nowrap">
                {s.time}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={FADE_UP}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-8 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
        >
          <Zap className="w-3 h-3 text-primary" />
          Total active time: ~3 hours · most of that is letting the AI tool render
        </motion.div>
      </div>
    </section>
  );
}

function FAQItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(idx === 0);
  const panelId = `faq-panel-${idx}`;
  const buttonId = `faq-button-${idx}`;
  return (
    <div className="surface-card border border-border/50 hover:border-primary/30 transition-colors">
      <button
        id={buttonId}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`faq-toggle-${idx}`}
      >
        <span className="text-base sm:text-lg font-bold uppercase tracking-wider">{q}</span>
        <span
          className={cn(
            "shrink-0 inline-flex items-center justify-center w-8 h-8 border border-primary/40 bg-gradient-crimson-soft transition-transform",
            open && "rotate-180",
          )}
        >
          {open ? <Minus className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1"
      >
        <p className="text-muted-foreground text-sm leading-relaxed border-t border-border/40 pt-4">
          {a}
        </p>
      </div>
    </div>
  );
}

function FAQSection() {
  const faqs = [
    {
      q: "Do you generate the actual videos?",
      a: "No — and that's the point. We plan, you generate. We export prompts compatible with Runway, Pika, Luma, Kling, Sora, PixVerse, Stable Diffusion, Midjourney, and Leonardo. You bring your own clip credits to whichever AI tool you already pay for.",
    },
    {
      q: "What's the difference vs Sondo or other end-to-end tools?",
      a: "Sondo charges $50+ per video and locks you to one generation pipeline. We're $9.99–$29/mo flat with unlimited videos. You stay in control of which AI tool produces each clip, so you're not stuck if a model gets worse or a service shuts down.",
    },
    {
      q: "What audio formats and file sizes work?",
      a: "MP3, WAV, M4A. Up to 100MB per file. Audio bytes never leave your browser — only metadata and analysis JSON hit our server, so nothing about your unreleased track gets uploaded.",
    },
    {
      q: "Do I need design or editing skills?",
      a: "No. The engine generates visual style, lighting, palette, camera moves, and shot type for you. If you can drop clips into CapCut, you can finish a video. The render planner walks you through every step.",
    },
    {
      q: "Can I use this for client work?",
      a: "Yes. Studio Pro and Agency plans include client-facing treatment exports, brand presets, and (on Agency) white-label exports + client folders. The platform is commercial-use friendly.",
    },
    {
      q: "Will my projects stay private?",
      a: "Yes. Single-tenant by default — only you can see your projects. Audio bytes live in your browser's IndexedDB, not on our servers. We're working on team workspaces for the Agency tier.",
    },
    {
      q: "What if I cancel?",
      a: "Cancel anytime — no contract, no clawback. Your existing projects stay accessible on the Free tier (capped at 2 projects); upgrade again whenever you need more.",
    },
    {
      q: "Is there a free trial?",
      a: "Better — there's a free plan. Two full projects, basic analysis, basic storyboard, basic export. Test the workflow on a real track before paying anything.",
    },
  ];

  return (
    <section id="faq" className="relative py-20 sm:py-32 scroll-mt-20" data-testid="section-faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="The questions everyone"
          highlight="actually asks."
        />

        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="space-y-3"
        >
          {faqs.map((f, i) => (
            <motion.div key={f.q} variants={FADE_UP}>
              <FAQItem q={f.q} a={f.a} idx={i} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTASection({ demoHref }: { demoHref: string }) {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden" data-testid="section-final-cta">
      <div className="absolute inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/15 blur-[160px] rounded-full" />
        <div className="absolute top-1/4 right-0 w-[40%] h-[40%] bg-accent/10 blur-[140px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="surface-card border-2 border-primary/30 ring-gradient-pulse p-8 sm:p-12 lg:p-16 text-center space-y-7"
        >
          <motion.div variants={FADE_UP}>
            <SectionEyebrow>Your move</SectionEyebrow>
          </motion.div>
          <motion.h2
            variants={FADE_UP}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter uppercase leading-[1.05]"
          >
            Stop planning music videos
            <br />
            <span className="text-gradient-crimson">in seven different apps.</span>
          </motion.h2>
          <motion.p
            variants={FADE_UP}
            className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
          >
            Two free projects. No credit card. Drop a track and see what falls out
            in five minutes.
          </motion.p>
          <motion.div variants={FADE_UP} className="pt-2 flex justify-center">
            <CTAButtons demoHref={demoHref} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border/40 py-10 mt-10" data-testid="landing-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 border border-primary/40 bg-gradient-crimson-soft">
            <Clapperboard className="w-3.5 h-3.5 text-primary" />
          </span>
          <span className="font-bold tracking-widest uppercase text-xs">
            Shotgun Ninjas Video Engine
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Sign in
          </Link>
        </nav>
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          © {new Date().getFullYear()} Shotgun Ninjas
        </span>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page

export default function Home() {
  const demoHref = useDemoProjectHref();
  return (
    <div
      className="min-h-screen bg-black text-foreground overflow-x-clip selection:bg-primary selection:text-primary-foreground"
      data-testid="page-landing"
    >
      <LandingNav />
      <HeroSection demoHref={demoHref} />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <DemoPreviewSection demoHref={demoHref} />
      <FeatureGridSection />
      <PricingSection />
      <ExampleExportsSection />
      <CreatorWorkflowSection />
      <FAQSection />
      <FinalCTASection demoHref={demoHref} />
      <LandingFooter />
    </div>
  );
}

// Suppress unused-import warning for PLAN_ORDER (kept for future sort/diff use).
void PLAN_ORDER;

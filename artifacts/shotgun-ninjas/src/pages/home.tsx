import { Link } from "wouter";
import { motion } from "framer-motion";
import { Play, Clapperboard, Layers, Zap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }
    }
  };

  return (
    <div className="min-h-screen bg-black selection:bg-primary selection:text-primary-foreground overflow-hidden">
      {/* Cinematic noise overlay */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')]" />
      
      {/* Abstract neon glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24">
        <motion.div 
          className="flex flex-col items-center text-center space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-gray-300">Command Deck Online</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-bold tracking-tighter uppercase leading-[0.9]">
            Shotgun <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-purple-600">Ninjas</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-400 max-w-2xl font-light">
            The underground creative lab for music video directors. Upload a track, extract its soul, and generate a beat-synced cinematic storyboard in minutes.
          </motion.p>

          <motion.div variants={itemVariants} className="pt-8 flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-none uppercase tracking-widest font-bold bg-primary hover:bg-primary/90 text-primary-foreground border border-primary-foreground/20 shadow-[0_0_40px_-10px_rgba(219,39,119,0.5)]">
              <Link href="/dashboard">Enter Studio</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg rounded-none uppercase tracking-widest font-bold border-white/20 hover:bg-white/5">
              <Link href="/projects/new">New Project</Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div 
          className="mt-40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {[
            { icon: Play, title: "Upload Track", desc: "Drop your audio file. We extract duration, energy, and intensity." },
            { icon: Zap, title: "Audio Analysis", desc: "Beat detection, emotional mapping, and structural segmentation." },
            { icon: Layers, title: "Cinematic Storyboard", desc: "Auto-generate beat-synced scenes with camera moves and lighting." },
            { icon: Download, title: "Export Plans", desc: "Download JSON, TXT, or full production plans for shooting." }
          ].map((feature, i) => (
            <motion.div key={i} variants={itemVariants} className="p-6 border border-white/10 bg-white/5 backdrop-blur-sm group hover:border-primary/50 transition-colors">
              <feature.icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold uppercase tracking-wider mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
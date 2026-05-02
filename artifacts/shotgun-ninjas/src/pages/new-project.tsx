import { useState } from "react";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, Film, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCreateProject } from "@workspace/api-client-react";
import { useBilling } from "@/hooks/use-billing";
import { PLAN_CATALOG } from "@workspace/billing";

const formSchema = z.object({
  title: z.string().min(1, "Project title is required"),
  artist: z.string().optional(),
  genre: z.string().optional(),
  mood: z.string().optional(),
  visualDirection: z.string().optional(),
});

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProject = useCreateProject();
  const billing = useBilling();
  const canCreate = billing.canCreateProject();
  const requiredPlan = billing.requiredPlanForFeature("unlimited_projects");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      artist: "",
      genre: "",
      mood: "",
      visualDirection: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createProject.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({
            title: "Project initialized",
            description: "Command deck ready. Proceed to audio upload.",
          });
          setLocation(`/projects/${data.id}/upload`);
        },
        onError: (err: unknown) => {
          // Surface plan-limit messages from the API verbatim so the user
          // knows exactly which plan unlocks more projects.
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Could not create project. Please try again.";
          toast({
            variant: "destructive",
            title: "Initialization Failed",
            description: message,
          });
        }
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase">New Project</h1>
        <p className="text-muted-foreground font-mono text-sm">Initialize workspace parameters</p>
      </div>

      {!canCreate && (
        <div
          className="border-2 border-yellow-500/40 bg-yellow-500/5 p-5 space-y-3"
          data-testid="plan-limit-banner"
        >
          <div className="flex items-center gap-2 text-yellow-300">
            <Lock className="w-4 h-4" />
            <h2 className="text-sm font-bold uppercase tracking-widest">
              {billing.planMeta.name} plan limit reached
            </h2>
          </div>
          <p className="text-xs font-mono leading-relaxed text-muted-foreground">
            You've used {billing.projectCount} of {billing.projectLimit} project
            slots on the {billing.planMeta.name} plan. Upgrade to{" "}
            <span className="text-foreground font-bold">
              {PLAN_CATALOG[requiredPlan].name}
            </span>{" "}
            for unlimited projects, advanced exports, and faster generation.
          </p>
          <Link href="/pricing">
            <Button
              className="rounded-none uppercase tracking-widest text-xs font-bold bg-yellow-500 text-black hover:bg-yellow-400"
              data-testid="button-upgrade-from-limit"
            >
              View pricing → Upgrade to {PLAN_CATALOG[requiredPlan].name}
            </Button>
          </Link>
        </div>
      )}

      <div className="p-8 border border-border/50 bg-card/30 backdrop-blur relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Film className="w-24 h-24" />
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 relative z-10">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase tracking-widest text-xs">Project Title *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Midnight City Run" 
                      className="rounded-none bg-background/50 h-12 text-lg font-medium border-border/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="artist"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase tracking-widest text-xs">Artist / Band</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Optional" 
                        className="rounded-none bg-background/50 border-border/50" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="genre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase tracking-widest text-xs">Musical Genre</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Synthwave, Hip Hop" 
                        className="rounded-none bg-background/50 border-border/50" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="mood"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase tracking-widest text-xs">Vibe / Mood</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Dark, Energetic, Melancholic" 
                      className="rounded-none bg-background/50 border-border/50" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visualDirection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase tracking-widest text-xs">Visual Direction (Director's Notes)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the aesthetic vision, references, or color palettes..." 
                      className="rounded-none bg-background/50 border-border/50 min-h-[120px] resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-xs font-mono">
                    This will guide the AI when generating storyboard scenes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4 border-t border-border/50 flex justify-end">
              <Button 
                type="submit" 
                size="lg" 
                className="rounded-none uppercase tracking-widest font-bold min-w-[200px]"
                disabled={createProject.isPending || !canCreate}
                data-testid="button-create-project"
              >
                {createProject.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : !canCreate ? (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Limit Reached
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
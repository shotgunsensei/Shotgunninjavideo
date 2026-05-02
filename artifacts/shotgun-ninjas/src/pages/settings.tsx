import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, Settings2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetSettings, 
  useUpdateSettings,
  getGetSettingsQueryKey
} from "@workspace/api-client-react";

const formSchema = z.object({
  creatorName: z.string().optional(),
  creatorHandle: z.string().optional(),
  defaultModel: z.enum(["runway", "sora", "kling", "pika", "luma", "generic"]),
  defaultAspectRatio: z.string(),
  defaultSceneDurationSec: z.coerce.number().min(1).max(30),
  theme: z.enum(["dark", "light"]),
});

export default function Settings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });

  const updateSettings = useUpdateSettings();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      creatorName: "",
      creatorHandle: "",
      defaultModel: "runway",
      defaultAspectRatio: "16:9",
      defaultSceneDurationSec: 5,
      theme: "dark"
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        creatorName: settings.creatorName || "",
        creatorHandle: settings.creatorHandle || "",
        defaultModel: settings.defaultModel as any,
        defaultAspectRatio: settings.defaultAspectRatio,
        defaultSceneDurationSec: settings.defaultSceneDurationSec,
        theme: settings.theme as any
      });
    }
  }, [settings, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateSettings.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: "Settings saved",
            description: "System configuration updated.",
          });
        },
      }
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
          <Settings2 className="w-8 h-8 text-primary" /> System Config
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">
          Global workspace parameters
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
            <CardContent className="p-6 space-y-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Creator Identity</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="creatorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-[10px]">Director Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          className="rounded-none bg-background/50 border-border/50 font-mono text-sm" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="creatorHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-[10px]">Social Handle</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          className="rounded-none bg-background/50 border-border/50 font-mono text-sm" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur">
            <CardContent className="p-6 space-y-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">AI Defaults</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="defaultModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-[10px]">Default Engine</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-none bg-background/50 border-border/50 font-mono text-sm">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-none border-border/50">
                          <SelectItem value="runway">Runway Gen-3</SelectItem>
                          <SelectItem value="sora">OpenAI Sora</SelectItem>
                          <SelectItem value="kling">Kling</SelectItem>
                          <SelectItem value="pika">Pika Labs</SelectItem>
                          <SelectItem value="luma">Luma Dream</SelectItem>
                          <SelectItem value="generic">Generic</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultAspectRatio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-[10px]">Aspect Ratio</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-none bg-background/50 border-border/50 font-mono text-sm">
                            <SelectValue placeholder="Select ratio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-none border-border/50">
                          <SelectItem value="16:9">16:9 (Cinematic)</SelectItem>
                          <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                          <SelectItem value="1:1">1:1 (Square)</SelectItem>
                          <SelectItem value="21:9">21:9 (Ultrawide)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultSceneDurationSec"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-[10px]">Shot Length (s)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          className="rounded-none bg-background/50 border-border/50 font-mono text-sm" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border/50 bg-card/20 backdrop-blur opacity-50 pointer-events-none">
            <CardContent className="p-6 space-y-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Interface Theme</h2>
              <p className="text-xs font-mono text-muted-foreground">Dark mode enforced by system override.</p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              size="lg" 
              className="rounded-none uppercase tracking-widest font-bold min-w-[200px]"
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Configuration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import NewProject from "@/pages/new-project";
import ProjectHub from "@/pages/project-hub";
import UploadAudio from "@/pages/upload";
import Analysis from "@/pages/analysis";
import Storyboard from "@/pages/storyboard";
import SceneEditor from "@/pages/scene-editor";
import LyricsPage from "@/pages/lyrics";
import ContinuityPage from "@/pages/continuity";
import PromptEngine from "@/pages/prompt-engine";
import Export from "@/pages/export";
import Settings from "@/pages/settings";
import Pricing from "@/pages/pricing";
import BrandPresetsPage from "@/pages/brand-presets";
import MarketingPage from "@/pages/marketing";
import RenderPlanPage from "@/pages/render-plan";
import AdminPage from "@/pages/admin";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/projects/new" component={NewProject} />
        <Route path="/projects/:id" component={ProjectHub} />
        <Route path="/projects/:id/upload" component={UploadAudio} />
        <Route path="/projects/:id/analysis" component={Analysis} />
        <Route path="/projects/:id/storyboard" component={Storyboard} />
        <Route path="/projects/:id/lyrics" component={LyricsPage} />
        <Route path="/projects/:id/continuity" component={ContinuityPage} />
        <Route path="/projects/:id/scenes/:sceneId" component={SceneEditor} />
        <Route path="/projects/:id/prompt-engine" component={PromptEngine} />
        <Route path="/projects/:id/export" component={Export} />
        <Route path="/projects/:id/marketing" component={MarketingPage} />
        <Route path="/projects/:id/render-plan" component={RenderPlanPage} />
        <Route path="/settings" component={Settings} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/brand-presets" component={BrandPresetsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
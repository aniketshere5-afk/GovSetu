import { ThemeProvider } from "next-themes";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Apply from "./pages/Apply";
import Track from "./pages/Track";
import ApplicationDetail from "./pages/ApplicationDetail";
import Consent from "./pages/Consent";
import Vault from "./pages/Vault";
import Work from "./pages/Work";
import Admin from "./pages/Admin";
import Grievance from "./pages/Grievance";
import Info from "./pages/Info";
import DemoLogin from "./pages/DemoLogin";
import NotFound from "./pages/NotFound";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/services" component={Services} />
      <Route path="/services/:slug" component={ServiceDetail} />
      <Route path="/apply/:slug" component={Apply} />
      <Route path="/track" component={Track} />
      <Route path="/applications/:id" component={ApplicationDetail} />
      <Route path="/consent" component={Consent} />
      <Route path="/vault" component={Vault} />
      <Route path="/work" component={Work} />
      <Route path="/admin" component={Admin} />
      <Route path="/grievance" component={Grievance} />
      <Route path="/demo-login" component={DemoLogin} />
      <Route path="/accessibility">{() => <Info slug="accessibility" />}</Route>
      <Route path="/help">{() => <Info slug="help" />}</Route>
      <Route path="/privacy">{() => <Info slug="privacy" />}</Route>
      <Route path="/terms">{() => <Info slug="terms" />}</Route>
      <Route path="/rti">{() => <Info slug="rti" />}</Route>
      <Route path="/sitemap">{() => <Info slug="sitemap" />}</Route>
      <Route path="/notices">{() => <Info slug="notices" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

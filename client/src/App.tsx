import { ThemeProvider } from "next-themes";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Operations from "./pages/Operations";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      {/* Protected role workspaces — rebuilt in later phases; still reachable now. */}
      <Route path="/track" component={Operations} />
      <Route path="/consent" component={Operations} />
      <Route path="/work" component={Operations} />
      <Route path="/admin" component={Operations} />
      <Route path="/operations" component={Operations} />
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

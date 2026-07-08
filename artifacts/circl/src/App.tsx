import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { Layout } from '@/components/layout';

// Pages
import Dashboard from '@/pages/dashboard';
import Discover from '@/pages/discover';
import Matches from '@/pages/matches';
import Conversations from '@/pages/conversations';
import Chat from '@/pages/chat';
import Profile from '@/pages/profile';
import ViewProfile from '@/pages/view-profile';
import Notifications from '@/pages/notifications';
import Settings from '@/pages/settings';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/discover" component={Discover} />
        <Route path="/matches" component={Matches} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/conversations/:id" component={Chat} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/:id" component={ViewProfile} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

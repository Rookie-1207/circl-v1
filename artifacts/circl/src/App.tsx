import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { Layout } from '@/components/layout';
import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/components/auth-provider';

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
import Login from '@/pages/login';
import HappeningNow from '@/pages/happening-now';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/dashboard', { replace: true });
  }, [setLocation]);
  return null;
}

function ProtectedRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={RedirectToDashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/discover" component={Discover} />
        <Route path="/happening-now" component={HappeningNow} />
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

function Router() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Login} />
        <Route component={ProtectedRoutes} />
      </Switch>
    </AuthGate>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

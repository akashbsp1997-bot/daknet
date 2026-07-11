import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { initApi } from './lib/api';

import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Shell } from './components/layout/Shell';

import Login from './pages/login';
import AddressList from './pages/addresses/list';
import AddressDetail from './pages/addresses/detail';

const queryClient = new QueryClient();

// Initialize custom fetch with bearer token
initApi();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/addresses">
        <ProtectedRoute>
          <Shell><AddressList /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/addresses/:id">
        <ProtectedRoute>
          <Shell><AddressDetail /></Shell>
        </ProtectedRoute>
      </Route>

      <Route path="/">
        <Redirect to="/addresses" />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter hook={useHashLocation}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;

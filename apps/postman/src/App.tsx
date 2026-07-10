import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { initApi } from './lib/api';

import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Shell } from './components/layout/Shell';

import Login from './pages/login';
import SuperOffices from './pages/super/offices';
import SuperOfficeDetail from './pages/super/office-detail';
import SuperUsers from './pages/super/users';
import Dashboard from './pages/admin/dashboard';
import Operators from './pages/admin/operators';
import Beats from './pages/admin/beats';
import AdminMap from './pages/admin/map';
import Articles from './pages/admin/articles';
import Reports from './pages/admin/reports';
import FieldHome from './pages/field/home';
import FieldMap from './pages/field/map';
import FieldArticles from './pages/field/articles';
import FieldVisits from './pages/field/visits';

const queryClient = new QueryClient();

// Initialize custom fetch with bearer token
initApi();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Super Admin Routes */}
      <Route path="/super/offices">
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <Shell><SuperOffices /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/super/offices/:id">
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <Shell><SuperOfficeDetail /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/super/users">
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <Shell><SuperUsers /></Shell>
        </ProtectedRoute>
      </Route>

      {/* Office Admin Routes */}
      <Route path="/dashboard">
        <ProtectedRoute allowedRoles={["office_admin"]}>
          <Shell><Dashboard /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/operators">
        <ProtectedRoute allowedRoles={["office_admin"]}>
          <Shell><Operators /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/beats">
        <ProtectedRoute allowedRoles={["office_admin"]}>
          <Shell><Beats /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/map">
        <ProtectedRoute allowedRoles={["office_admin"]}>
          <Shell><AdminMap /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/articles">
        <ProtectedRoute allowedRoles={["office_admin"]}>
          <Shell><Articles /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/reports">
        <ProtectedRoute allowedRoles={["office_admin"]}>
          <Shell><Reports /></Shell>
        </ProtectedRoute>
      </Route>

      {/* Field Operator Routes */}
      <Route path="/field">
        <ProtectedRoute allowedRoles={["field_operator"]}>
          <Shell><FieldHome /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/field/map">
        <ProtectedRoute allowedRoles={["field_operator"]}>
          <Shell><FieldMap /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/field/articles">
        <ProtectedRoute allowedRoles={["field_operator"]}>
          <Shell><FieldArticles /></Shell>
        </ProtectedRoute>
      </Route>
      <Route path="/field/visits">
        <ProtectedRoute allowedRoles={["field_operator"]}>
          <Shell><FieldVisits /></Shell>
        </ProtectedRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute>
          <div className="min-h-screen flex items-center justify-center">Redirecting...</div>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

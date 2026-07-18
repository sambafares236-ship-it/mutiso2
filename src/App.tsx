import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { OfflineQueueProvider } from '@/hooks/useOfflineQueue';
import Index from './pages/Index';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import JoinPage from './pages/JoinPage';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OfflineQueueProvider>
        <Toaster />
        <BrowserRouter>
          {/* Inside the router on purpose: Analytics reads client-side route
              changes via a router hook, so outside BrowserRouter it would only
              ever record the first pageview of a session. */}
          <Analytics />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </BrowserRouter>
      </OfflineQueueProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

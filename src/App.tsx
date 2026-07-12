import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { OfflineQueueProvider } from '@/hooks/useOfflineQueue';
import Index from './pages/Index';
import Auth from './pages/Auth';
import JoinPage from './pages/JoinPage';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OfflineQueueProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/join" element={<JoinPage />} />
          </Routes>
        </BrowserRouter>
      </OfflineQueueProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

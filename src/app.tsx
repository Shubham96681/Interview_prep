import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Index from './pages/Index';
import ExpertDirectory from './pages/ExpertDirectory';
import ExpertProfile from './pages/ExpertProfile';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import ConnectionStatus from './components/ConnectionStatus';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <AuthProvider>
        <ConnectionStatus />
        <Routes>
            <Route path="/" element={<ProtectedRoute requireAuth={false}><Index /></ProtectedRoute>} />
          <Route path="/experts" element={<ExpertDirectory />} />
          <Route path="/expert/:id" element={<ExpertProfile />} />
            <Route path="/dashboard" element={<ProtectedRoute requireAuth={true}><Dashboard /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

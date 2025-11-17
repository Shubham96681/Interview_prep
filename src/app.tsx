import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import Index from './pages/Index';
import ExpertDirectory from './pages/ExpertDirectory';
import ExpertProfile from './pages/ExpertProfile';
import Dashboard from './pages/Dashboard';
import Meeting from './pages/Meeting';
import Registration from './pages/Registration';
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
          <ErrorBoundary>
        <ConnectionStatus />
        <Routes>
              <Route path="/" element={<ProtectedRoute requireAuth={false}><Index /></ProtectedRoute>} />
          <Route path="/experts" element={<ExpertDirectory />} />
          <Route path="/expert/:id" element={<ExpertProfile />} />
          <Route path="/register" element={<ProtectedRoute requireAuth={false}><Registration /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute requireAuth={true}><Dashboard /></ProtectedRoute>} />
              <Route 
                path="/meeting/:meetingId" 
                element={
                  <ErrorBoundary>
                    <ProtectedRoute requireAuth={true}>
                      <Meeting />
                    </ProtectedRoute>
                  </ErrorBoundary>
                } 
              />
          <Route path="*" element={<NotFound />} />
        </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

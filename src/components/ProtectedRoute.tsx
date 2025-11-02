import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export const ProtectedRoute = ({ children, requireAuth = true }: ProtectedRouteProps) => {
  const { user, loading, isAuthenticated, login } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If route requires auth and user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <AuthModal
          isOpen={true}
          onClose={() => window.history.back()}
          onLogin={(userType, userData) => {
            login(userData);
          }}
        />
      </div>
    );
  }

  // Allow authenticated users to access public routes (like landing page)
  // The page components will handle showing appropriate content based on auth state
  return <>{children}</>;
};


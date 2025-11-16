import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, authService } from '@/lib/auth';
import { apiService } from '@/lib/apiService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize authentication state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // First, try to validate token with backend
      if (token) {
        try {
          const response = await apiService.getCurrentUser();
          if (response.success && response.data) {
            // Backend response structure: { success: true, data: { data: { user } } }
            // or direct: { success: true, data: { user } }
            const userData = response.data.data || response.data;
            if (userData && (userData.id || userData.email)) {
              // Backend validated the token, use backend user data
              setUser(userData);
              setLoading(false);
              return;
            }
          }
          // Token invalid or no user data, remove it
          localStorage.removeItem('token');
        } catch (error) {
          console.error('Error validating token with backend:', error);
          // Backend might be down, fall through to local auth
        }
      }

      // Fallback to local auth service (for test users or when backend is unavailable)
      const localUser = authService.getCurrentUser();
      if (localUser) {
        setUser(localUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData: User) => {
    // Validate that userData has a valid ID (not a frontend-generated one)
    if (userData.id && userData.id.startsWith('user-')) {
      console.error('❌ AuthContext: Frontend-generated ID detected! This should not happen:', userData.id);
      console.error('❌ User data:', userData);
      // Don't proceed with frontend-generated IDs - they won't work with the backend
      return;
    }
    
    // Store token if available (token is optional - may already be in localStorage from registration)
    if (userData.token) {
      localStorage.setItem('token', userData.token);
      console.log('✅ AuthContext: Token saved:', userData.token.substring(0, 20) + '...');
      
      // Verify token was saved
      const savedToken = localStorage.getItem('token');
      if (!savedToken || savedToken !== userData.token) {
        console.error('❌ AuthContext: Token not saved correctly!');
      }
    } else {
      // Token might already be in localStorage from registration/login
      const existingToken = localStorage.getItem('token');
      if (existingToken) {
        console.log('✅ AuthContext: Using existing token from localStorage');
      } else {
        console.warn('⚠️ AuthContext: No token in userData or localStorage - user may need to log in again');
      }
    }
    
    // Validate user ID exists and is a valid database ID (not frontend-generated)
    if (!userData.id) {
      console.error('❌ AuthContext: User data missing ID!', userData);
      return;
    }
    
    // Also store in authService for compatibility
    authService.login(userData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    authService.logout();
    setUser(null);
    // Navigation will be handled by components that call logout
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await apiService.getCurrentUser();
        if (response.success && response.data) {
          // Backend response structure: { success: true, data: { data: { user } } }
          // or direct: { success: true, data: { user } }
          const userData = response.data.data || response.data;
          if (userData && (userData.id || userData.email)) {
            setUser(userData);
            // Also update localStorage user for compatibility
            authService.login(userData);
          } else {
            logout();
          }
        } else {
          logout();
        }
      } catch (error) {
        console.error('Error refreshing user:', error);
        // On error, keep using local user if available
        const localUser = authService.getCurrentUser();
        if (!localUser) {
          logout();
        }
      }
    } else {
      // No token, check local auth
      const localUser = authService.getCurrentUser();
      if (!localUser) {
        logout();
      }
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


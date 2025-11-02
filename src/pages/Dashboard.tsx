import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft } from 'lucide-react';
import { Session } from '@/lib/mockData';
import { sessionService } from '@/lib/sessionService';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/apiService';
import CandidateDashboard from '@/components/CandidateDashboard';
import ExpertDashboard from '@/components/ExpertDashboard';
import realtimeService from '@/lib/realtimeService';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle refresh from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('refresh')) {
      setRefreshKey(prev => prev + 1);
    }
  }, [location.search]);

  // Handle ID mismatch between backend and local auth service
  const getUserId = useCallback(() => {
    if (!user) return 'candidate-001';
    
    // If user has email jane@example.com, use expert-001 for sessions
    if (user.email === 'jane@example.com') return 'expert-001';
    // If user has email john@example.com, use candidate-001 for sessions  
    if (user.email === 'john@example.com') return 'candidate-001';
    // If user has email shubhamsingh6087@gmail.com, use the database ID
    if (user.email === 'shubhamsingh6087@gmail.com') return 'cmguho5y30000mb9sp9zy6gwe';
    
    return user.id;
  }, [user]);

  // Fetch sessions from backend API
  const fetchSessions = useCallback(async () => {
    if (!user) return;
    
    console.log('Fetching sessions for user:', user.email, user.id);
    
    try {
      const response = await apiService.getSessions(100);
      console.log('Sessions API response:', response);
      
      if (response.success && response.data) {
        console.log('Setting sessions:', response.data.sessions);
        setSessions(response.data.sessions || []);
      } else {
        console.log('API failed, using fallback');
        // Fallback to local session service for test users
        const userId = getUserId() || 'candidate-001';
        const localSessions = sessionService.getUserSessions(userId, user?.userType as 'candidate' | 'expert' || 'candidate');
        setSessions(localSessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      // Fallback to local session service for test users
      const userId = getUserId() || 'candidate-001';
      const localSessions = sessionService.getUserSessions(userId, user?.userType as 'candidate' | 'expert' || 'candidate');
      setSessions(localSessions);
    }
  }, [user, getUserId]);

  // Setup real-time updates
  useEffect(() => {
    if (user) {
      // Connect to real-time service
      realtimeService.connect(user.id);

      // Listen for session updates
      const handleSessionCreated = (session: any) => {
        console.log('🔄 New session received via real-time:', session);
        // Refresh sessions when a new one is created
        fetchSessions();
      };

      const handleSessionUpdated = (session: any) => {
        console.log('🔄 Session updated via real-time:', session);
        // Refresh sessions when one is updated
        fetchSessions();
      };

      realtimeService.onSessionCreated(handleSessionCreated);
      realtimeService.onSessionUpdated(handleSessionUpdated);

      // Initial fetch
      fetchSessions();

      // Cleanup on unmount
      return () => {
        realtimeService.off('session_created', handleSessionCreated);
        realtimeService.off('session_updated', handleSessionUpdated);
      };
    }
  }, [user, fetchSessions]);

  const handleLogout = () => {
    logout();
    setSessions([]);
    navigate('/');
  };

  // ProtectedRoute handles auth check, but add a safety check
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

  if (!user) {
    return null; // ProtectedRoute should handle this
  }

  // Ensure user has required properties
  const safeUser = {
    id: user.id || 'unknown',
    name: user.name || 'User',
    email: user.email || 'user@example.com',
    userType: user.userType || 'candidate',
    avatar: user.avatar || ''
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            InterviewAce
          </div>
        </div>
        <div className="flex items-center gap-4">
          {safeUser.userType === 'candidate' && (
            <Button variant="outline" onClick={() => navigate('/experts')}>
              Find Experts
            </Button>
          )}
          {safeUser.userType === 'expert' && safeUser.id && (
            <Button variant="outline" onClick={() => navigate(`/expert/${safeUser.id}`)}>
              View Profile
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={safeUser.avatar} />
              <AvatarFallback>{safeUser.name ? safeUser.name.split(' ').map(n => n[0]).join('') : 'U'}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-600">{safeUser.name || 'User'}</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}>Sign Out</Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {safeUser.userType === 'candidate' ? 'Candidate' : 'Expert'} Dashboard
            </h1>
            <p className="text-gray-600">
              {safeUser.userType === 'candidate' 
                ? 'Manage your interview sessions and progress' 
                : 'Manage your availability and coaching sessions'
              }
            </p>
          </div>
          
          <Badge variant={safeUser.userType === 'candidate' ? 'default' : 'secondary'} className="px-4 py-2">
            {safeUser.userType === 'candidate' ? '🎯 Candidate' : '👨‍🏫 Expert'}
          </Badge>
        </div>

        {/* Dashboard Content */}
        {safeUser.userType === 'candidate' ? (
          <CandidateDashboard user={safeUser} onLogout={handleLogout} />
        ) : (
          <ExpertDashboard user={safeUser} onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
}

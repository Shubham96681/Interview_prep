import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getAvatarUrl } from '@/lib/avatarUtils';
import CandidateDashboard from '@/components/CandidateDashboard';
import ExpertDashboard from '@/components/ExpertDashboard';
import AdminDashboard from '@/components/AdminDashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();

  const handleLogout = () => {
    logout();
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
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">I</span>
            </div>
            <div className="text-xl font-bold text-gray-900">InPrepare</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {safeUser.userType === 'candidate' && (
            <Button variant="outline" onClick={() => navigate('/experts')} className="border-gray-300 text-gray-700 hover:bg-gray-50">
              Find Experts
            </Button>
          )}
          {safeUser.userType === 'expert' && safeUser.id && (
            <Button variant="outline" onClick={() => navigate(`/expert/${safeUser.id}`)} className="border-gray-300 text-gray-700 hover:bg-gray-50">
              View Profile
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={getAvatarUrl(safeUser.avatar, safeUser.name)} />
              <AvatarFallback className="bg-blue-600 text-white">{safeUser.name ? safeUser.name.split(' ').map(n => n[0]).join('') : 'U'}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-700">{safeUser.name || 'User'}</span>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-gray-600 hover:text-gray-900">Sign Out</Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {safeUser.userType === 'admin' ? 'Admin' : safeUser.userType === 'candidate' ? 'Candidate' : 'Expert'} Dashboard
            </h1>
            <p className="text-gray-600">
              {safeUser.userType === 'admin'
                ? 'Manage all users, sessions, and system settings'
                : safeUser.userType === 'candidate' 
                ? 'Manage your interview sessions and progress' 
                : 'Manage your availability and coaching sessions'
              }
            </p>
          </div>
          
          <Badge variant={safeUser.userType === 'admin' ? 'destructive' : safeUser.userType === 'candidate' ? 'default' : 'secondary'} className="px-4 py-2 bg-blue-100 text-blue-800 border-blue-200">
            {safeUser.userType === 'admin' ? '👑 Admin' : safeUser.userType === 'candidate' ? '🎯 Candidate' : '👨‍🏫 Expert'}
          </Badge>
        </div>

        {/* Dashboard Content */}
        {safeUser.userType === 'admin' ? (
          <AdminDashboard user={safeUser} />
        ) : safeUser.userType === 'candidate' ? (
          <CandidateDashboard user={safeUser} onLogout={handleLogout} />
        ) : (
          <ExpertDashboard user={safeUser} onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
}

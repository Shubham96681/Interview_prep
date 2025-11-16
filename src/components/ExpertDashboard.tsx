import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Star, Video, FileText, Users, DollarSign, TrendingUp } from 'lucide-react';
import { Session } from '@/lib/mockData';
import { apiService } from '@/lib/apiService';
import realtimeService from '@/lib/realtimeService';
import AvailabilityManager from './AvailabilityManager';
import ExpertAnalytics from './ExpertAnalytics';
import { toast } from 'sonner';

interface ExpertDashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
    avatar?: string;
  };
  onLogout: () => void;
}

export default function ExpertDashboard({ user }: ExpertDashboardProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeView, setActiveView] = useState<'dashboard' | 'calendar' | 'analytics'>('dashboard');

  // Fetch sessions from backend API
  const fetchSessions = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await apiService.getSessions(100, user.id, 'expert');
      
      if (response.success && response.data) {
        setSessions(response.data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }, [user?.id]);

  // Setup real-time updates
  useEffect(() => {
    // Validate user ID before connecting
    if (!user?.id) {
      console.error('❌ ExpertDashboard: Cannot connect to realtime - user ID missing');
      return;
    }
    
    // Reject frontend-generated IDs
    if (user.id.startsWith('user-')) {
      console.error('❌ ExpertDashboard: Cannot connect to realtime - frontend-generated ID detected:', user.id);
      console.error('❌ User must have a valid database ID. Please log out and log back in.');
      return;
    }
    
    // Connect to real-time service
    realtimeService.connect(user.id);

    // Listen for session updates
    const handleSessionCreated = (session: any) => {
      console.log('🔄 New session received via real-time:', session);
      fetchSessions();
    };

    const handleSessionUpdated = (session: any) => {
      console.log('🔄 Session updated via real-time:', session);
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
  }, [user.id, fetchSessions]);

  // Filter sessions based on status
  const upcomingSessions = sessions.filter(session => 
    session.status === 'upcoming' || session.status === 'scheduled'
  );
  const completedSessions = sessions.filter(session => session.status === 'completed');

  const formatDate = (dateStr: string, timeStr?: string) => {
    if (!dateStr) return 'No date';
    
    let date: Date;
    
    // If we have an ISO date string (from scheduledDate), use it directly
    if (dateStr.includes('T') || dateStr.includes('Z')) {
      date = new Date(dateStr);
    } 
    // If we have both date and time, combine them properly
    else if (timeStr) {
      // Parse date as local time: "YYYY-MM-DD" + "HH:mm"
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    }
    // If only date string, parse as local date (not UTC)
    else {
      const [year, month, day] = dateStr.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate earnings
  const totalEarnings = sessions
    .filter(session => session.status === 'completed')
    .reduce((sum, session) => sum + (session.paymentAmount || 0), 0);

  // Render different views based on activeView state
  if (activeView === 'calendar') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setActiveView('dashboard');
              toast.success('Returned to dashboard');
            }}
            className="flex items-center gap-2"
          >
            ← Back to Dashboard
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Calendar Management</span>
          </div>
        </div>
        <AvailabilityManager expertId={user.id} sessions={sessions} />
      </div>
    );
  }

  if (activeView === 'analytics') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setActiveView('dashboard');
              toast.success('Returned to dashboard');
            }}
            className="flex items-center gap-2"
          >
            ← Back to Dashboard
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Analytics</span>
          </div>
        </div>
        <ExpertAnalytics expertId={user.id} sessions={sessions} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingSessions.length}</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedSessions.length}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">${totalEarnings}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expert Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/expert/${user.id}`)}>
          <CardContent className="p-6">
            <div className="text-center">
              <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Profile</h3>
              <p className="text-gray-600 mb-4">Update your expertise, availability, and rates</p>
              <Button className="w-full">
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => {
          setActiveView('calendar');
          toast.success('Opening Calendar Management');
        }}>
          <CardContent className="p-6">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Set Availability</h3>
              <p className="text-gray-600 mb-4">Manage your working hours and availability</p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveView('calendar');
                  toast.success('Opening Calendar Management');
                }}
              >
                Manage Calendar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => {
          setActiveView('analytics');
          toast.success('Opening Analytics Dashboard');
        }}>
          <CardContent className="p-6">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
              <p className="text-gray-600 mb-4">View your performance and earnings</p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveView('analytics');
                  toast.success('Opening Analytics Dashboard');
                }}
              >
                View Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      <div className="bg-white rounded-lg shadow-sm border">
        <Tabs defaultValue="upcoming" className="w-full">
          <div className="border-b border-gray-200 px-6 py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upcoming">Upcoming Sessions</TabsTrigger>
              <TabsTrigger value="completed">Completed Sessions</TabsTrigger>
              <TabsTrigger value="reviews">Reviews & Ratings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upcoming" className="space-y-4 p-6">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map(session => {
                const displayName = session.candidateName || 'John Doe';
                const avatarUrl = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
                
                return (
                  <Card key={session.id} className="border-0 shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={avatarUrl} />
                            <AvatarFallback>{displayName ? displayName.split(' ').map(n => n[0]).join('') : 'C'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-gray-900">{displayName}</h3>
                            <p className="text-sm text-gray-600 capitalize">{session.sessionType || session.type}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                              <span>
                                {formatDate(session.scheduledDate || session.date || '', session.time)} 
                                {session.time && ` at ${session.time}`}
                                {!session.time && session.scheduledDate && ` at ${new Date(session.scheduledDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                              <span>{session.duration} minutes</span>
                              <span className="text-green-600 font-medium">${session.paymentAmount}</span>
                            </div>
                            {session.meetingLink && (
                              <div className="mt-2">
                                <a 
                                  href={session.meetingLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                >
                                  <Video className="h-3 w-3" />
                                  Meeting Link
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {session.meetingLink && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                // Extract meetingId from meetingLink or use session.meetingId
                                if (session.meetingId) {
                                  navigate(`/meeting/${session.meetingId}`);
                                } else if (session.meetingLink) {
                                  // Extract meetingId from URL if it's a full URL
                                  try {
                                    const url = new URL(session.meetingLink);
                                    const meetingIdFromUrl = url.pathname.split('/meeting/')[1];
                                    if (meetingIdFromUrl) {
                                      navigate(`/meeting/${meetingIdFromUrl}`);
                                    } else {
                                      navigate(session.meetingLink);
                                    }
                                  } catch (e) {
                                    // If it's not a full URL, treat it as a relative path
                                    navigate(session.meetingLink);
                                  }
                                }
                              }}
                            >
                              <Video className="h-4 w-4 mr-2" />
                              Join Meeting
                          </Button>
                          )}
                          {session.recordingUrl && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={async () => {
                                try {
                                  // Get fresh signed URL from backend
                                  const response = await apiService.request(`/api/sessions/${session.id}/recording`, {
                                    method: 'GET'
                                  });
                                  
                                  if (response.success && response.data?.recordingUrl) {
                                    window.open(response.data.recordingUrl, '_blank');
                                  } else {
                                    // Fallback to stored URL
                                    window.open(session.recordingUrl, '_blank');
                                  }
                                } catch (error) {
                                  console.error('Error getting recording URL:', error);
                                  // Fallback to stored URL
                                  window.open(session.recordingUrl, '_blank');
                                }
                              }}
                            >
                            <Video className="h-4 w-4 mr-2" />
                              View Recording
                          </Button>
                          )}
                          {session.isRecordingEnabled && !session.recordingUrl && (
                            <span className="text-xs text-gray-500 flex items-center">
                              <Video className="h-3 w-3 mr-1" />
                              Recording enabled
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="border-0 shadow-md">
                <CardContent className="p-12 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No upcoming sessions</h3>
                  <p className="text-gray-500 mb-6">Your upcoming coaching sessions will appear here.</p>
                  <Button onClick={() => navigate(`/expert/${user.id}`)} className="bg-blue-600 hover:bg-blue-700">
                    Update Your Profile
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 p-6">
            {completedSessions.length > 0 ? (
              completedSessions.map(session => (
                <Card key={session.id} className="border-0 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" />
                          <AvatarFallback>JD</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-gray-900">{session.candidateName || 'John Doe'}</h3>
                          <p className="text-sm text-gray-600">{session.sessionType || session.type}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span>{formatDate(session.scheduledDate || session.date || '', session.time)}</span>
                            <span className="text-green-600 font-medium">${session.paymentAmount}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {session.recordingUrl && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              try {
                                // Get fresh signed URL from backend
                                const response = await apiService.request(`/api/sessions/${session.id}/recording`, {
                                  method: 'GET'
                                });
                                
                                if (response.success && response.data?.recordingUrl) {
                                  window.open(response.data.recordingUrl, '_blank');
                                } else {
                                  // Fallback to stored URL
                                  window.open(session.recordingUrl, '_blank');
                                }
                              } catch (error) {
                                // Silently fallback to stored URL
                                window.open(session.recordingUrl, '_blank');
                              }
                            }}
                          >
                            <Video className="h-4 w-4 mr-2" />
                            View Recording
                        </Button>
                        )}
                        {!session.recordingUrl && session.isRecordingEnabled && (
                          <span className="text-xs text-gray-500 flex items-center">
                            Recording processing...
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-0 shadow-md">
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No completed sessions</h3>
                  <p className="text-gray-500">Your completed coaching sessions will appear here.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4 p-6">
            <Card className="border-0 shadow-md">
              <CardContent className="p-12 text-center">
                <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No reviews yet</h3>
                <p className="text-gray-500">Reviews and ratings from your students will appear here after completed sessions.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Users, Clock, Calendar } from 'lucide-react';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/contexts/AuthContext';

export default function Meeting() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meetingId) {
      navigate('/dashboard');
      return;
    }

    // Fetch session by meeting ID
    const fetchSession = async () => {
      try {
        const response = await apiService.getSessions(100);
        if (response.success && response.data?.sessions) {
          const foundSession = response.data.sessions.find(
            (s: any) => s.meetingId === meetingId
          );
          if (foundSession) {
            setSession(foundSession);
          } else {
            console.error('Session not found for meeting ID:', meetingId);
          }
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [meetingId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Meeting Not Found</h2>
            <p className="text-gray-600 mb-4">The meeting link is invalid or the session has been cancelled.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isParticipant = 
    user?.id === session.candidateId || 
    user?.id === session.expertId ||
    (session.additionalParticipants && session.additionalParticipants.includes(user?.id));

  if (!isParticipant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">You don't have permission to access this meeting.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const meetingDate = new Date(session.scheduledDate);
  const isUpcoming = meetingDate > new Date();
  const isNow = Math.abs(meetingDate.getTime() - Date.now()) < 15 * 60 * 1000; // Within 15 minutes

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-6 w-6" />
              Interview Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Session Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{meetingDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>{meetingDate.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })} ({session.duration} minutes)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>
                      {session.candidateName} & {session.expertName}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Session Type</h3>
                <p className="text-sm capitalize">{session.sessionType}</p>
                {session.isRecordingEnabled && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Recording enabled for this session
                  </p>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              {isNow || !isUpcoming ? (
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-semibold">Ready to Join</h3>
                  <p className="text-gray-600">
                    {isNow 
                      ? "It's time for your session! Click below to join the meeting."
                      : "The session time has arrived. Click below to join the meeting."}
                  </p>
                  {session.meetingLink && (
                    <Button 
                      size="lg" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        // Open the actual meeting link (Zoom, Google Meet, or custom)
                        if (session.meetingLink.startsWith('http')) {
                          window.open(session.meetingLink, '_blank');
                        } else {
                          // If it's a relative path, navigate to it
                          window.location.href = session.meetingLink;
                        }
                      }}
                    >
                      <Video className="h-5 w-5 mr-2" />
                      Join Meeting Room
                    </Button>
                  )}
                  <p className="text-xs text-gray-500">
                    Meeting ID: {session.meetingId}
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-semibold">Meeting Scheduled</h3>
                  <p className="text-gray-600">
                    Your meeting is scheduled for {meetingDate.toLocaleString('en-US')}.
                  </p>
                  <p className="text-sm text-gray-500">
                    The meeting link will be available when it's time to join.
                  </p>
                  <Button variant="outline" onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </div>

            {session.recordingUrl && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-2">Recording</h3>
                <Button 
                  variant="outline"
                  onClick={() => window.open(session.recordingUrl, '_blank')}
                >
                  <Video className="h-4 w-4 mr-2" />
                  View Recording
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


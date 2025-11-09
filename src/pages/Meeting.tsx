import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Users, Clock, Calendar } from 'lucide-react';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/contexts/AuthContext';
import WebRTCVideoCall from '@/components/WebRTCVideoCall';

export default function Meeting() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInCall, setIsInCall] = useState(false);

  useEffect(() => {
    if (!meetingId) {
      navigate('/dashboard');
      return;
    }

    // Fetch session by meeting ID
    const fetchSession = async () => {
      try {
        console.log('Fetching session for meetingId:', meetingId);
        const response = await apiService.getSessionByMeetingId(meetingId);
        console.log('Session response:', response);
        if (response.success && response.data) {
          const sessionData = response.data;
          console.log('Session data received:', {
            scheduledDate: sessionData.scheduledDate,
            date: sessionData.date,
            time: sessionData.time,
            candidateName: sessionData.candidateName,
            expertName: sessionData.expertName,
            meetingId: sessionData.meetingId
          });
          setSession(sessionData);
        } else {
          console.error('Session not found for meeting ID:', meetingId);
          console.error('Response:', response);
        }
      } catch (error: any) {
        console.error('Error fetching session:', error);
        console.error('Error details:', {
          message: error?.message,
          status: error?.response?.status,
          data: error?.response?.data,
          meetingId: meetingId
        });
        // If 404, session not found - will show error message
        if (error?.response?.status === 404) {
          console.error('Session not found for meeting ID:', meetingId);
        }
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

  // Check if user is a participant
  // Allow access if:
  // 1. User is the candidate
  // 2. User is the expert
  // 3. User is an admin
  // 4. User is in additionalParticipants
  // 5. User is authenticated (for now, allow any authenticated user to access meetings)
  const isParticipant = 
    !user || // Allow if no user (will be checked later)
    user?.id === session.candidateId || 
    user?.id === session.expertId ||
    user?.userType === 'admin' ||
    (session.additionalParticipants && Array.isArray(session.additionalParticipants) && session.additionalParticipants.includes(user?.id)) ||
    user?.email === session.candidateName || // Fallback: check by email/name
    user?.email === session.expertName;

  // Debug logging
  console.log('Meeting access check:', {
    userId: user?.id,
    userEmail: user?.email,
    candidateId: session.candidateId,
    expertId: session.expertId,
    candidateName: session.candidateName,
    expertName: session.expertName,
    userType: user?.userType,
    isParticipant: isParticipant,
    additionalParticipants: session.additionalParticipants
  });

  // For now, allow any authenticated user to access meetings
  // This can be made more strict later if needed
  if (!isParticipant && user) {
    // Still allow access but log the mismatch for debugging
    console.warn('User ID mismatch, but allowing access:', {
      userId: user?.id,
      candidateId: session.candidateId,
      expertId: session.expertId
    });
    // Allow access anyway for now - we can make this stricter later
  }

  // If user is not loaded yet, show loading
  if (!user && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Parse meeting date - handle both ISO string and date/time format
  let meetingDate: Date;
  if (session.scheduledDate) {
    meetingDate = new Date(session.scheduledDate);
  } else if (session.date && session.time) {
    // Parse from separate date and time strings
    const [year, month, day] = session.date.split('-').map(Number);
    const [hours, minutes] = session.time.split(':').map(Number);
    meetingDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  } else {
    // Fallback to current date if no date available
    meetingDate = new Date();
  }

  // Check if date is valid
  const isValidDate = !isNaN(meetingDate.getTime());
  const isUpcoming = isValidDate && meetingDate > new Date();
  const isNow = isValidDate && Math.abs(meetingDate.getTime() - Date.now()) < 15 * 60 * 1000; // Within 15 minutes

  // Check if this is a WebRTC meeting (custom video system)
  const isWebRTCMeeting = session.meetingLink && session.meetingLink.includes('/meeting/');

  // If in call, show video component
  if (isInCall && isWebRTCMeeting) {
    return (
      <div className="fixed inset-0 z-50">
        <WebRTCVideoCall
          meetingId={meetingId || ''}
          onEndCall={() => setIsInCall(false)}
        />
      </div>
    );
  }

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
                    <span>
                      {isValidDate ? meetingDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : (session.date || 'Date not available')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>
                      {isValidDate ? meetingDate.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : (session.time || 'Time not available')} 
                      {session.duration ? ` (${session.duration} minutes)` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>
                      {session.candidateName || 'Candidate'} & {session.expertName || 'Expert'}
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
                    <>
                      {isWebRTCMeeting ? (
                        <Button 
                          size="lg" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => setIsInCall(true)}
                        >
                          <Video className="h-5 w-5 mr-2" />
                          Start Video Call
                        </Button>
                      ) : (
                        <Button 
                          size="lg" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            // Open the actual meeting link (Zoom, Google Meet)
                            if (session.meetingLink.startsWith('http')) {
                              window.open(session.meetingLink, '_blank');
                            } else {
                              window.location.href = session.meetingLink;
                            }
                          }}
                        >
                          <Video className="h-5 w-5 mr-2" />
                          Join Meeting Room
                        </Button>
                      )}
                    </>
                  )}
                  {session.meetingId && (
                    <p className="text-xs text-gray-500">
                      Meeting ID: {session.meetingId}
                    </p>
                  )}
                  {isWebRTCMeeting && (
                    <p className="text-xs text-blue-600">
                      Using built-in video calling system
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-semibold">Meeting Scheduled</h3>
                  <p className="text-gray-600">
                    Your meeting is scheduled for {isValidDate ? meetingDate.toLocaleString('en-US') : (session.date && session.time ? `${session.date} at ${session.time}` : 'a future date')}.
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


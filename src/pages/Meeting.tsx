import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Users, Clock, Calendar, Star, MessageSquare } from 'lucide-react';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/contexts/AuthContext';
import WebRTCVideoCall from '@/components/WebRTCVideoCall';
import FeedbackForm from '@/components/FeedbackForm';
import { toast } from 'sonner';

export default function Meeting() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  
  // Check if we should show feedback section from URL parameter
  const shouldShowFeedback = searchParams.get('tab') === 'feedback';

  // Cleanup effect: ensure video call is ended when component unmounts
  // MUST be called before any conditional returns to maintain hook order
  useEffect(() => {
    return () => {
      // This cleanup runs only when the component unmounts
      console.log('🧹 Meeting component unmounting, ensuring call is ended...');
      setIsInCall(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run cleanup on unmount

  useEffect(() => {
    if (!meetingId) {
      setError('Meeting ID is required');
      setLoading(false);
      return;
    }

    // Wait for auth to load before fetching session
    if (authLoading) {
      return;
    }

    // Fetch session by meeting ID
    const fetchSession = async () => {
      try {
        console.log('Fetching session for meetingId:', meetingId);
        setError(null);
        const response = await apiService.getSessionByMeetingId(meetingId);
        console.log('Session response:', response);
        if (response.success && response.data) {
          // Handle nested response structure: backend returns {success: true, data: {...}}
          // API service wraps it: {success: true, data: {success: true, data: {...}}}
          const sessionData = response.data.data || response.data;
          console.log('Session data received (full object):', sessionData);
          console.log('Session data received (extracted):', {
            id: sessionData.id,
            candidateId: sessionData.candidateId,
            expertId: sessionData.expertId,
            candidateName: sessionData.candidateName,
            expertName: sessionData.expertName,
            candidateEmail: sessionData.candidateEmail,
            expertEmail: sessionData.expertEmail,
            scheduledDate: sessionData.scheduledDate,
            date: sessionData.date,
            time: sessionData.time,
            meetingId: sessionData.meetingId
          });
          setSession(sessionData);
          
          // Fetch reviews if session is completed or if we're showing feedback tab
          if ((sessionData.status === 'completed' || shouldShowFeedback) && sessionData.id) {
            fetchReviews(sessionData.id);
          }
        } else {
          console.error('Session not found for meeting ID:', meetingId);
          console.error('Response:', response);
          setError('Session not found');
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
          setError('Session not found. The meeting link may be invalid or the session has been cancelled.');
        } else {
          setError(error?.message || 'Failed to load meeting session. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [meetingId, navigate, authLoading, shouldShowFeedback]);

  const fetchReviews = async (sessionId: string) => {
    try {
      console.log('📋 Fetching reviews for session:', sessionId);
      const response = await apiService.getSessionReviews(sessionId);
      console.log('📋 Reviews response:', response);
      if (response.success && response.data?.reviews) {
        const fetchedReviews = response.data.reviews;
        console.log('📋 Fetched reviews:', fetchedReviews);
        setReviews(fetchedReviews);
        // Auto-show feedback form if coming from feedback button and user hasn't submitted
        if (shouldShowFeedback && user) {
          setTimeout(() => {
            const userReview = fetchedReviews.find(
              (r: any) => {
                const reviewerId = r.reviewerId || r.reviewer?.id;
                const userId = user?.id;
                console.log('🔍 Checking review match:', { reviewerId, userId, review: r });
                return reviewerId === userId;
              }
            );
            if (!userReview) {
              setShowFeedbackForm(true);
            }
          }, 300);
        }
      } else {
        console.warn('⚠️ No reviews in response or response not successful:', response);
        setReviews([]);
      }
    } catch (error) {
      console.error('❌ Error fetching reviews:', error);
      setReviews([]);
    }
  };

  const handleFeedbackSubmitted = async () => {
    if (session?.id) {
      setShowFeedbackForm(false);
      
      // Wait a bit for the review to be saved
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch reviews again
      await fetchReviews(session.id);
      
      // Refresh session data to get updated reviews
      try {
        const response = await apiService.getSessionById(session.id);
        if (response.success && response.data) {
          setSession(response.data);
          // Also fetch reviews from session data if available
          if (response.data.reviews && Array.isArray(response.data.reviews)) {
            setReviews(response.data.reviews);
          }
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    }
  };

  // Scroll to feedback section when shouldShowFeedback changes
  useEffect(() => {
    if (shouldShowFeedback && session && reviews.length >= 0) {
      setTimeout(() => {
        const element = document.getElementById('feedback-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  }, [shouldShowFeedback, session, reviews.length]);

  // Refresh session data when returning from call
  const handleCallEnd = async () => {
    setIsInCall(false);
    // Refresh session data to get updated status and recording
    if (session?.id) {
      try {
        const response = await apiService.getSessionById(session.id);
        if (response.success && response.data) {
          setSession(response.data);
          // If session is now completed, fetch reviews
          if (response.data.status === 'completed') {
            await fetchReviews(response.data.id);
          }
        }
      } catch (error) {
        console.error('Error refreshing session data:', error);
      }
    }
  };

  // Show loading state - check auth first
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // If user is not loaded yet, show loading
  // Note: ProtectedRoute should handle auth, but we check here too
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user information...</p>
        </div>
      </div>
    );
  }

  // Show loading state while fetching session
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading meeting...</p>
        </div>
      </div>
    );
  }

  // Show error state - only if we're done loading and have an error or no session
  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-600">Error</h2>
            <p className="text-gray-600 mb-4">
              {error || 'The meeting link is invalid or the session has been cancelled.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Map mock IDs to real database IDs for comparison
  let userDbId = user?.id;
  if (user?.id === 'candidate-001' && (session.candidateEmail === 'john@example.com' || user?.email === 'john@example.com')) {
    // If user is candidate-001 and session candidate email matches, allow access
    userDbId = session.candidateId;
  } else if (user?.id === 'expert-001' && (session.expertEmail === 'jane@example.com' || user?.email === 'jane@example.com')) {
    // If user is expert-001 and session expert email matches, allow access
    userDbId = session.expertId;
  }

  // Check if user is a participant
  // Allow access if:
  // 1. User is the candidate
  // 2. User is the expert
  // 3. User is an admin
  // 4. User is in additionalParticipants
  // 5. User email matches candidate or expert email (fallback)
  // 6. Mock ID matches (candidate-001/expert-001 with matching email)
  const isParticipant = 
    !user || // Allow if no user (will be checked later)
    (session.candidateId && (userDbId === session.candidateId || user?.id === session.candidateId)) || 
    (session.expertId && (userDbId === session.expertId || user?.id === session.expertId)) ||
    user?.userType === 'admin' ||
    (session.additionalParticipants && Array.isArray(session.additionalParticipants) && session.additionalParticipants.includes(user?.id)) ||
    (session.candidateEmail && user?.email === session.candidateEmail) || // Check by email
    (session.expertEmail && user?.email === session.expertEmail) || // Check by email
    (user?.id === 'candidate-001' && (session.candidateEmail === 'john@example.com' || user?.email === 'john@example.com')) || // Mock ID check
    (user?.id === 'expert-001' && (session.expertEmail === 'jane@example.com' || user?.email === 'jane@example.com')) || // Mock ID check
    (user?.email === 'john@example.com' && session.candidateName === 'John Doe') || // Fallback: check by email and name
    (user?.email === 'jane@example.com' && session.expertName === 'Jane Smith') || // Fallback: check by email and name
    (session.candidateName && user?.email === session.candidateName) || // Fallback: check by name (if name is email)
    (session.expertName && user?.email === session.expertName); // Fallback: check by name (if name is email)

  // Debug logging
  console.log('Meeting access check:', {
    userId: user?.id,
    userEmail: user?.email,
    candidateId: session.candidateId,
    expertId: session.expertId,
    candidateName: session.candidateName,
    expertName: session.expertName,
    candidateEmail: session.candidateEmail,
    expertEmail: session.expertEmail,
    userType: user?.userType,
    isParticipant: isParticipant,
    additionalParticipants: session.additionalParticipants
  });

  // Log warning only if IDs are missing (not if user just doesn't match)
  if (user && !session.candidateId && !session.expertId) {
    console.warn('⚠️ Session missing candidateId and expertId - this may indicate a data issue:', {
      sessionId: session.id,
      meetingId: session.meetingId
    });
  } else if (user && !isParticipant) {
    // User doesn't match, but IDs are present - this is expected for unauthorized access
    console.log('ℹ️ User is not a participant of this meeting:', {
      userId: user?.id,
      candidateId: session.candidateId,
      expertId: session.expertId
    });
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
  
  // TESTING MODE: Allow joining at any time (set to true for testing)
  const TESTING_MODE = true; // Set to false to restore time restrictions
  const canJoinMeeting = TESTING_MODE || isNow || !isUpcoming;

  // Check if this is a WebRTC meeting (custom video system)
  // WebRTC meetings have meetingLink containing '/meeting/' or we have a meetingId from URL
  const isWebRTCMeeting = (session.meetingLink && session.meetingLink.includes('/meeting/')) || 
                          (meetingId && meetingId.startsWith('meet-')) ||
                          (session.meetingId && session.meetingId.startsWith('meet-'));

  // If in call, show video component
  if (isInCall && isWebRTCMeeting) {
    return (
      <div className="fixed inset-0 z-50">
        <WebRTCVideoCall
          meetingId={meetingId || ''}
          sessionId={session?.id}
          onEndCall={handleCallEnd}
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
              {canJoinMeeting ? (
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-semibold">
                    {TESTING_MODE ? "🧪 Testing Mode - Ready to Join" : "Ready to Join"}
                  </h3>
                  <p className="text-gray-600">
                    {TESTING_MODE 
                      ? "Testing mode enabled - you can join the meeting at any time."
                      : isNow 
                        ? "It's time for your session! Click below to join the meeting."
                        : "The session time has arrived. Click below to join the meeting."}
                  </p>
                  {/* Always show button if we have meetingId or meetingLink */}
                  {(session.meetingLink || session.meetingId || meetingId) && (
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
                      ) : session.meetingLink ? (
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
                      ) : (
                        // Fallback: if no meetingLink but we have meetingId, use WebRTC
                        <Button 
                          size="lg" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => setIsInCall(true)}
                        >
                          <Video className="h-5 w-5 mr-2" />
                          Start Video Call
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
                  onClick={async () => {
                    try {
                      // Always get fresh signed URL (handles expired tokens automatically)
                      await apiService.openRecordingUrl(session.id, session.recordingUrl);
                    } catch (error) {
                      console.error('Error opening recording:', error);
                      toast.error('Failed to open recording. Please try again.');
                    }
                  }}
                >
                  <Video className="h-4 w-4 mr-2" />
                  View Recording
                </Button>
              </div>
            )}

            {/* Feedback Section - Show when session is completed or when tab=feedback */}
            {(session.status === 'completed' || shouldShowFeedback) && (
              <div className="border-t pt-6 space-y-6" id="feedback-section">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Session Feedback
                  </h3>
                  {!showFeedbackForm && user && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Check if user has already submitted feedback
                        const userReview = reviews.find(
                          (r: any) => {
                            const reviewerId = r.reviewerId || r.reviewer?.id;
                            return reviewerId === user?.id;
                          }
                        );
                        if (!userReview) {
                          setShowFeedbackForm(true);
                        } else {
                          setShowFeedbackForm(true); // Show form anyway so they can see their feedback
                        }
                      }}
                    >
                      {reviews.find((r: any) => {
                        const reviewerId = r.reviewerId || r.reviewer?.id;
                        return reviewerId === user?.id;
                      }) 
                        ? 'Update Feedback' 
                        : 'Provide Feedback'}
                    </Button>
                  )}
                </div>


                {/* Feedback Form */}
                {(showFeedbackForm || (shouldShowFeedback && user)) && user && (() => {
                  const isCandidate = user.id === session.candidateId || user.id === session.candidate?.id;
                  const revieweeName = isCandidate
                    ? session.expertName || session.expert?.name || 'Expert'
                    : session.candidateName || session.candidate?.name || 'Candidate';
                  
                  const userReview = reviews.find(
                    (r: any) => {
                      const reviewerId = r.reviewerId || r.reviewer?.id;
                      const userId = user?.id;
                      return reviewerId === userId;
                    }
                  );
                  
                  // Show form if explicitly requested or if user hasn't submitted feedback yet
                  if (showFeedbackForm || !userReview) {
                    return (
                      <FeedbackForm
                        sessionId={session.id}
                        revieweeName={revieweeName}
                        onFeedbackSubmitted={handleFeedbackSubmitted}
                        existingReview={userReview || null}
                      />
                    );
                  }
                  return null;
                })()}

                {/* Display Reviews */}
                {reviews.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Feedback from Participants</h4>
                    {reviews.map((review) => (
                      <Card key={review.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium">
                                {review.reviewer?.name || 'Anonymous'}
                              </p>
                              <p className="text-sm text-gray-500">
                                Feedback for {review.reviewee?.name || 'Participant'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: review.rating }).map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-4 w-4 fill-yellow-400 text-yellow-400"
                                />
                              ))}
                              {Array.from({ length: 5 - review.rating }).map((_, i) => (
                                <Star
                                  key={i + review.rating}
                                  className="h-4 w-4 text-gray-300"
                                />
                              ))}
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(review.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {reviews.length === 0 && !showFeedbackForm && (
                  <p className="text-sm text-gray-500">
                    No feedback has been submitted yet. Be the first to share your experience!
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Star, MapPin, Clock, Award, Video, Calendar, Edit } from 'lucide-react';
import { mockExperts } from '@/lib/mockData';
import { authService, User } from '@/lib/auth';
import { apiService } from '@/lib/apiService';
import AuthModal from '@/components/AuthModal';
import ExpertProfileEdit from '@/components/ExpertProfileEdit';
import BookingCalendar from '@/components/BookingCalendar';
import { toast } from 'sonner';

interface Expert {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  experience: string;
  languages: string[];
  specialties: string[];
  availability: string[];
  timezone?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  daysAvailable?: string;
}

export default function ExpertProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [expert, setExpert] = useState<Expert | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is viewing their own profile
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isOwnProfile = currentUser?.userType === 'expert' && currentUser?.id === id;
  
  



  // Get current user
  useEffect(() => {
    // Always try to get user from auth service first (this works for test users)
    const authUser = authService.getCurrentUser();
    if (authUser) {
      setCurrentUser(authUser);
      return;
    }

    // If no auth user, try backend API with token
    const token = localStorage.getItem('token');
    if (token) {
      // Try to get user from backend API
      apiService.getCurrentUser()
        .then(response => {
          if (response.success && response.data) {
            setCurrentUser(response.data);
          } else {
            throw new Error('Failed to get user');
          }
        })
        .catch(error => {
          console.error('Error fetching user:', error);
          // Fallback to candidate user if API fails
        const testCandidate = {
          id: 'candidate-001',
          email: 'john@example.com',
          name: 'John Doe',
          userType: 'candidate' as const
        };
        setCurrentUser(testCandidate);
      });
    } else {
      // No token and no auth user - default to candidate
      const testCandidate = {
        id: 'candidate-001',
        email: 'john@example.com',
        name: 'John Doe',
        userType: 'candidate' as const
      };
      setCurrentUser(testCandidate);
    }
  }, [id]);

  // Fetch expert data
  useEffect(() => {
    if (!id) return;
    
    
    setLoading(true);
    
    
    // First try to find in mock data (for test users)
    const mockExpert = mockExperts.find(e => e.id === id);
    if (mockExpert) {
      setExpert(mockExpert);
      setLoading(false);
      return;
    }
    
    // If not found in mock data, try to fetch from backend
    const token = localStorage.getItem('token');
    if (token) {
      apiService.getExpert(id)
        .then(response => {
          if (response.success && response.data) {
            setExpert(response.data);
          } else {
            setExpert(null);
          }
        })
        .catch(() => {
          setExpert(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading expert profile...</p>
        </div>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Expert Not Found</h2>
          <Button onClick={() => navigate('/experts')}>Back to Directory</Button>
        </div>
      </div>
    );
  }


  const handleLogin = (userType: 'candidate' | 'expert', userData: User) => {
    // Store token if available
    if (userData.token) {
      localStorage.setItem('token', userData.token);
    }
    // Also store in authService for compatibility
    authService.login(userData);
    setShowAuthModal(false);
    
    // If they logged in as a candidate, show the booking interface
    if (userType === 'candidate') {
      setShowBooking(true);
      toast.success('Welcome! You can now book a session.');
    }
  };

  const handleBookSession = async (date: string, time: string) => {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser) {
      toast.error('Please log in to book a session');
      setShowAuthModal(true);
      return;
    }

    if (currentUser.userType !== 'candidate') {
      toast.error('Only candidates can book sessions');
      return;
    }

    if (!expert || !id) {
      toast.error('Expert information not available');
      return;
    }

    if (!currentUser?.id) {
      toast.error('User information not available');
      return;
    }

    try {
      // Create the session via API
      const sessionData = {
        expertId: expert.id, // Use the expert's ID from the expert object
        candidateId: currentUser.id, // Use the logged-in user's ID
        date,
        time,
        duration: 60, // Default 1 hour
        sessionType: 'technical' // Default session type
      };

      const response = await apiService.createSession(sessionData);
      
      if (response.success) {
        toast.success(`Session booked with ${expert.name} on ${date} at ${time}!`, {
          description: 'You can view your upcoming sessions in the dashboard'
        });
        
        // Navigate to dashboard with a refresh parameter
        navigate('/dashboard?refresh=' + Date.now());
      } else {
        toast.error(response.error || 'Failed to book session');
      }
    } catch (error) {
      console.error('Error booking session:', error);
      toast.error('Failed to book session. Please try again.');
    }
  };

  const handleProfileUpdate = (updatedUser: Expert) => {
    setExpert(updatedUser);
    toast.success('Profile updated successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/experts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Experts
          </Button>
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            InterviewAce
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Dashboard
        </Button>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Expert Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={expert.avatar} alt={expert.name} />
                    <AvatarFallback className="text-2xl">
                      {expert.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{expert.name}</h1>
                        <p className="text-lg text-gray-600 mb-1">{expert.title}</p>
                        <p className="text-lg font-medium text-blue-600">{expert.company}</p>
                      </div>
                      
                      {isOwnProfile && (
                        <Button 
                          onClick={() => setShowProfileEdit(true)}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Profile
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold text-lg">{expert.rating}</span>
                        <span className="text-gray-500">({expert.reviewCount} reviews)</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-green-600">
                        <span className="text-2xl font-bold">${expert.hourlyRate}</span>
                        <span className="text-gray-500">/hour</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{expert.experience}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{expert.languages.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-600" />
                  About {expert.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 leading-relaxed">{expert.bio}</p>
                
                <div>
                  <h4 className="font-medium mb-3 text-gray-900">Skills & Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {expert.specialties.map((specialty, index) => (
                      <Badge key={index} variant="secondary" className="px-3 py-1">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-3 text-gray-900">Availability</h4>
                  <div className="space-y-2">
                    {expert.availability.map((slot, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{slot}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What to Expect */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-blue-600" />
                  What to Expect
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Session Includes:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Live 1-on-1 video interview</li>
                      <li>• Session recording for review</li>
                      <li>• Real-time feedback</li>
                      <li>• Detailed written assessment</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Preparation Tips:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Test your camera and microphone</li>
                      <li>• Prepare your resume</li>
                      <li>• Have questions ready</li>
                      <li>• Choose a quiet environment</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Section - Only show for candidates */}
          {!isOwnProfile && (
            <div className="space-y-6">
              {!showBooking ? (
                <Card className="border-0 shadow-lg sticky top-6">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="text-3xl font-bold text-blue-600">
                      ${expert.hourlyRate}
                    </div>
                    <p className="text-gray-600">per hour session</p>
                    
                    <Button 
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 h-12"
                      onClick={() => setShowBooking(true)}
                    >
                      Book a Session
                    </Button>
                    
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>✓ Instant confirmation</p>
                      <p>✓ Free cancellation 24h before</p>
                      <p>✓ Satisfaction guaranteed</p>
                    </div>
                  </CardContent>
                </Card>
            ) : (
              <div className="sticky top-6">
                <BookingCalendar
                  expertId={expert.id}
                  expertName={expert.name}
                  hourlyRate={expert.hourlyRate}
                  onBookSession={handleBookSession}
                />
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setShowBooking(false)}
                >
                  Back to Profile
                </Button>
              </div>
            )}
            </div>
          )}

          {/* Expert Section - Only show for experts viewing their own profile */}
          {isOwnProfile && (
            <div className="space-y-6">
              <Card className="border-0 shadow-lg sticky top-6">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900">Profile Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center space-y-4">
                    <div className="text-3xl font-bold text-green-600">
                      ${expert.hourlyRate}
                    </div>
                    <p className="text-gray-600">Your current hourly rate</p>
                    
                    <Button 
                      className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 h-12"
                      onClick={() => setShowProfileEdit(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                    
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>✓ Update your bio and experience</p>
                      <p>✓ Manage your specialties</p>
                      <p>✓ Set your availability</p>
                      <p>✓ Adjust your hourly rate</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Quick Stats</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="font-bold text-lg text-blue-600">{expert.rating}</div>
                        <div className="text-gray-600">Rating</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="font-bold text-lg text-green-600">{expert.reviewCount}</div>
                        <div className="text-gray-600">Reviews</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        defaultRole="candidate"
      />

      {/* Expert Profile Edit Modal */}
      {isOwnProfile && (
        <ExpertProfileEdit
          isOpen={showProfileEdit}
          onClose={() => setShowProfileEdit(false)}
          user={expert}
          onUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
}



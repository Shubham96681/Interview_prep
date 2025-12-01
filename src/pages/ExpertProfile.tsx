import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Star, MapPin, Clock, Award, Video, Calendar, Edit } from 'lucide-react';
import { authService, User } from '@/lib/auth';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';
import ExpertProfileEdit from '@/components/ExpertProfileEdit';
import BookingCalendar from '@/components/BookingCalendar';
import { toast } from 'sonner';
import { getAvatarUrl } from '@/lib/avatarUtils';

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
  isActive?: boolean;
  isVerified?: boolean;
}

export default function ExpertProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { login: authLogin, user: authUser } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [expert, setExpert] = useState<Expert | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is viewing their own profile
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isOwnProfile = currentUser?.userType === 'expert' && currentUser?.id === id;
  
  



  // Get current user - prefer AuthContext, fallback to authService
  useEffect(() => {
    // First, try AuthContext (most reliable - uses backend-validated user)
    if (authUser) {
      // Validate that the user has a valid database ID
      if (authUser.id && !authUser.id.startsWith('user-')) {
        setCurrentUser(authUser);
        return;
      } else if (authUser.id && authUser.id.startsWith('user-')) {
        console.error('❌ ExpertProfile: AuthContext user has frontend-generated ID:', authUser.id);
        console.error('❌ This should not happen. User needs to log out and log back in.');
      }
    }

    // Fallback to authService (for backward compatibility)
    const localAuthUser = authService.getCurrentUser();
    if (localAuthUser) {
      // Validate that the user has a valid database ID
      if (localAuthUser.id && !localAuthUser.id.startsWith('user-')) {
        setCurrentUser(localAuthUser);
        return;
      } else if (localAuthUser.id && localAuthUser.id.startsWith('user-')) {
        console.error('❌ ExpertProfile: Local auth user has frontend-generated ID:', localAuthUser.id);
        console.error('❌ Clearing invalid user data. User needs to log in again.');
        authService.logout();
        localStorage.removeItem('token');
      }
    }

    // If no valid user, try backend API with token
    const token = localStorage.getItem('token');
    if (token) {
      // Try to get user from backend API
      apiService.getCurrentUser()
        .then(response => {
          if (response.success && response.data) {
            const userData = response.data.data || response.data;
            // Validate the user has a valid database ID
            if (userData.id && !userData.id.startsWith('user-')) {
              setCurrentUser(userData);
            } else {
              console.error('❌ ExpertProfile: Backend returned invalid user ID:', userData.id);
            }
          }
        })
        .catch(error => {
          console.error('Error fetching user:', error);
        });
    }
  }, [id, authUser]);

  // Fetch expert data
  useEffect(() => {
    if (!id) return;
    
    setLoading(true);

    // Validate ID - reject frontend-generated IDs
    if (id && id.startsWith('user-')) {
      console.error('❌ ExpertProfile: Frontend-generated ID detected:', id);
      console.error('❌ This ID will not work with the backend. Please use a valid database ID.');
      setExpert(null);
      setLoading(false);
      return;
    }
    
    // Always try to fetch from backend (public access is allowed)
    // The backend will handle authentication if token is present
    console.log(`🔍 Fetching expert profile for ID: ${id}`);
    apiService.getExpert(id)
      .then(response => {
        console.log(`📥 Expert API response:`, response);
        if (response.success && response.data) {
          // Transform the backend response to match the Expert interface
          const expertData = response.data;
          
          // Helper function to safely parse JSON strings or return arrays
          const parseJsonField = (field: any, defaultValue: any[] = []): any[] => {
            if (!field) return defaultValue;
            if (Array.isArray(field)) return field;
            if (typeof field === 'string') {
              try {
                return JSON.parse(field);
              } catch {
                return defaultValue;
              }
            }
            return defaultValue;
          };
          
          // Parse daysAvailable for availability display
          const daysAvailable = parseJsonField(expertData.daysAvailable, []);
          const availability: string[] = [];
          if (daysAvailable.length > 0 && expertData.workingHoursStart && expertData.workingHoursEnd) {
            const daysMap: { [key: string]: string } = {
              monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', 
              thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
            };
            daysAvailable.forEach((day: string) => {
              const dayName = daysMap[day.toLowerCase()] || day;
              availability.push(`${dayName}: ${expertData.workingHoursStart} - ${expertData.workingHoursEnd}`);
            });
          }
          
          setExpert({
            id: expertData.id,
            name: expertData.name || 'Unknown',
            title: expertData.title || '',
            company: expertData.company || '',
            bio: expertData.bio || '',
            avatar: expertData.avatar || expertData.profilePhotoPath || '',
            rating: expertData.rating || 0,
            reviewCount: expertData.totalSessions || 0, // Use totalSessions as review count approximation
            hourlyRate: expertData.hourlyRate || 0,
            experience: expertData.experience || expertData.yearsOfExperience || '',
            languages: ['English'], // Default language
            specialties: parseJsonField(expertData.proficiency || expertData.skills, []),
            availability: availability.length > 0 ? availability : ['Available on request'],
            timezone: expertData.timezone,
            workingHoursStart: expertData.workingHoursStart,
            workingHoursEnd: expertData.workingHoursEnd,
            // daysAvailable can be an array (from backend) or a string (from localStorage)
            // ExpertProfileEdit will handle both formats
            daysAvailable: Array.isArray(expertData.daysAvailable) 
              ? JSON.stringify(expertData.daysAvailable) 
              : (expertData.daysAvailable || '["monday","tuesday","wednesday","thursday","friday"]')
          });
        } else {
          console.error(`❌ Expert not found in API response:`, response);
          // Check if it's a 502 error (backend down)
          if (response.status === 502 || (response.error && response.error.includes('502'))) {
            toast.error('Backend server is not responding. Please check if the server is running.');
          } else if (response.status === 404) {
            toast.error('Expert not found. The expert profile may not exist or may be inactive.');
          } else {
            toast.error(response.error || response.message || 'Failed to load expert profile');
          }
          setExpert(null);
        }
      })
      .catch((error) => {
        console.error(`❌ Error fetching expert:`, error);
        // Check if it's a network/connection error
        if (error.message && (error.message.includes('502') || error.message.includes('Bad Gateway'))) {
          toast.error('Backend server is not responding. Please check if the server is running.');
        } else {
          toast.error('Failed to load expert profile. Please try again later.');
        }
        setExpert(null);
      })
      .finally(() => {
        setLoading(false);
      });
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


  const handleLogin = (userType: 'candidate' | 'expert' | 'admin', userData: User) => {
    // Store token if available
    if (userData.token) {
      localStorage.setItem('token', userData.token);
      console.log('✅ Token saved in ExpertProfile:', userData.token.substring(0, 20) + '...');
      
      // Verify token was saved
      const savedToken = localStorage.getItem('token');
      if (!savedToken || savedToken !== userData.token) {
        console.error('❌ Token not saved correctly in ExpertProfile!');
        toast.error('Failed to save authentication token');
        return;
      }
    } else {
      console.error('❌ No token in userData:', userData);
      toast.error('Login failed: No authentication token received');
      return;
    }
    
    // Also store in authService for compatibility
    authService.login(userData);
    
    // Use AuthContext login to properly update global auth state
    authLogin(userData);
    
    setShowAuthModal(false);
    
    // If they logged in as a candidate, show the booking interface
    if (userType === 'candidate') {
      setShowBooking(true);
      toast.success('Welcome! You can now book a session.');
    }
  };

  const handleBookSession = async (date: string, time: string) => {
    // Check authentication via AuthContext first
    let currentUser = authUser || authService.getCurrentUser();
    
    // Check if user is authenticated
    if (!currentUser) {
      console.error('❌ No current user found');
      toast.error('Please log in to book a session');
      setShowAuthModal(true);
      return;
    }

    // Check if token exists - CRITICAL CHECK
    let token = localStorage.getItem('token');
    
    // FALLBACK: If user exists but no token, generate one (for users logged in before token fix)
    if (!token && currentUser) {
      console.warn('⚠️ User logged in but no token found. Generating token...');
      const generatedToken = 'token-' + Date.now() + '-' + Math.random().toString(36).substring(7);
      localStorage.setItem('token', generatedToken);
      
      // Update user object with token
      const userWithToken = { ...currentUser, token: generatedToken };
      localStorage.setItem('user', JSON.stringify(userWithToken));
      
      // Update AuthContext
      authLogin(userWithToken);
      
      token = generatedToken;
      currentUser = userWithToken;
      console.log('✅ Generated and saved token:', token.substring(0, 20) + '...');
      toast.success('Session refreshed. You can now book.');
    }
    
    if (!token) {
      console.error('❌ No token found in localStorage after fallback');
      console.log('Current localStorage:', {
        token: localStorage.getItem('token'),
        user: localStorage.getItem('user')
      });
      toast.error('Authentication token not found. Please log in again.', {
        description: 'Your session may have expired. Please log in to continue.',
        duration: 5000
      });
      setShowAuthModal(true);
      return;
    }
    
    console.log('✅ Token found:', token.substring(0, 20) + '...');

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

      console.log('📤 Creating session with data:', sessionData);
      console.log('🔑 Token available:', token ? 'Yes' : 'No');
      
      const response = await apiService.createSession(sessionData);
      
      if (response.success) {
        toast.success(`Session booked with ${expert.name} on ${date} at ${time}!`, {
          description: 'You can view your upcoming sessions in the dashboard'
        });
        // Navigate to dashboard after a short delay
        setTimeout(() => {
        navigate('/dashboard?refresh=' + Date.now());
        }, 1500);
      } else {
        // Check if it's a scheduling conflict (409)
        if (response.status === 409 || response.error === 'Scheduling conflict') {
          const conflictMessage = response.message || response.error || 'This time slot is already booked';
          toast.error('Time slot unavailable', {
            description: conflictMessage,
            duration: 5000
          });
          // Trigger availability refresh when conflict is detected
          window.dispatchEvent(new CustomEvent('booking-error'));
        } else if (response.status === 403 || response.error === 'Expert not approved') {
          // Handle approval error
          const errorMessage = response.message || response.error || 'This expert profile is pending admin approval and cannot be booked yet.';
          toast.error('Booking Unavailable', {
            description: errorMessage,
            duration: 5000
          });
        } else {
          toast.error(response.error || 'Failed to book session');
        }
      }
    } catch (error: any) {
      console.error('Error booking session:', error);
      
      // Handle conflict error from API
      if (error?.response?.status === 409 || error?.status === 409) {
        const conflictData = error?.response?.data || error?.data || {};
        const conflictMessage = conflictData.message || 'This time slot is already booked. Please choose a different time.';
        toast.error('Time slot unavailable', {
          description: conflictMessage,
          duration: 5000
        });
      } else if (error?.response?.status === 403 || error?.status === 403) {
        // Handle approval error
        const errorData = error?.response?.data || error?.data || {};
        const errorMessage = errorData.message || 'This expert profile is pending admin approval and cannot be booked yet.';
        toast.error('Booking Unavailable', {
          description: errorMessage,
          duration: 5000
        });
      } else {
        toast.error('Failed to book session. Please try again.');
      }
    }
  };

  const handleProfileUpdate = (updatedUser: Expert) => {
    setExpert(updatedUser);
    toast.success('Profile updated successfully!');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/experts')} className="text-gray-700 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Experts
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">I</span>
            </div>
            <div className="text-xl font-bold text-gray-900">InPrepare</div>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-gray-300 text-gray-700 hover:bg-gray-50">
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
                    <AvatarImage src={getAvatarUrl(expert.avatar, expert.name)} alt={expert.name} />
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
                          className="bg-blue-600 hover:bg-blue-700 text-white"
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
                    
                    {/* Show approval status message if expert is not approved */}
                    {expert.isActive === false && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 text-yellow-800 mb-2">
                          <Clock className="h-5 w-5" />
                          <span className="font-semibold">Profile Pending Approval</span>
                        </div>
                        <p className="text-sm text-yellow-700">
                          This expert profile is currently under review by our admin team. 
                          Booking will be available once the profile is approved.
                        </p>
                      </div>
                    )}
                    
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 h-12 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      onClick={() => setShowBooking(true)}
                      disabled={expert.isActive === false}
                    >
                      {expert.isActive === false ? 'Booking Unavailable' : 'Book a Session'}
                    </Button>
                    
                    {expert.isActive !== false && (
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>✓ Instant confirmation</p>
                        <p>✓ Free cancellation 24h before</p>
                        <p>✓ Satisfaction guaranteed</p>
                      </div>
                    )}
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
                      className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-white"
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



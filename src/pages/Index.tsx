import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Users, Calendar, Video, Award, ArrowRight, TrendingUp, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import ContactModal from '@/components/ContactModal';
import { useAuth } from '@/contexts/AuthContext';
import ExpertCard from '@/components/ExpertCard';
import { apiService } from '@/lib/apiService';
import HeroIllustration from '@/assets/images/image_1.svg?url';
import AboutIllustration from '@/assets/images/image_2.svg?url';
import ServicesIllustration from '@/assets/images/image_3.svg?url';

interface Expert {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  avatar?: string;
  profilePhotoPath?: string;
  rating: number;
  totalSessions: number;
  hourlyRate: number;
  skills?: string | string[];
  proficiency?: string | string[];
  specialties?: string[];
  experience?: string;
  languages?: string[];
}

export default function Index() {
  const navigate = useNavigate();
  const { user, loading, login } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'expert'>('candidate');
  const [showContactModal, setShowContactModal] = useState(false);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [expertsLoading, setExpertsLoading] = useState(true);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
    }

  const handleLogin = (_userType: 'candidate' | 'expert' | 'admin', userData: any) => {
    login(userData);
    setShowAuthModal(false);
  };


  const handleFindExpert = () => {
    setSelectedRole('candidate');
    setShowAuthModal(true);
  };

  const handleBecomeExpert = () => {
    setSelectedRole('expert');
    setShowAuthModal(true);
  };

  // Fetch experts for landing page
  useEffect(() => {
    const fetchExperts = async () => {
      try {
        setExpertsLoading(true);
        const response = await apiService.getExperts();
        
        if (response.success && response.data) {
          let expertsData = null;
          
          if (Array.isArray(response.data)) {
            expertsData = response.data;
          } else if (response.data && response.data.data) {
            if (response.data.data.experts && Array.isArray(response.data.data.experts)) {
              expertsData = response.data.data.experts;
            } else if (Array.isArray(response.data.data)) {
              expertsData = response.data.data;
            }
          } else if (response.data && typeof response.data === 'object' && response.data.experts) {
            if (Array.isArray(response.data.experts)) {
              expertsData = response.data.experts;
            }
          }
          
          if (expertsData && Array.isArray(expertsData)) {
            const parseJsonField = (field: any, defaultValue: any[] = []): string[] => {
              if (!field) return defaultValue;
              if (Array.isArray(field)) return field;
              if (typeof field === 'string') {
                try {
                  const parsed = JSON.parse(field);
                  return Array.isArray(parsed) ? parsed : defaultValue;
                } catch {
                  return defaultValue;
                }
              }
              return defaultValue;
            };

            const transformedExperts = expertsData.map((expert: any) => {
              const skills = parseJsonField(expert.skills, []);
              const proficiency = parseJsonField(expert.proficiency, []);
              const specialties = proficiency.length > 0 ? proficiency : skills;

              return {
                id: expert.id,
                name: expert.name || 'Unknown',
                title: expert.title || '',
                company: expert.company || '',
                bio: expert.bio || '',
                avatar: expert.avatar || expert.profilePhotoPath || '',
                rating: expert.rating || 0,
                totalSessions: expert.totalSessions || 0,
                hourlyRate: expert.hourlyRate || 0,
                specialties: specialties,
                skills: skills,
                proficiency: proficiency,
                experience: expert.experience || expert.yearsOfExperience || '',
                languages: parseJsonField(expert.languages, [])
              };
            });
            
            setExperts(transformedExperts);
          }
        }
      } catch (err) {
        console.error('Error fetching experts:', err);
      } finally {
        setExpertsLoading(false);
      }
    };

    fetchExperts();
  }, []);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <Header showAuthModal={() => setShowAuthModal(true)} />

      {/* Hero Section */}
      <section id="home" className="relative z-10 py-16 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text Content */}
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
              Preparing for Your Next
          </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Discover the Latest Strategies and Techniques to Excel In Your Next Interview. Our comprehensive guide covers everything from Resume Optimization to Mastering the Art of Communication.
          </p>
            <div className="flex flex-col sm:flex-row gap-4">
            {(!user || user.userType === 'candidate') && (
              <Button 
                size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-lg"
                onClick={user ? () => navigate('/experts') : handleFindExpert}
              >
                  Get Started
              </Button>
            )}
            {(!user || user.userType === 'expert') && (
              <Button 
                variant="outline" 
                size="lg" 
                  className="px-8 py-6 text-lg border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
                onClick={user ? () => navigate('/dashboard') : handleBecomeExpert}
              >
                {user ? 'Expert Dashboard' : 'Become an Expert'}
              </Button>
            )}
            </div>
          </div>
          
          {/* Right Side - Illustration */}
          <div className="relative w-full h-[500px] flex items-center justify-center">
            <img 
              src={HeroIllustration} 
              alt="Person working on laptop" 
              className="w-full h-full object-contain max-w-md"
            />
          </div>
        </div>
      </section>

      {/* Experts Section */}
      <section id="experts" className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Our Expert Coaches
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Connect with experienced professionals from top companies who are ready to help you ace your next interview.
            </p>
          </div>

          {expertsLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading experts...</p>
              </div>
            </div>
          ) : experts.length === 0 ? (
            <div className="text-center py-20">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No experts available at the moment.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {experts.map((expert) => (
                  <ExpertCard 
                    key={expert.id} 
                    expert={expert}
                    onAuthRequired={() => {
                      setSelectedRole('candidate');
                      setShowAuthModal(true);
                    }}
                  />
                ))}
              </div>
              <div className="text-center">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-lg"
                  onClick={() => {
                    if (!user) {
                      setSelectedRole('candidate');
                      setShowAuthModal(true);
                    } else {
                      navigate('/experts');
                    }
                  }}
                >
                  View All Experts
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative w-full h-[500px] flex items-center justify-center">
              <img 
                src={AboutIllustration} 
                alt="Professional person" 
                className="w-full h-full object-contain max-w-sm"
              />
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                About Our
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                We provide a comprehensive interview preparation platform connecting candidates with industry experts. Our mission is to help you succeed in your career journey through personalized coaching and real-time feedback.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Expert Guidance</h3>
                    <p className="text-gray-600">Learn from professionals at top companies</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Video className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Live Sessions</h3>
                    <p className="text-gray-600">Interactive video calls with recording</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Flexible Scheduling</h3>
                    <p className="text-gray-600">Book sessions that fit your schedule</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Are Section */}
      <section id="who-we-are" className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Who We Are
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              We are a team of passionate professionals dedicated to helping you succeed in your career journey. Our mission is to bridge the gap between candidates and industry experts.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white text-center">
              <CardContent className="p-8">
                <div className="mx-auto bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                  <Users className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Expert Team</h3>
                <p className="text-gray-600">
                  Our team consists of experienced professionals from top tech companies, bringing years of industry knowledge and interview expertise.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white text-center">
              <CardContent className="p-8">
                <div className="mx-auto bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                  <Award className="h-10 w-10 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Proven Track Record</h3>
                <p className="text-gray-600">
                  We've helped thousands of candidates land their dream jobs at companies like Google, Meta, Amazon, and many more.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white text-center">
              <CardContent className="p-8">
                <div className="mx-auto bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                  <Shield className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Trusted Platform</h3>
                <p className="text-gray-600">
                  We provide a secure, reliable platform where candidates can connect with verified experts and prepare for their interviews with confidence.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-16 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-bold text-gray-900">Our Mission</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                To empower every candidate with the tools, knowledge, and confidence they need to excel in interviews and advance their careers. We believe that with the right preparation and guidance, anyone can achieve their professional goals.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">10,000+</p>
                    <p className="text-sm text-gray-600">Successful Interviews</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">500+</p>
                    <p className="text-sm text-gray-600">Expert Coaches</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-3xl font-bold text-gray-900">Our Values</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Excellence</h4>
                    <p className="text-gray-600">We strive for excellence in everything we do, ensuring the highest quality coaching and support.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Innovation</h4>
                    <p className="text-gray-600">We continuously innovate our platform and services to provide the best interview preparation experience.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Integrity</h4>
                    <p className="text-gray-600">We maintain the highest standards of integrity, transparency, and trust in all our interactions.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative z-10 py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            {/* Left - Illustration */}
            <div className="relative w-full h-[400px] flex items-center justify-center order-2 md:order-1">
              <img 
                src={ServicesIllustration} 
                alt="Professional services" 
                className="w-full h-full object-contain max-w-sm"
              />
            </div>
            
            {/* Right - Text Content */}
            <div className="space-y-6 order-1 md:order-2">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                Our Services
          </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                We offer comprehensive interview preparation services designed to help you succeed. From expert coaching to detailed feedback, we provide everything you need to excel in your interviews.
              </p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white">
              <CardHeader className="text-center">
                <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-gray-900 text-xl">Verified Experts</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600">
                  Interview with professionals from top companies like Google, Meta, and Amazon
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white">
              <CardHeader className="text-center">
                <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Video className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-gray-900 text-xl">Live Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600">
                  High-quality video calls with recording and real-time feedback
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white">
              <CardHeader className="text-center">
                <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-gray-900 text-xl">Flexible Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600">
                  Book sessions that fit your schedule with instant confirmation
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white">
              <CardHeader className="text-center">
                <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-gray-900 text-xl">Detailed Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600">
                  Get comprehensive feedback and actionable improvement suggestions
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials/Clients Section */}
      <section className="relative z-10 py-20 px-6 bg-blue-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
            Explore the impressive List of Companies and Clients We've Supported in Their Interview Preparation Journey
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Jennifer Smith', role: 'Marketing Manager, ABC Corporation', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jennifer' },
              { name: 'John Doe', role: 'Sales Executive, XYZ Inc.', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John' },
              { name: 'Sarah Johnson', role: 'IT Specialist, Tech Solutions', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' },
              { name: 'Emily Davis', role: 'Human Resources Coordinator, Acme Inc.', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily' },
              { name: 'Michael Brown', role: 'Finance Analyst, Global Enterprises', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael' },
              { name: 'Samantha Lee', role: 'Customer Service Representative, Retail Outlet', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Samantha' },
            ].map((person, index) => (
              <Card key={index} className="border border-gray-200 shadow-sm bg-white">
                <CardContent className="p-6 flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={person.avatar} alt={person.name} />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {person.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-gray-900">{person.name}</h3>
                    <p className="text-sm text-gray-600">{person.role}</p>
            </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-600">
            Join thousands of candidates who have successfully landed their dream jobs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {(!user || user.userType === 'candidate') && (
            <Button 
              size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-6 text-lg"
                onClick={() => {
                  if (!user) {
                    setSelectedRole('candidate');
                    setShowAuthModal(true);
                  } else {
                    navigate('/experts');
                  }
                }}
            >
              Start Your Journey Today
            </Button>
          )}
          {user && user.userType === 'expert' && (
            <Button 
              size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-6 text-lg"
              onClick={() => navigate('/dashboard')}
            >
              Go to Expert Dashboard
            </Button>
          )}
            <Button 
              size="lg" 
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 px-10 py-6 text-lg"
              onClick={() => setShowContactModal(true)}
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>

      <Footer />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        defaultRole={selectedRole}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

    </div>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Video, Calendar, Award } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import ServicesIllustration from '@/assets/images/image_3.svg?url';

export default function Services() {
  const navigate = useNavigate();
  const { user, loading, login } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'expert'>('candidate');

  const handleLogin = (_userType: 'candidate' | 'expert' | 'admin', userData: any) => {
    login(userData);
    setShowAuthModal(false);
  };

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

  return (
    <div className="min-h-screen bg-white">
      <Header showAuthModal={() => setShowAuthModal(true)} />

      {/* Services Section */}
      <section className="relative z-10 py-20 px-6 bg-gray-50">
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
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                Our Services
              </h1>
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

          <div className="text-center mt-12">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-6 text-lg rounded-lg"
              onClick={() => {
                if (!user) {
                  setSelectedRole('candidate');
                  setShowAuthModal(true);
                } else {
                  navigate('/experts');
                }
              }}
            >
              Get Started
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
    </div>
  );
}


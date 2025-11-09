import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Users, Calendar, Video, Award, ArrowRight, Sparkles, TrendingUp, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const navigate = useNavigate();
  const { user, loading, login, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'expert'>('candidate');

  // Show loading state while checking auth
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

  const handleLogin = (_userType: 'candidate' | 'expert', userData: any) => {
    login(userData);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleFindExpert = () => {
    setSelectedRole('candidate');
    setShowAuthModal(true);
  };

  const handleBecomeExpert = () => {
    setSelectedRole('expert');
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-6 max-w-7xl mx-auto backdrop-blur-sm">
        <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
          ✨ InterviewAce
        </div>
        <div className="flex gap-4">
          {user ? (
            <div className="flex items-center gap-4 animate-in slide-in-from-right duration-500">
              <div className="px-4 py-2 bg-gray-100 rounded-full border border-gray-200">
                <span className="text-sm text-gray-700">Welcome, {user.name}</span>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate('/dashboard')}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-300 hover:scale-105"
              >
                Dashboard
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-300"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex gap-4 animate-in slide-in-from-right duration-500">
              <Button 
                variant="outline" 
                onClick={() => setShowAuthModal(true)}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate('/experts')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 text-center py-20 px-6 max-w-6xl mx-auto">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-1000">
          <div className="animate-bounce">
            <Badge variant="secondary" className="text-sm px-6 py-3 bg-gradient-to-r from-blue-100 to-purple-100 border-gray-200 text-gray-700 hover:scale-110 transition-transform duration-300">
              🚀 Ace Your Next Interview
            </Badge>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent leading-tight animate-in slide-in-from-bottom duration-1000 delay-200 bg-[length:200%_200%] animate-gradient">
            Master Your Interview Skills
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed animate-in slide-in-from-bottom duration-1000 delay-400">
            Connect with verified industry experts for personalized mock interviews. 
            Get real-time feedback, recordings, and actionable insights to land your dream job.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-in slide-in-from-bottom duration-1000 delay-600">
            {(!user || user.userType === 'candidate') && (
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-10 py-6 text-lg transition-all duration-300 hover:scale-110 hover:shadow-2xl shadow-xl group"
                onClick={user ? () => navigate('/experts') : handleFindExpert}
              >
                Find an Expert 
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            )}
            {(!user || user.userType === 'expert') && (
              <Button 
                variant="outline" 
                size="lg" 
                className="px-10 py-6 text-lg border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:shadow-xl"
                onClick={user ? () => navigate('/dashboard') : handleBecomeExpert}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {user ? 'Expert Dashboard' : 'Become an Expert'}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-gray-800 via-blue-600 to-purple-600 bg-clip-text text-transparent animate-in slide-in-from-bottom duration-1000">
            Why Choose InterviewAce?
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-4 hover:scale-105 bg-white border border-gray-200 group">
              <CardHeader className="text-center">
                <div className="mx-auto bg-gradient-to-br from-blue-400 to-blue-600 w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-gray-800 text-xl">Verified Experts</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 text-base">
                  Interview with professionals from top companies like Google, Meta, and Amazon
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-4 hover:scale-105 bg-white border border-gray-200 group animation-delay-200">
              <CardHeader className="text-center">
                <div className="mx-auto bg-gradient-to-br from-purple-400 to-purple-600 w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Video className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-gray-800 text-xl">Live Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 text-base">
                  High-quality video calls with recording and real-time feedback
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-4 hover:scale-105 bg-white border border-gray-200 group animation-delay-400">
              <CardHeader className="text-center">
                <div className="mx-auto bg-gradient-to-br from-green-400 to-green-600 w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Calendar className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-gray-800 text-xl">Flexible Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 text-base">
                  Book sessions that fit your schedule with instant confirmation
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-4 hover:scale-105 bg-white border border-gray-200 group animation-delay-600">
              <CardHeader className="text-center">
                <div className="mx-auto bg-gradient-to-br from-yellow-400 to-yellow-600 w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Award className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-gray-800 text-xl">Detailed Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-gray-600 text-base">
                  Get comprehensive feedback and actionable improvement suggestions
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-4 group hover:scale-110 transition-transform duration-300">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">500+</div>
              <div className="text-white/70 text-lg">Expert Interviews</div>
              <TrendingUp className="h-6 w-6 text-blue-400 mx-auto group-hover:animate-bounce" />
            </div>
            <div className="space-y-4 group hover:scale-110 transition-transform duration-300 animation-delay-200">
              <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">95%</div>
              <div className="text-white/70 text-lg">Success Rate</div>
              <Shield className="h-6 w-6 text-purple-400 mx-auto group-hover:animate-bounce" />
            </div>
            <div className="space-y-4 group hover:scale-110 transition-transform duration-300 animation-delay-400">
              <div className="text-5xl font-bold bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">4.9</div>
              <div className="text-white/70 text-lg flex items-center justify-center gap-2">
                <Star className="h-5 w-5 fill-current text-yellow-400" /> Rating
              </div>
              <Sparkles className="h-6 w-6 text-green-400 mx-auto group-hover:animate-bounce" />
            </div>
            <div className="space-y-4 group hover:scale-110 transition-transform duration-300 animation-delay-600">
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">24h</div>
              <div className="text-white/70 text-lg">Avg Response</div>
              <Zap className="h-6 w-6 text-orange-400 mx-auto group-hover:animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6 bg-gradient-to-r from-blue-600/80 via-purple-600/80 to-pink-600/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white animate-in slide-in-from-bottom duration-1000">
            Ready to Ace Your Next Interview?
          </h2>
          <p className="text-xl text-white/90 animate-in slide-in-from-bottom duration-1000 delay-200">
            Join thousands of candidates who have successfully landed their dream jobs
          </p>
          {(!user || user.userType === 'candidate') && (
            <Button 
              size="lg" 
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-gray-100 px-10 py-6 text-lg transition-all duration-300 hover:scale-110 hover:shadow-2xl shadow-xl animate-in slide-in-from-bottom duration-1000 delay-400"
              onClick={() => navigate('/experts')}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start Your Journey Today
            </Button>
          )}
          {user && user.userType === 'expert' && (
            <Button 
              size="lg" 
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-gray-100 px-10 py-6 text-lg transition-all duration-300 hover:scale-110 hover:shadow-2xl shadow-xl animate-in slide-in-from-bottom duration-1000 delay-400"
              onClick={() => navigate('/dashboard')}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Go to Expert Dashboard
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-6 bg-black/40 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            ✨ InterviewAce
          </div>
          <p className="text-white/60">
            © 2024 InterviewAce. All rights reserved.
          </p>
        </div>
      </footer>

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
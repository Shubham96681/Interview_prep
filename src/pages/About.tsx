import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, GraduationCap, Lightbulb, Globe, Shield, Rocket, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

export default function About() {
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

      {/* Hero Section */}
      <section className="relative py-24 px-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            About InPrepare
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            Empowering candidates worldwide with expert-led interview preparation and personalized coaching
          </p>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-md bg-white text-center">
              <CardContent className="p-8">
                <div className="mx-auto bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">50K+</div>
                <div className="text-gray-600 font-medium">Active Candidates</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white text-center">
              <CardContent className="p-8">
                <div className="mx-auto bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <GraduationCap className="h-8 w-8 text-pink-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">200+</div>
                <div className="text-gray-600 font-medium">Expert Instructors</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white text-center">
              <CardContent className="p-8">
                <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Rocket className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">1000+</div>
                <div className="text-gray-600 font-medium">Sessions Completed</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white text-center">
              <CardContent className="p-8">
                <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-orange-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">95%</div>
                <div className="text-gray-600 font-medium">Success Rate</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                Our Mission
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                At InPrepare, we believe that interview preparation should be accessible, engaging, and transformative. Our mission is to democratize high-quality interview coaching by combining cutting-edge technology with expert instruction to create personalized learning experiences for everyone.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                We're committed to breaking down barriers to career success and empowering candidates to achieve their goals, whether they're advancing their careers, exploring new opportunities, or pursuing their dream jobs.
              </p>
            </div>
            <div className="flex items-center justify-center">
              <div className="bg-blue-50 rounded-2xl p-8 w-full max-w-sm">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <Rocket className="h-16 w-16 text-blue-600 mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Our Values
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Lightbulb className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Innovation</h3>
                <p className="text-gray-600 text-sm">
                  We continuously innovate to provide cutting-edge learning experiences powered by AI and modern technology.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Excellence</h3>
                <p className="text-gray-600 text-sm">
                  We strive for excellence in everything we do, from course content to user experience.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Globe className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Accessibility</h3>
                <p className="text-gray-600 text-sm">
                  Interview preparation should be accessible to everyone, regardless of their background or location.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Integrity</h3>
                <p className="text-gray-600 text-sm">
                  We maintain the highest standards of integrity and transparency in all our operations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Meet Our Team
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Passionate educators and technologists dedicated to transforming interview preparation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                name: 'Dr. Sarah Johnson',
                title: 'CEO & Co-Founder',
                description: 'Former Senior Software Engineer at Google with 15+ years of experience in EdTech.',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'
              },
              {
                name: 'Prof. Michael Chen',
                title: 'CTO & Co-Founder',
                description: 'AI Research Lead at Stanford, specializing in machine learning and educational technology.',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael'
              },
              {
                name: 'Emma Rodriguez',
                title: 'Head of Learning',
                description: 'Digital Marketing Director with expertise in curriculum development and instructional design.',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma'
              },
              {
                name: 'Alex Thompson',
                title: 'Head of Design',
                description: 'Senior UX Designer at Apple, passionate about creating intuitive and beautiful learning experiences.',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex'
              }
            ].map((member, index) => (
              <Card key={index} className="border-0 shadow-md bg-white">
                <CardContent className="p-6 text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-4">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h3>
                  <p className="text-blue-600 font-medium mb-3">{member.title}</p>
                  <p className="text-gray-600 text-sm">{member.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Ready to Start Your Learning Journey?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of candidates who are transforming their careers with InPrepare
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-white text-blue-600 hover:bg-gray-100 px-10 py-6 text-lg rounded-lg font-semibold border-0"
              onClick={() => {
                if (!user) {
                  setSelectedRole('candidate');
                  setShowAuthModal(true);
                } else {
                  navigate('/experts');
                }
              }}
            >
              Get Started Free
            </Button>
            <Button 
              size="lg" 
              className="bg-transparent border-2 border-white text-white hover:bg-white/20 px-10 py-6 text-lg rounded-lg font-semibold"
              onClick={() => navigate('/experts')}
            >
              Browse Experts
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, MapPin, Clock, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

export default function Contact() {
  const navigate = useNavigate();
  const { loading, login } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const selectedRole: 'candidate' | 'expert' = 'candidate';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = (_userType: 'candidate' | 'expert' | 'admin', userData: any) => {
    login(userData);
    setShowAuthModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    if (!formData.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (!formData.subject) {
      toast.error('Please select a subject');
      return;
    }
    
    if (!formData.message.trim()) {
      toast.error('Please enter your message');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Send contact form data to backend
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit your inquiry');
      }
      
      toast.success('Thank you for contacting us! We will get back to you soon.');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      
    } catch (error: any) {
      console.error('Error submitting contact form:', error);
      toast.error(error.message || 'Failed to submit your inquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
            Get in Touch
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact Information Cards */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Email</h3>
                <p className="text-gray-600 text-sm mb-3">Send us an email anytime</p>
                <a href="mailto:info@inprepare.com" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  info@inprepare.com
                </a>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Phone className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Phone</h3>
                <p className="text-gray-600 text-sm mb-3">Mon-Fri from 8am to 6pm</p>
                <a href="tel:+15551234567" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  +1 (555) 123-4567
                </a>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <MapPin className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Address</h3>
                <p className="text-gray-600 text-sm mb-3">Visit our office</p>
                <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  123 Coaching Lane, Suite 400, Prep City, PC 90210
                </a>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 text-center">
                <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Support Hours</h3>
                <p className="text-gray-600 text-sm mb-3">We're here to help</p>
                <p className="text-blue-600 text-sm font-medium">
                  8 AM - 6 PM IST
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Left - Contact Form */}
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-purple-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">Send us a Message</h2>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-700 font-medium">
                      Your Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-gray-700 font-medium">
                      Subject <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.subject} onValueChange={(value) => setFormData(prev => ({ ...prev, subject: value }))}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical-support">Technical Support</SelectItem>
                        <SelectItem value="partnership">Partnership Opportunities</SelectItem>
                        <SelectItem value="feedback">Feedback & Suggestions</SelectItem>
                        <SelectItem value="general">General Inquiry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-gray-700 font-medium">
                      Message <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell us how we can help you..."
                      value={formData.message}
                      onChange={handleChange}
                      className="min-h-[200px] resize-none"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 text-lg font-semibold rounded-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right - Why Contact Us */}
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Why Contact Us?</h2>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-lg">1</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Technical Support</h3>
                    <p className="text-gray-600">
                      Need help with your account, sessions, or platform features? Our support team is here to assist you.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold text-lg">2</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Expert Inquiries</h3>
                    <p className="text-gray-600">
                      Questions about our experts, interview preparation, or learning paths? We'd be happy to help you find the right fit.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-lg">3</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Partnership Opportunities</h3>
                    <p className="text-gray-600">
                      Interested in partnering with us or becoming an expert? Let's explore how we can work together.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-bold text-lg">4</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Feedback & Suggestions</h3>
                    <p className="text-gray-600">
                      Your feedback helps us improve. Share your thoughts, ideas, or suggestions with us.
                    </p>
                  </div>
                </div>
              </div>

              {/* Need Immediate Help Section */}
              <Card className="border-0 bg-gradient-to-r from-purple-600 to-blue-600 mt-8">
                <CardContent className="p-8 text-white">
                  <h3 className="text-2xl font-bold mb-3">Need Immediate Help?</h3>
                  <p className="text-white/90 mb-6">
                    Check out our Help Center for instant answers to common questions, or browse our FAQ section.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      variant="secondary"
                      className="bg-white text-purple-600 hover:bg-gray-100 font-semibold"
                      onClick={() => navigate('/contact')}
                    >
                      Visit Help Center
                    </Button>
                    <Button 
                      variant="secondary"
                      className="bg-white text-blue-600 hover:bg-gray-100 font-semibold"
                      onClick={() => navigate('/contact')}
                    >
                      View FAQ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
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

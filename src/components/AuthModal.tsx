import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Lock, Star, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { User as UserType, authService } from '@/lib/auth';
import { apiService } from '@/lib/apiService';
import RegistrationForm from './RegistrationForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (userType: 'candidate' | 'expert' | 'admin', userData: UserType) => void;
  defaultRole?: 'candidate' | 'expert';
}

export default function AuthModal({ isOpen, onClose, onLogin, defaultRole: _defaultRole = 'candidate' }: AuthModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    
    // Try backend API first
    const response = await apiService.login(email, password);
    
    if (response.success && response.data) {
      const data = response.data;
      
      // Verify token exists in response
      if (!data.token) {
        console.error('❌ No token in login response:', data);
        toast.error('Login failed: No authentication token received');
        setIsLoading(false);
        return;
      }
      
      // Store the token in localStorage FIRST
      localStorage.setItem('token', data.token);
      console.log('✅ Token saved to localStorage:', data.token.substring(0, 20) + '...');
      
      // Verify token was saved
      const savedToken = localStorage.getItem('token');
      if (!savedToken || savedToken !== data.token) {
        console.error('❌ Token not saved correctly!');
        toast.error('Failed to save authentication token');
        setIsLoading(false);
        return;
      }
      
      toast.success(`🎉 Welcome back, ${data.user.name}!`, {
        description: 'You have successfully signed in to InterviewAce',
      });
      
      // Pass the user data with token to the parent component
      const userWithToken = { ...data.user, token: data.token };
      console.log('✅ Calling onLogin with user:', { ...userWithToken, token: '***' });
      onLogin(data.user.userType, userWithToken);
      onClose();
      setIsLoading(false);
      return;
    } else {
      // Backend login failed - show error
      const errorMessage = response.error || response.message || 'Invalid email or password';
      toast.error('Login failed', {
        description: errorMessage,
      });
      setIsLoading(false);
      return;
    }
  };

  // REMOVED: handleSignup function - Registration should always go through RegistrationForm
  // which properly handles backend registration and returns actual database IDs
  // This prevents frontend-generated IDs from being created

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white border border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">I</span>
            </div>
            Welcome to InPrepare
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600 text-sm">
            Sign in to your account or create a new one to get started with interview preparation
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger 
              value="login" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-300"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger 
              value="signup"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-300"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="text-center pb-4">
                <CardDescription className="text-gray-600 text-base">
                  Sign in to your account to continue your interview journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-gray-900 font-medium">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-gray-900 font-medium">Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Star className="mr-2 h-5 w-5" />
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>

                  
                  <div className="text-center">
                    <p className="text-gray-700 text-sm mb-2 font-medium">Don't have an account?</p>
                    <Button 
                      type="button" 
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                      onClick={() => {
                        onClose();
                        navigate('/register');
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create New Account
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="text-center pb-4">
                <CardDescription className="text-gray-600 text-base">
                  Create your account to get started with expert interviews
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-gray-700 mb-4">
                      Click the button below to open the registration form
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate('/register');
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Open Registration Form
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
      
      <RegistrationForm 
        isOpen={showRegistration}
        onClose={() => setShowRegistration(false)}
        onRegister={(userData: UserType) => {
          // Token is already stored in localStorage by RegistrationForm
          // Store user in authService
          authService.login(userData);
          
          // Call onLogin to update global auth state
          onLogin(userData.userType as 'candidate' | 'expert' | 'admin', userData);
          
          // Close registration modal
          setShowRegistration(false);
          onClose();
          
          // Navigate based on user type
          if (userData.userType === 'expert') {
            // Navigate to expert profile page
            console.log('✅ Navigating to expert profile:', `/expert/${userData.id}`);
            navigate(`/expert/${userData.id}`);
            toast.success(`Welcome ${userData.name}! You can now edit your profile.`);
          } else {
            // Navigate to dashboard for candidates
            navigate('/dashboard');
            toast.success(`Welcome ${userData.name}!`);
          }
        }}
      />
    </Dialog>
  );
}

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Lock, Briefcase, Sparkles, Star } from 'lucide-react';
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

export default function AuthModal({ isOpen, onClose, onLogin, defaultRole = 'candidate' }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userType, setUserType] = useState<'candidate' | 'expert'>(defaultRole);
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setUserType(defaultRole);
  }, [defaultRole]);

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
      toast.success(`🎉 Welcome back, ${data.user.name}!`, {
        description: 'You have successfully signed in to InterviewAce',
      });
      // Store the token in localStorage
      if (data.token) {
        localStorage.setItem('token', data.token);
        console.log('✅ Token saved to localStorage');
      }
      // Pass the user data with token to the parent component
      const userWithToken = { ...data.user, token: data.token };
      console.log('✅ Calling onLogin with user:', userWithToken);
      onLogin(data.user.userType, userWithToken);
      onClose();
      setIsLoading(false);
      return;
    } else {
      // If backend fails, try local auth service for test users
      const localUser = authService.testLogin(email, password);
      if (localUser) {
        toast.success(`🎉 Welcome back, ${localUser.name}!`, {
          description: 'You have successfully signed in to InterviewAce',
        });
        // Store in authService for compatibility
        authService.login(localUser);
        onLogin(localUser.userType, localUser);
        onClose();
        setIsLoading(false);
        return;
      } else {
        // Show backend error if available, otherwise generic error
        const errorMessage = response.error || 'Invalid credentials';
        toast.error(errorMessage);
      }
    }
    
    setIsLoading(false);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error('Please fill in all fields');
      return;
    }

    const userData: UserType = {
      id: `user-${Date.now()}`,
      email,
      name,
      userType,
      company: company || 'Tech Corp',
      title: title || 'Software Engineer',
      avatar: '',
      rating: 0,
      totalSessions: 0,
      hourlyRate: 0,
      isVerified: false,
      yearsOfExperience: 0,
      proficiency: 'Beginner',
      timezone: 'UTC',
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
      daysAvailable: '["monday","tuesday","wednesday","thursday","friday"]',
      resumePath: '',
      profilePhotoPath: '',
      certificationPaths: ''
    };

    toast.success(`🚀 Account created successfully!`, {
      description: `Welcome to InterviewAce, ${userData.name}!`,
    });
    onLogin(userType, userData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-white/20 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-400 animate-pulse" />
            Welcome to InterviewAce
          </DialogTitle>
          <DialogDescription className="text-center text-white/70 text-sm">
            Sign in to your account or create a new one to get started with interview preparation
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-sm">
            <TabsTrigger 
              value="login" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all duration-300"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger 
              value="signup"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all duration-300"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="text-center pb-4">
                <CardDescription className="text-white/70 text-base">
                  Sign in to your account to continue your interview journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-white font-medium">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-white font-medium">Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-105 hover:shadow-xl py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Star className="mr-2 h-5 w-5" />
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>

                  
                  <div className="text-center">
                    <p className="text-white/80 text-sm mb-2 font-medium">Don't have an account?</p>
                    <Button 
                      type="button" 
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                      onClick={() => setShowRegistration(true)}
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
                <CardDescription className="text-white/70 text-base">
                  Create your account to get started with expert interviews
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-type" className="text-white font-medium">I am a</Label>
                    <Select value={userType} onValueChange={(value: 'candidate' | 'expert') => setUserType(value)}>
                      <SelectTrigger className="bg-white/10 backdrop-blur-sm border-white/20 text-white focus:border-blue-400 focus:ring-blue-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/20 backdrop-blur-xl">
                        <SelectItem value="candidate" className="text-white hover:bg-white/10">
                          🎯 Student/Candidate (Looking for interview practice)
                        </SelectItem>
                        <SelectItem value="expert" className="text-white hover:bg-white/10">
                          👨‍🏫 Expert (Offering interview coaching)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-white font-medium">Full Name</Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Enter your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-white font-medium">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-white font-medium">Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                      />
                    </div>
                  </div>

                  {userType === 'expert' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="company" className="text-white font-medium">Company</Label>
                        <div className="relative group">
                          <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-300" />
                          <Input
                            id="company"
                            type="text"
                            placeholder="Current company"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="title" className="text-white font-medium">Job Title</Label>
                        <Input
                          id="title"
                          type="text"
                          placeholder="Your current role"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-300"
                        />
                      </div>
                    </>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-105 hover:shadow-xl py-6 text-lg font-semibold"
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Create Account
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
      
      <RegistrationForm 
        isOpen={showRegistration}
        onClose={() => setShowRegistration(false)}
        onRegister={(userData: UserType) => {
          toast.success(`Registration successful! Welcome ${userData.name}!`);
          setShowRegistration(false);
        }}
      />
    </Dialog>
  );
}

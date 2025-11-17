import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, User, Lock, Briefcase, Award, FileText, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService';

interface UserData {
  id: string;
  email: string;
  name: string;
  userType: 'candidate' | 'expert';
  company?: string;
  title?: string;
  phone?: string;
  bio?: string;
  experience?: string;
  skills?: string[];
  avatar?: string;
  rating?: number;
  totalSessions?: number;
  hourlyRate?: number;
  isVerified?: boolean;
  yearsOfExperience?: number;
  proficiency?: string;
  timezone?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  daysAvailable?: string;
  resumePath?: string;
  profilePhotoPath?: string;
  certificationPaths?: string;
}

interface RegistrationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (userData: UserData) => void;
}

export default function RegistrationForm({ isOpen, onClose, onRegister }: RegistrationFormProps) {
  const [activeTab, setActiveTab] = useState<'candidate' | 'expert'>('candidate');
  
  // Common fields
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Debounce timer ref
  const emailCheckTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Candidate specific fields
  const [resume, setResume] = useState<File | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [certifications, setCertifications] = useState<File[]>([]);
  const [currentRole, setCurrentRole] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [bio, setBio] = useState('');
  
  // Expert specific fields
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [proficiency, setProficiency] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [expertBio, setExpertBio] = useState('');
  const [expertSkills, setExpertSkills] = useState('');
  const [expertProfilePhoto, setExpertProfilePhoto] = useState<File | null>(null);

  const handleFileUpload = (file: File, type: 'resume' | 'photo' | 'certification' | 'expertPhoto') => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    switch (type) {
      case 'resume':
        setResume(file);
        break;
      case 'photo':
        setProfilePhoto(file);
        break;
      case 'certification':
        setCertifications(prev => [...prev, file]);
        break;
      case 'expertPhoto':
        setExpertProfilePhoto(file);
        break;
    }
  };

  const removeFile = (type: 'resume' | 'photo' | 'certification' | 'expertPhoto', index?: number) => {
    switch (type) {
      case 'resume':
        setResume(null);
        break;
      case 'photo':
        setProfilePhoto(null);
        break;
      case 'certification':
        if (index !== undefined) {
          setCertifications(prev => prev.filter((_, i) => i !== index));
        }
        break;
      case 'expertPhoto':
        setExpertProfilePhoto(null);
        break;
    }
  };

  const addProficiency = (skill: string) => {
    if (skill && !proficiency.includes(skill)) {
      setProficiency(prev => [...prev, skill]);
    }
  };

  const removeProficiency = (skill: string) => {
    setProficiency(prev => prev.filter(s => s !== skill));
  };

  // Email validation function
  const validateEmail = async (emailValue: string) => {
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailValue) {
      setEmailError('');
      setIsCheckingEmail(false);
      return;
    }

    if (!emailRegex.test(emailValue)) {
      setEmailError('');
      setIsCheckingEmail(false);
      return; // Don't check invalid emails
    }

    setIsCheckingEmail(true);
    
    try {
      const response = await apiService.checkEmail(emailValue);
      
      if (response.success && response.data) {
        if (response.data.exists) {
          setEmailError(response.data.message || 'This email already exists. Please use a different email.');
        } else {
          setEmailError('');
        }
      } else {
        // On error, don't show error message (to avoid false positives)
        setEmailError('');
      }
    } catch (error) {
      // On error, don't show error message
      setEmailError('');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Debounced email validation
  useEffect(() => {
    // Clear previous timer
    if (emailCheckTimer.current) {
      clearTimeout(emailCheckTimer.current);
    }

    // Set new timer
    emailCheckTimer.current = setTimeout(() => {
      validateEmail(email);
    }, 500); // Wait 500ms after user stops typing

    // Cleanup function
    return () => {
      if (emailCheckTimer.current) {
        clearTimeout(emailCheckTimer.current);
      }
    };
  }, [email]);

  // Clear email error when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setEmailError('');
      setEmail('');
      setIsCheckingEmail(false);
      setPasswordError('');
      setConfirmPasswordError('');
    }
  }, [isOpen]);

  // Password validation function
  const validatePassword = (pwd: string): string => {
    if (!pwd) {
      return '';
    }
    
    const errors: string[] = [];
    
    if (pwd.length < 6) {
      errors.push('at least 6 characters');
    }
    
    if (!/[a-z]/.test(pwd)) {
      errors.push('one lowercase letter');
    }
    
    if (!/[A-Z]/.test(pwd)) {
      errors.push('one uppercase letter');
    }
    
    if (!/\d/.test(pwd)) {
      errors.push('one number');
    }
    
    if (errors.length > 0) {
      return `Password must contain ${errors.join(', ')}`;
    }
    
    return '';
  };

  // Handle password change with validation
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    const error = validatePassword(value);
    setPasswordError(error);
    
    // Also validate confirm password if it's been filled
    if (confirmPassword) {
      if (value !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match');
      } else {
        setConfirmPasswordError('');
      }
    }
  };

  // Handle confirm password change
  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (password && value !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    // Clear error immediately when user starts typing
    if (emailError) {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Wait for email check to complete if in progress
    if (isCheckingEmail) {
      toast.error('Please wait while we check your email...');
      return;
    }
    
    // Check if email has error before submitting
    if (emailError) {
      toast.error(emailError);
      return;
    }
    
    // Validate password
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      toast.error(passwordValidationError);
      return;
    }
    
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    // Validate profile photo is uploaded
    if (activeTab === 'candidate' && !profilePhoto) {
      toast.error('Profile photo is required');
      return;
    }

    if (activeTab === 'expert' && !expertProfilePhoto) {
      toast.error('Profile photo is required');
      return;
    }

    const formData = new FormData();
    
    // Common fields
    formData.append('email', email);
    formData.append('password', password);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('userType', activeTab);

    if (activeTab === 'candidate') {
      // Candidate specific fields
      formData.append('currentRole', currentRole);
      formData.append('experience', experience);
      formData.append('skills', skills);
      formData.append('bio', bio);
      
      if (resume) formData.append('resume', resume);
      // Profile photo is now required, so we can safely append it
      formData.append('profilePhoto', profilePhoto!);
      certifications.forEach((cert, index) => {
        formData.append(`certification_${index}`, cert);
      });
    } else {
      // Expert specific fields
      formData.append('company', company);
      formData.append('title', title);
      formData.append('yearsOfExperience', yearsOfExperience);
      formData.append('proficiency', JSON.stringify(proficiency));
      formData.append('hourlyRate', hourlyRate);
      formData.append('expertBio', expertBio);
      formData.append('expertSkills', expertSkills);
      
      // Profile photo is now required, so we can safely append it
      formData.append('expertProfilePhoto', expertProfilePhoto!);
    }

    const response = await apiService.register(formData);
    
    if (response.success && response.data) {
      const data = response.data;
      
      // CRITICAL: Use the actual database ID from the response
      const actualUserId = data.user?.id;
      if (!actualUserId) {
        console.error('❌ Registration response missing user ID:', data);
        toast.error('Registration successful but user ID not received. Please log in.');
        onClose();
        return;
      }
      
      console.log('✅ Registration successful, user ID:', actualUserId);
      
      // Store token if provided
      if (data.token) {
        localStorage.setItem('token', data.token);
        console.log('✅ Token saved:', data.token.substring(0, 20) + '...');
      }
        
      // Create user data object with actual database data
        const userData: UserData = {
        id: actualUserId, // Always use the database ID, never fallback
        email: data.user?.email || email,
        name: data.user?.name || name,
        userType: data.user?.userType || activeTab,
        company: data.user?.company || (activeTab === 'expert' ? company : undefined),
        title: data.user?.title || (activeTab === 'expert' ? title : undefined),
        phone: data.user?.phone || phone,
        bio: data.user?.bio || (activeTab === 'candidate' ? bio : expertBio),
        experience: data.user?.experience || (activeTab === 'candidate' ? experience : yearsOfExperience),
        skills: data.user?.skills ? (typeof data.user.skills === 'string' ? JSON.parse(data.user.skills) : data.user.skills) : (activeTab === 'candidate' ? skills.split(',').map(s => s.trim()).filter(s => s) : expertSkills.split(',').map(s => s.trim()).filter(s => s)),
        avatar: data.user?.avatar || data.user?.profilePhotoPath || '',
        rating: data.user?.rating || 0,
        totalSessions: data.user?.totalSessions || 0,
        hourlyRate: data.user?.hourlyRate || (activeTab === 'expert' ? parseFloat(hourlyRate) || 0 : 0),
        isVerified: data.user?.isVerified || false,
        yearsOfExperience: data.user?.yearsOfExperience || (activeTab === 'expert' ? parseInt(yearsOfExperience) || 0 : undefined),
        proficiency: data.user?.proficiency ? (typeof data.user.proficiency === 'string' ? JSON.parse(data.user.proficiency) : data.user.proficiency) : (activeTab === 'expert' ? proficiency : undefined),
        timezone: data.user?.timezone || 'UTC',
        workingHoursStart: data.user?.workingHoursStart || '09:00',
        workingHoursEnd: data.user?.workingHoursEnd || '17:00',
        daysAvailable: data.user?.daysAvailable || '["monday","tuesday","wednesday","thursday","friday"]',
        resumePath: data.user?.resumePath || '',
        profilePhotoPath: data.user?.profilePhotoPath || '',
        certificationPaths: data.user?.certificationPaths || ''
        };
        
      toast.success(`Registration successful! Welcome ${userData.name}!`);
        onRegister(userData);
        onClose();
        // Reset form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setPhone('');
        setResume(null);
        setProfilePhoto(null);
        setCertifications([]);
        setCurrentRole('');
        setExperience('');
        setSkills('');
        setBio('');
        setCompany('');
        setTitle('');
        setYearsOfExperience('');
        setProficiency([]);
        setHourlyRate('');
        setExpertBio('');
        setExpertSkills('');
        setExpertProfilePhoto(null);
    } else {
      toast.error(response.error || 'Registration failed');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Join InterviewAce</DialogTitle>
          <DialogDescription className="text-center text-gray-600 text-sm">
            Create your account to start your interview preparation journey
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'candidate' | 'expert')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="candidate">🎯 Candidate</TabsTrigger>
            <TabsTrigger value="expert">👨‍🏫 Expert</TabsTrigger>
          </TabsList>

          <TabsContent value="candidate" className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="candidate-name">Full Name *</Label>
                      <Input
                        id="candidate-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="candidate-email">Email *</Label>
                      <Input
                        id="candidate-email"
                        type="email"
                        value={email}
                        onChange={handleEmailChange}
                        required
                        className={emailError ? 'border-red-500' : ''}
                      />
                      {isCheckingEmail && (
                        <p className="text-sm text-gray-500 mt-1">Checking email availability...</p>
                      )}
                      {emailError && (
                        <p className="text-sm text-red-500 mt-1">{emailError}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="candidate-phone">Phone Number</Label>
                      <Input
                        id="candidate-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="candidate-role">Current Role</Label>
                      <Input
                        id="candidate-role"
                        value={currentRole}
                        onChange={(e) => setCurrentRole(e.target.value)}
                        placeholder="e.g., Software Engineer"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="candidate-bio">Bio</Label>
                    <Textarea
                      id="candidate-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Professional Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Professional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="candidate-experience">Years of Experience</Label>
                    <Select value={experience} onValueChange={setExperience}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-1">0-1 years</SelectItem>
                        <SelectItem value="2-3">2-3 years</SelectItem>
                        <SelectItem value="4-5">4-5 years</SelectItem>
                        <SelectItem value="6-10">6-10 years</SelectItem>
                        <SelectItem value="10+">10+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="candidate-skills">Skills (comma-separated)</Label>
                    <Input
                      id="candidate-skills"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="e.g., JavaScript, React, Node.js"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* File Uploads */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Documents & Photos
                  </CardTitle>
                  <CardDescription>
                    Upload your resume, profile photo (required), and certifications (optional)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Resume Upload */}
                  <div>
                    <Label>Resume *</Label>
                    <div className="mt-2">
                      {resume ? (
                        <div className="flex items-center gap-2 p-3 border rounded-lg">
                          <FileText className="h-4 w-4" />
                          <span className="flex-1">{resume.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile('resume')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600 mb-2">Upload your resume</p>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'resume');
                            }}
                            className="max-w-xs mx-auto"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Profile Photo Upload */}
                  <div>
                    <Label>Profile Photo *</Label>
                    <div className="mt-2">
                      {profilePhoto ? (
                        <div className="flex items-center gap-2 p-3 border rounded-lg">
                          <Camera className="h-4 w-4" />
                          <span className="flex-1">{profilePhoto.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile('photo')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center bg-red-50">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-red-400" />
                          <p className="text-sm text-red-600 mb-1 font-medium">Profile photo is required *</p>
                          <p className="text-xs text-gray-500 mb-2">Please upload your profile photo</p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'photo');
                            }}
                            className="max-w-xs mx-auto"
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Certifications Upload */}
                  <div>
                    <Label>Certifications (optional)</Label>
                    <div className="mt-2 space-y-2">
                      {certifications.map((cert, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                          <Award className="h-4 w-4" />
                          <span className="flex-1">{cert.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile('certification', index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600 mb-2">Add certification</p>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, 'certification');
                          }}
                          className="max-w-xs mx-auto"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Password */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="candidate-password">Password *</Label>
                      <Input
                        id="candidate-password"
                        type="password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        className={passwordError ? 'border-red-500' : ''}
                        required
                      />
                      {passwordError && (
                        <p className="text-sm text-red-500 mt-1">{passwordError}</p>
                      )}
                      {!passwordError && password && (
                        <p className="text-xs text-gray-500 mt-1">
                          Password must contain: at least 6 characters, one lowercase letter, one uppercase letter, and one number
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="candidate-confirm-password">Confirm Password *</Label>
                      <Input
                        id="candidate-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                        className={confirmPasswordError ? 'border-red-500' : ''}
                        required
                      />
                      {confirmPasswordError && (
                        <p className="text-sm text-red-500 mt-1">{confirmPasswordError}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" size="lg">
                Create Candidate Account
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="expert" className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expert-name">Full Name *</Label>
                      <Input
                        id="expert-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="expert-email">Email *</Label>
                      <Input
                        id="expert-email"
                        type="email"
                        value={email}
                        onChange={handleEmailChange}
                        required
                        className={emailError ? 'border-red-500' : ''}
                      />
                      {isCheckingEmail && (
                        <p className="text-sm text-gray-500 mt-1">Checking email availability...</p>
                      )}
                      {emailError && (
                        <p className="text-sm text-red-500 mt-1">{emailError}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="expert-phone">Phone Number</Label>
                      <Input
                        id="expert-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expert-company">Company</Label>
                      <Input
                        id="expert-company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="e.g., Google, Microsoft"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expert-title">Job Title</Label>
                      <Input
                        id="expert-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Senior Software Engineer"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expert-rate">Hourly Rate ($)</Label>
                      <Input
                        id="expert-rate"
                        type="number"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                        placeholder="e.g., 75"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="expert-bio">Bio</Label>
                    <Textarea
                      id="expert-bio"
                      value={expertBio}
                      onChange={(e) => setExpertBio(e.target.value)}
                      placeholder="Tell us about your experience and expertise..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Professional Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Professional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="expert-experience">Years of Experience *</Label>
                    <Select value={yearsOfExperience} onValueChange={setYearsOfExperience}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select years of experience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-2">1-2 years</SelectItem>
                        <SelectItem value="3-5">3-5 years</SelectItem>
                        <SelectItem value="6-10">6-10 years</SelectItem>
                        <SelectItem value="11-15">11-15 years</SelectItem>
                        <SelectItem value="15+">15+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expert-skills">Technical Skills (comma-separated)</Label>
                    <Input
                      id="expert-skills"
                      value={expertSkills}
                      onChange={(e) => setExpertSkills(e.target.value)}
                      placeholder="e.g., JavaScript, React, Node.js, System Design"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Proficiency Areas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Proficiency Areas *
                  </CardTitle>
                  <CardDescription>
                    Select areas where you have expertise in conducting interviews
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      'Technical Interviews',
                      'System Design',
                      'Data Structures & Algorithms',
                      'Behavioral Interviews',
                      'Resume Review',
                      'Mock Interviews',
                      'Coding Challenges',
                      'Leadership Assessment',
                      'Product Management',
                      'Data Science',
                      'Machine Learning',
                      'DevOps'
                    ].map((area) => (
                      <Button
                        key={area}
                        type="button"
                        variant={proficiency.includes(area) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          if (proficiency.includes(area)) {
                            removeProficiency(area);
                          } else {
                            addProficiency(area);
                          }
                        }}
                        className="text-xs"
                      >
                        {area}
                      </Button>
                    ))}
                  </div>
                  {proficiency.length > 0 && (
                    <div>
                      <Label>Selected Areas:</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {proficiency.map((area) => (
                          <span
                            key={area}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                          >
                            {area}
                            <button
                              type="button"
                              onClick={() => removeProficiency(area)}
                              className="ml-1 hover:text-blue-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Profile Photo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Profile Photo *
                  </CardTitle>
                  <CardDescription>
                    Profile photo is required
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expertProfilePhoto ? (
                    <div className="flex items-center gap-2 p-3 border rounded-lg">
                      <Camera className="h-4 w-4" />
                      <span className="flex-1">{expertProfilePhoto.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile('expertPhoto')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center bg-red-50">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-red-400" />
                      <p className="text-sm text-red-600 mb-1 font-medium">Profile photo is required *</p>
                      <p className="text-xs text-gray-500 mb-2">Please upload your profile photo</p>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'expertPhoto');
                        }}
                        className="max-w-xs mx-auto"
                        required
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Password */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expert-password">Password *</Label>
                      <Input
                        id="expert-password"
                        type="password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        className={passwordError ? 'border-red-500' : ''}
                        required
                      />
                      {passwordError && (
                        <p className="text-sm text-red-500 mt-1">{passwordError}</p>
                      )}
                      {!passwordError && password && (
                        <p className="text-xs text-gray-500 mt-1">
                          Password must contain: at least 6 characters, one lowercase letter, one uppercase letter, and one number
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="expert-confirm-password">Confirm Password *</Label>
                      <Input
                        id="expert-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                        className={confirmPasswordError ? 'border-red-500' : ''}
                        required
                      />
                      {confirmPasswordError && (
                        <p className="text-sm text-red-500 mt-1">{confirmPasswordError}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" size="lg">
                Create Expert Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

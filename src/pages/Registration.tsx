import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, User, Lock, Briefcase, Award, FileText, Camera, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/lib/auth';

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

export default function Registration() {
  const navigate = useNavigate();
  const { login } = useAuth();
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

  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setEmailError('');
    setIsCheckingEmail(false);

    if (newEmail && newEmail.includes('@')) {
      setIsCheckingEmail(true);
      try {
        const response = await apiService.checkEmail(newEmail);
        if (response.success && response.data && response.data.exists) {
          setEmailError(response.data.message || 'This email already exists. Please use a different email.');
        }
      } catch (error) {
        console.error('Error checking email:', error);
      } finally {
        setIsCheckingEmail(false);
      }
    }
  };

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

  const addProficiency = (area: string) => {
    if (area && !proficiency.includes(area)) {
      setProficiency([...proficiency, area]);
    }
  };

  const removeProficiency = (area: string) => {
    setProficiency(proficiency.filter(p => p !== area));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCheckingEmail) {
      toast.error('Please wait while we check your email...');
      return;
    }
    
    if (emailError) {
      toast.error(emailError);
      return;
    }
    
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

    if (activeTab === 'candidate' && !profilePhoto) {
      toast.error('Profile photo is required');
      return;
    }

    if (activeTab === 'expert' && !expertProfilePhoto) {
      toast.error('Profile photo is required');
      return;
    }

    const formData = new FormData();
    
    formData.append('email', email);
    formData.append('password', password);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('userType', activeTab);

    if (activeTab === 'candidate') {
      formData.append('currentRole', currentRole);
      formData.append('experience', experience);
      formData.append('skills', skills);
      formData.append('bio', bio);
      
      if (resume) formData.append('resume', resume);
      formData.append('profilePhoto', profilePhoto!);
      certifications.forEach((cert, index) => {
        formData.append(`certification_${index}`, cert);
      });
    } else {
      formData.append('company', company);
      formData.append('title', title);
      formData.append('yearsOfExperience', yearsOfExperience);
      formData.append('proficiency', JSON.stringify(proficiency));
      formData.append('hourlyRate', hourlyRate);
      formData.append('expertBio', expertBio);
      formData.append('expertSkills', expertSkills);
      formData.append('expertProfilePhoto', expertProfilePhoto!);
    }

    try {
      const response = await apiService.register(formData);
      
      if (response.success && response.data) {
        const userData = response.data.user as UserData;
        const token = response.data.token;
        
        if (token) {
          localStorage.setItem('token', token);
        }
        
        if (userData && userData.id) {
          authService.login(userData);
          login(userData);
          
          toast.success(`Registration successful! Welcome ${userData.name}!`);
          
          if (userData.userType === 'expert') {
            navigate(`/expert/${userData.id}`);
          } else {
            navigate('/dashboard');
          }
        } else {
          toast.error('Registration successful but user data not received. Please log in.');
        }
      } else {
        toast.error(response.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-3xl font-bold">Join InterviewAce</CardTitle>
            <CardDescription className="text-lg">
              Create your account to start your interview preparation journey
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'candidate' | 'expert')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
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
                            className={emailError ? 'border-red-500' : ''}
                            required
                          />
                          {isCheckingEmail && (
                            <p className="text-xs text-gray-500 mt-1">Checking email...</p>
                          )}
                          {emailError && (
                            <p className="text-sm text-red-500 mt-1">{emailError}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="candidate-phone">Phone Number</Label>
                        <Input
                          id="candidate-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security */}
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
                    </CardContent>
                  </Card>

                  {/* Professional Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Professional Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="candidate-role">Current Role</Label>
                        <Input
                          id="candidate-role"
                          value={currentRole}
                          onChange={(e) => setCurrentRole(e.target.value)}
                          placeholder="e.g., Software Engineer"
                        />
                      </div>
                      <div>
                        <Label htmlFor="candidate-experience">Experience</Label>
                        <Textarea
                          id="candidate-experience"
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          placeholder="Tell us about your professional experience..."
                          rows={4}
                        />
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

                  {/* Resume */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Resume
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
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
                          <p className="text-sm text-gray-600 mb-2">Upload your resume (PDF, DOC, DOCX)</p>
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
                    </CardContent>
                  </Card>

                  {/* Certifications */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Certifications (Optional)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                      {certifications.length < 3 && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600 mb-2">Upload certification (PDF, DOC, DOCX)</p>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'certification');
                            }}
                            className="max-w-xs mx-auto"
                          />
                        </div>
                      )}
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
                            className={emailError ? 'border-red-500' : ''}
                            required
                          />
                          {isCheckingEmail && (
                            <p className="text-xs text-gray-500 mt-1">Checking email...</p>
                          )}
                          {emailError && (
                            <p className="text-sm text-red-500 mt-1">{emailError}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="expert-phone">Phone Number</Label>
                        <Input
                          id="expert-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security */}
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

                  {/* Professional Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Professional Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expert-company">Company</Label>
                          <Input
                            id="expert-company"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="e.g., Google"
                          />
                        </div>
                        <div>
                          <Label htmlFor="expert-title">Title</Label>
                          <Input
                            id="expert-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Senior Software Engineer"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="expert-years">Years of Experience</Label>
                        <Input
                          id="expert-years"
                          type="number"
                          value={yearsOfExperience}
                          onChange={(e) => setYearsOfExperience(e.target.value)}
                          placeholder="e.g., 5"
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expert-hourly-rate">Hourly Rate ($)</Label>
                        <Input
                          id="expert-hourly-rate"
                          type="number"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          placeholder="e.g., 50"
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expert-skills">Skills (comma-separated)</Label>
                        <Input
                          id="expert-skills"
                          value={expertSkills}
                          onChange={(e) => setExpertSkills(e.target.value)}
                          placeholder="e.g., JavaScript, React, Node.js"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expert-bio">Bio</Label>
                        <Textarea
                          id="expert-bio"
                          value={expertBio}
                          onChange={(e) => setExpertBio(e.target.value)}
                          placeholder="Tell us about your expertise..."
                          rows={4}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Proficiency Areas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Areas of Proficiency
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Add Proficiency Area</Label>
                        <Select onValueChange={addProficiency}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an area" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Frontend Development">Frontend Development</SelectItem>
                            <SelectItem value="Backend Development">Backend Development</SelectItem>
                            <SelectItem value="Full Stack Development">Full Stack Development</SelectItem>
                            <SelectItem value="Mobile Development">Mobile Development</SelectItem>
                            <SelectItem value="Data Science">Data Science</SelectItem>
                            <SelectItem value="Machine Learning">Machine Learning</SelectItem>
                            <SelectItem value="DevOps">DevOps</SelectItem>
                            <SelectItem value="Cloud Computing">Cloud Computing</SelectItem>
                            <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                            <SelectItem value="Product Management">Product Management</SelectItem>
                            <SelectItem value="UI/UX Design">UI/UX Design</SelectItem>
                            <SelectItem value="System Design">System Design</SelectItem>
                          </SelectContent>
                        </Select>
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

                  <Button type="submit" className="w-full" size="lg">
                    Create Expert Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


import { useState } from 'react';
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
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
      if (profilePhoto) formData.append('profilePhoto', profilePhoto);
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
      
      if (expertProfilePhoto) formData.append('expertProfilePhoto', expertProfilePhoto);
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
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
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
                    Upload your resume, photo, and certifications (optional)
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
                    <Label>Profile Photo</Label>
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
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600 mb-2">Upload profile photo</p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'photo');
                            }}
                            className="max-w-xs mx-auto"
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
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="candidate-confirm-password">Confirm Password *</Label>
                      <Input
                        id="candidate-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
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
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
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
                    Profile Photo
                  </CardTitle>
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
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-2">Upload profile photo</p>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'expertPhoto');
                        }}
                        className="max-w-xs mx-auto"
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
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="expert-confirm-password">Confirm Password *</Label>
                      <Input
                        id="expert-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
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

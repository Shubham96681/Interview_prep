import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Clock, Calendar, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService';
import AvailabilityManager from './AvailabilityManager';

interface ExpertUser {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  experience: string;
  languages: string[];
  specialties: string[];
  availability: string[];
  timezone?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  daysAvailable?: string;
}

interface ExpertProfileEditProps {
  isOpen: boolean;
  onClose: () => void;
  user: ExpertUser;
  onUpdate: (updatedUser: ExpertUser) => void;
}

export default function ExpertProfileEdit({ isOpen, onClose, user, onUpdate }: ExpertProfileEditProps) {
  const [hourlyRate, setHourlyRate] = useState('');
  const [availability, setAvailability] = useState({
    timezone: 'UTC',
    workingHours: {
      start: '09:00',
      end: '17:00'
    },
    daysAvailable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setHourlyRate(user.hourlyRate?.toString() || '');
      
      // Set availability with proper structure
      setAvailability({
        timezone: user.timezone || 'UTC',
        workingHours: {
          start: user.workingHoursStart || '09:00',
          end: user.workingHoursEnd || '17:00'
        },
        daysAvailable: user.daysAvailable ? JSON.parse(user.daysAvailable) : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!hourlyRate || parseFloat(hourlyRate) < 0) {
      toast.error('Please enter a valid hourly rate');
      return;
    }

    setIsLoading(true);
    try {
      // For now, simulate a successful update since we don't have a full backend
      // In a real app, this would make an API call to update the profile
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      // Create updated user object
      const updatedUser = {
        ...user,
        hourlyRate: parseFloat(hourlyRate),
        timezone: availability.timezone,
        workingHoursStart: availability.workingHours?.start || '09:00',
        workingHoursEnd: availability.workingHours?.end || '17:00',
        daysAvailable: JSON.stringify(availability.daysAvailable)
      };

      toast.success('Profile updated successfully!');
      onUpdate(updatedUser);
      onClose();
      
      // Make actual API call to update profile
      const formData = new FormData();
      formData.append('hourlyRate', hourlyRate);
      formData.append('timezone', availability.timezone);
      formData.append('workingHoursStart', availability.workingHours.start);
      formData.append('workingHoursEnd', availability.workingHours.end);
      formData.append('daysAvailable', JSON.stringify(availability.daysAvailable));
      
      await apiService.updateProfile(formData);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDayToggle = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      daysAvailable: prev.daysAvailable.includes(day)
        ? prev.daysAvailable.filter(d => d !== day)
        : [...prev.daysAvailable, day]
    }));
  };

  const days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Edit Expert Profile
          </DialogTitle>
          <DialogDescription>
            Update your hourly rate and availability settings
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Settings</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            {/* Hourly Rate Section */}
            <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Hourly Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Rate per hour (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="hourlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="75.00"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Set your hourly rate for coaching sessions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Availability Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={availability.timezone} onValueChange={(value) => setAvailability(prev => ({ ...prev, timezone: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="EST">Eastern Time (EST)</SelectItem>
                    <SelectItem value="PST">Pacific Time (PST)</SelectItem>
                    <SelectItem value="GMT">Greenwich Mean Time (GMT)</SelectItem>
                    <SelectItem value="CET">Central European Time (CET)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Working Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="startTime"
                      type="time"
                      value={availability.workingHours?.start || '09:00'}
                      onChange={(e) => setAvailability(prev => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, start: e.target.value }
                      }))}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="endTime"
                      type="time"
                      value={availability.workingHours?.end || '17:00'}
                      onChange={(e) => setAvailability(prev => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, end: e.target.value }
                      }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Days Available */}
              <div className="space-y-2">
                <Label>Available Days</Label>
                <div className="grid grid-cols-2 gap-2">
                  {days.map((day) => (
                    <div key={day.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.key}
                        checked={availability.daysAvailable.includes(day.key)}
                        onCheckedChange={() => handleDayToggle(day.key)}
                      />
                      <Label htmlFor={day.key} className="text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
          </TabsContent>

          <TabsContent value="availability" className="space-y-6">
            <AvailabilityManager expertId={user.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

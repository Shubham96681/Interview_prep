import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Repeat,
  AlertCircle,
  Grid3X3
} from 'lucide-react';
import { toast } from 'sonner';
import InteractiveCalendar from './InteractiveCalendar';
import { apiService } from '@/lib/apiService';

interface AvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  isActive: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  recurringDays?: string[];
  maxBookings?: number;
  currentBookings?: number;
}

interface AvailabilityManagerProps {
  expertId: string;
  onAvailabilityChange?: (slots: AvailabilitySlot[]) => void;
  sessions?: any[];
}

export default function AvailabilityManager({ expertId, onAvailabilityChange, sessions = [] }: AvailabilityManagerProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  // Form state
  const [formData, setFormData] = useState({
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    isRecurring: false,
    recurringPattern: 'weekly' as 'daily' | 'weekly' | 'monthly',
    recurringDays: [] as string[],
    maxBookings: 8,
    isActive: true
  });

  const daysOfWeek = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  // Fetch real availability data from API
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!expertId) return;
      
      setLoading(true);
      try {
        const response = await apiService.getAvailabilitySlots(expertId);
        
        if (response.success && response.data) {
          const { daysAvailable, workingHoursStart, workingHoursEnd } = response.data;
          
          // Convert expert's availability settings to slot format for display
          // This is a simplified representation - in a full implementation,
          // you'd have a separate AvailabilitySlot table
          const availabilitySlots: AvailabilitySlot[] = [];
          
          if (daysAvailable && daysAvailable.length > 0) {
            daysAvailable.forEach((day: string) => {
              availabilitySlots.push({
                id: `slot-${day}`,
                date: '', // Recurring slots don't have specific dates
                startTime: workingHoursStart || '09:00',
                endTime: workingHoursEnd || '17:00',
            isRecurring: true,
            isActive: true,
            recurringPattern: 'weekly',
                recurringDays: [day],
            maxBookings: 8,
                currentBookings: 0
          });
            });
      }

          setSlots(availabilitySlots);
        } else {
          setSlots([]);
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
        toast.error('Failed to load availability');
        setSlots([]);
      } finally {
      setLoading(false);
      }
    };

    fetchAvailability();
  }, [expertId]);

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...prev.recurringDays, day]
    }));
  };

  const handleSave = async () => {
    if (!formData.isRecurring) {
      toast.error('Recurring availability is required');
      return;
    }

    if (formData.recurringDays.length === 0) {
      toast.error('Please select at least one day for recurring availability');
      return;
    }

    try {
      // Update availability via API
      const response = await apiService.updateAvailability(expertId, {
        daysAvailable: formData.recurringDays,
        workingHoursStart: formData.startTime,
        workingHoursEnd: formData.endTime
      });

      if (response.success) {
        // Refresh slots from API
        const refreshResponse = await apiService.getAvailabilitySlots(expertId);
        if (refreshResponse.success && refreshResponse.data) {
          const { daysAvailable, workingHoursStart, workingHoursEnd } = refreshResponse.data;
          const availabilitySlots: AvailabilitySlot[] = [];
          
          if (daysAvailable && daysAvailable.length > 0) {
            daysAvailable.forEach((day: string) => {
              availabilitySlots.push({
                id: `slot-${day}`,
                date: '',
                startTime: workingHoursStart || '09:00',
                endTime: workingHoursEnd || '17:00',
                isRecurring: true,
                isActive: true,
                recurringPattern: 'weekly',
                recurringDays: [day],
                maxBookings: 8,
      currentBookings: 0
              });
            });
          }
          
          setSlots(availabilitySlots);
          onAvailabilityChange?.(availabilitySlots);
        }
        
      toast.success('Availability updated successfully!');
    resetForm();
    setIsDialogOpen(false);
      } else {
        toast.error('Failed to update availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error('Failed to update availability');
    }
  };

  const handleEdit = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    setFormData({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isRecurring: slot.isRecurring,
      recurringPattern: slot.recurringPattern || 'weekly',
      recurringDays: slot.recurringDays || [],
      maxBookings: slot.maxBookings || 8,
      isActive: slot.isActive
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (slotId: string) => {
    setSlots(prev => prev.filter(slot => slot.id !== slotId));
    toast.success('Availability removed successfully!');
  };

  const handleToggleActive = (slotId: string) => {
    setSlots(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, isActive: !slot.isActive } : slot
    ));
  };

  const resetForm = () => {
    setFormData({
      date: '',
      startTime: '09:00',
      endTime: '17:00',
      isRecurring: false,
      recurringPattern: 'weekly',
      recurringDays: [],
      maxBookings: 8,
      isActive: true
    });
    setEditingSlot(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getUpcomingSlots = () => {
    const today = new Date().toISOString().split('T')[0];
    return slots
      .filter(slot => slot.date >= today && slot.isActive)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  };

  const getAvailabilityStats = () => {
    const activeSlots = slots.filter(slot => slot.isActive);
    const totalCapacity = activeSlots.reduce((sum, slot) => sum + (slot.maxBookings || 0), 0);
    const totalBookings = activeSlots.reduce((sum, slot) => sum + (slot.currentBookings || 0), 0);
    const utilizationRate = totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;

    return {
      totalSlots: activeSlots.length,
      totalCapacity,
      totalBookings,
      utilizationRate: Math.round(utilizationRate)
    };
  };

  const stats = getAvailabilityStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading availability...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action buttons - header removed as it's shown in ExpertDashboard */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setActiveTab('calendar')}
          className="flex items-center gap-2"
        >
          <Grid3X3 className="h-4 w-4" />
          View Calendar
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={resetForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Availability
            </Button>
          </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Edit Availability' : 'Add New Availability'}
            </DialogTitle>
            <DialogDescription>
              Set your available time slots for candidate bookings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Recurring Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: !!checked }))}
                />
                <Label htmlFor="isRecurring">Recurring Availability</Label>
              </div>

              {formData.isRecurring ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Recurring Pattern</Label>
                    <Select
                      value={formData.recurringPattern}
                      onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                        setFormData(prev => ({ ...prev, recurringPattern: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.recurringPattern === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Available Days</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {daysOfWeek.map((day) => (
                          <div key={day.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={day.key}
                              checked={formData.recurringDays.includes(day.key)}
                              onCheckedChange={() => handleDayToggle(day.key)}
                            />
                            <Label htmlFor={day.key} className="text-sm">
                              {day.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="date">Specific Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxBookings">Max Bookings per Day</Label>
                <Input
                  id="maxBookings"
                  type="number"
                  min="1"
                  max="20"
                  value={formData.maxBookings}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxBookings: parseInt(e.target.value) || 8 }))}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: !!checked }))}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {editingSlot ? 'Update' : 'Add'} Availability
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'list' | 'calendar')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Availability List</TabsTrigger>
          <TabsTrigger value="calendar">Interactive Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => setActiveTab('calendar')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Slots</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalSlots}</p>
                <p className="text-xs text-gray-500 mt-1 group-hover:text-blue-600 transition-colors">Click to view calendar</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600 hover:text-blue-700 transition-colors group-hover:scale-110 transform" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Capacity</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalCapacity}</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Booked Slots</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalBookings}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Utilization</p>
                <p className="text-2xl font-bold text-purple-600">{stats.utilizationRate}%</p>
              </div>
              <Repeat className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {getUpcomingSlots().map(slot => (
              <div key={slot.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${slot.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="font-medium">{formatDate(slot.date)}</span>
                  </div>
                  <div>
                    <p className="font-semibold">{slot.startTime} - {slot.endTime}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {slot.isRecurring && (
                        <Badge variant="outline" className="text-xs">
                          <Repeat className="h-3 w-3 mr-1" />
                          {slot.recurringPattern}
                        </Badge>
                      )}
                      <span>{slot.currentBookings || 0}/{slot.maxBookings || 8} booked</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleToggleActive(slot.id)}
                  >
                    {slot.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(slot)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(slot.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <InteractiveCalendar 
            expertId={expertId} 
            sessions={sessions} 
            availabilitySlots={slots}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

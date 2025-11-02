import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  Users, 
  DollarSign, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Booking {
  id: string;
  candidateName: string;
  candidateEmail: string;
  date: string;
  time: string;
  duration: number;
  sessionType: 'mock' | 'technical' | 'behavioral';
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  paymentAmount: number;
  paymentStatus: 'paid' | 'pending' | 'refunded';
  meetingLink?: string;
  notes?: string;
  // Time tracking fields
  actualDuration?: number; // Actual time spent in session
  startTime?: string; // When session actually started
  endTime?: string; // When session actually ended
  isActive?: boolean; // Whether session is currently active
}

interface AvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  isActive: boolean;
}

interface CalendarStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  totalEarnings: number;
  thisMonthEarnings: number;
  averageRating: number;
  // Time tracking stats
  totalTimeSpent: number; // Total minutes spent in sessions
  thisMonthTimeSpent: number; // This month's time spent
  averageSessionDuration: number; // Average session duration
  activeSessions: number; // Currently active sessions
}

export default function ExpertCalendarDashboard() {
  const [currentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [stats, setStats] = useState<CalendarStats>({
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    totalEarnings: 0,
    thisMonthEarnings: 0,
    averageRating: 4.8,
    totalTimeSpent: 0,
    thisMonthTimeSpent: 0,
    averageSessionDuration: 0,
    activeSessions: 0
  });
  const [loading, setLoading] = useState(true);

  // Generate mock data for demonstration
  useEffect(() => {
    const generateMockData = () => {
      const today = new Date();
      const mockBookings: Booking[] = [];
      const mockAvailability: AvailabilitySlot[] = [];

      // Generate bookings for the next 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Randomly generate bookings (30% chance per day)
        if (Math.random() < 0.3) {
          const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
          const time = times[Math.floor(Math.random() * times.length)];
          const sessionTypes: ('mock' | 'technical' | 'behavioral')[] = ['mock', 'technical', 'behavioral'];
          const statuses: ('confirmed' | 'pending' | 'cancelled' | 'completed')[] = ['confirmed', 'pending', 'completed'];
          
          const sessionType = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const scheduledDuration = 60;
          
          // Generate realistic time tracking data
          const actualDuration = status === 'completed' ? 
            Math.floor(Math.random() * 20) + scheduledDuration - 10 : // 50-70 minutes for completed sessions
            undefined;
          
          const isActive = status === 'confirmed' && Math.random() < 0.1; // 10% chance of being active
          const startTime = status === 'completed' || isActive ? 
            new Date(dateStr + 'T' + time).toISOString() : undefined;
          const endTime = status === 'completed' && startTime ? 
            new Date(new Date(startTime).getTime() + (actualDuration || scheduledDuration) * 60000).toISOString() : undefined;

          mockBookings.push({
            id: `booking-${i}`,
            candidateName: `Candidate ${i + 1}`,
            candidateEmail: `candidate${i + 1}@example.com`,
            date: dateStr,
            time,
            duration: scheduledDuration,
            sessionType,
            status,
            paymentAmount: 75,
            paymentStatus: 'paid',
            meetingLink: `https://meet.google.com/abc-defg-hij`,
            notes: `Session notes for ${dateStr}`,
            // Time tracking data
            actualDuration,
            startTime,
            endTime,
            isActive
          });
        }

        // Generate availability slots
        if (date.getDay() >= 1 && date.getDay() <= 5) { // Weekdays
          mockAvailability.push({
            id: `slot-${i}`,
            date: dateStr,
            startTime: '09:00',
            endTime: '17:00',
            isRecurring: true,
            isActive: true
          });
        }
      }

      // Calculate stats
      const totalBookings = mockBookings.length;
      const confirmedBookings = mockBookings.filter(b => b.status === 'confirmed').length;
      const pendingBookings = mockBookings.filter(b => b.status === 'pending').length;
      const totalEarnings = mockBookings.reduce((sum, b) => sum + b.paymentAmount, 0);
      const thisMonthEarnings = mockBookings
        .filter(b => {
          const bookingDate = new Date(b.date);
          return bookingDate.getMonth() === today.getMonth() && 
                 bookingDate.getFullYear() === today.getFullYear();
        })
        .reduce((sum, b) => sum + b.paymentAmount, 0);

      // Calculate time tracking stats
      const completedBookings = mockBookings.filter(b => b.status === 'completed' && b.actualDuration);
      const totalTimeSpent = completedBookings.reduce((sum, b) => sum + (b.actualDuration || 0), 0);
      const thisMonthTimeSpent = completedBookings
        .filter(b => {
          const bookingDate = new Date(b.date);
          return bookingDate.getMonth() === today.getMonth() && 
                 bookingDate.getFullYear() === today.getFullYear();
        })
        .reduce((sum, b) => sum + (b.actualDuration || 0), 0);
      const averageSessionDuration = completedBookings.length > 0 ? 
        Math.round(totalTimeSpent / completedBookings.length) : 0;
      const activeSessions = mockBookings.filter(b => b.isActive).length;

      return {
        bookings: mockBookings,
        availability: mockAvailability,
        stats: {
          totalBookings,
          confirmedBookings,
          pendingBookings,
          totalEarnings,
          thisMonthEarnings,
          averageRating: 4.8,
          totalTimeSpent,
          thisMonthTimeSpent,
          averageSessionDuration,
          activeSessions
        }
      };
    };

    setLoading(true);
    setTimeout(() => {
      const mockData = generateMockData();
      setBookings(mockData.bookings);
      setAvailability(mockData.availability);
      setStats(mockData.stats);
      setLoading(false);
    }, 1000);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <AlertCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTimeSpentDisplay = (booking: Booking) => {
    if (booking.isActive) {
      return <Badge className="bg-green-100 text-green-800">🟢 Live</Badge>;
    }
    if (booking.actualDuration) {
      return (
        <div className="text-sm text-gray-600">
          <span className="font-medium">{formatDuration(booking.actualDuration)}</span>
          <span className="text-gray-400 ml-1">
            (scheduled: {formatDuration(booking.duration)})
          </span>
        </div>
      );
    }
    return (
      <div className="text-sm text-gray-500">
        Scheduled: {formatDuration(booking.duration)}
      </div>
    );
  };

  const handleBookingAction = (bookingId: string, action: 'confirm' | 'cancel' | 'complete') => {
    setBookings(prev => prev.map(booking => {
      if (booking.id === bookingId) {
        let newStatus = booking.status;
        switch (action) {
          case 'confirm': newStatus = 'confirmed'; break;
          case 'cancel': newStatus = 'cancelled'; break;
          case 'complete': newStatus = 'completed'; break;
        }
        return { ...booking, status: newStatus };
      }
      return booking;
    }));
    
    toast.success(`Booking ${action}ed successfully!`);
  };

  const handleStartSession = (bookingId: string) => {
    const now = new Date().toISOString();
    setBookings(prev => prev.map(booking => {
      if (booking.id === bookingId) {
        return { 
          ...booking, 
          isActive: true, 
          startTime: now 
        };
      }
      return booking;
    }));
    
    toast.success('Session started! Time tracking is now active.');
  };

  const handleEndSession = (bookingId: string) => {
    const now = new Date().toISOString();
    setBookings(prev => prev.map(booking => {
      if (booking.id === bookingId) {
        const startTime = booking.startTime ? new Date(booking.startTime) : new Date();
        const endTime = new Date(now);
        const actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000); // minutes
        
        return { 
          ...booking, 
          isActive: false, 
          endTime: now,
          actualDuration: Math.max(actualDuration, 1) // At least 1 minute
        };
      }
      return booking;
    }));
    
    toast.success('Session ended! Time has been recorded.');
  };

  const getBookingsForDate = (date: string) => {
    return bookings.filter(booking => booking.date === date);
  };

  const getUpcomingBookings = () => {
    const today = new Date().toISOString().split('T')[0];
    return bookings
      .filter(booking => booking.date >= today)
      .sort((a, b) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime())
      .slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar Dashboard</h1>
          <p className="text-gray-600">Manage your availability and bookings</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Availability
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalBookings}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">{stats.confirmedBookings}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Time Spent</p>
                <p className="text-2xl font-bold text-orange-600">{formatDuration(stats.totalTimeSpent)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-purple-600">${stats.thisMonthEarnings}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold text-indigo-600">{formatDuration(stats.averageSessionDuration)}</p>
              </div>
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Sessions</p>
                <p className="text-2xl font-bold text-red-600">{stats.activeSessions}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Monthly Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center font-semibold text-gray-600">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }, (_, i) => {
                  const date = new Date(currentDate);
                  date.setDate(1);
                  date.setDate(date.getDate() - date.getDay() + i);
                  const dateStr = date.toISOString().split('T')[0];
                  const dayBookings = getBookingsForDate(dateStr);
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const isToday = dateStr === new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={i}
                      className={`p-2 min-h-[80px] border rounded-lg cursor-pointer transition-colors ${
                        isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => setSelectedDate(dateStr)}
                      title={selectedDate === dateStr ? 'Selected' : 'Click to select'}
                    >
                      <div className={`text-sm font-medium ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1 mt-1">
                        {dayBookings.slice(0, 2).map(booking => (
                          <div
                            key={booking.id}
                            className={`text-xs p-1 rounded truncate ${getStatusColor(booking.status)}`}
                          >
                            {formatTime(booking.time)} - {booking.candidateName}
                          </div>
                        ))}
                        {dayBookings.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{dayBookings.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Upcoming Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getUpcomingBookings().map(booking => (
                  <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(booking.status)}
                        <Badge className={getStatusColor(booking.status)}>
                          {booking.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-semibold">{booking.candidateName}</p>
                        <p className="text-sm text-gray-600">{formatDate(booking.date)} at {formatTime(booking.time)}</p>
                        <p className="text-sm text-gray-500">{booking.sessionType} session</p>
                        {getTimeSpentDisplay(booking)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-green-600">${booking.paymentAmount}</span>
                      {booking.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleBookingAction(booking.id, 'confirm')}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleBookingAction(booking.id, 'cancel')}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      {booking.status === 'confirmed' && !booking.isActive && (
                        <Button size="sm" onClick={() => handleStartSession(booking.id)}>
                          Start Session
                        </Button>
                      )}
                      {booking.isActive && (
                        <Button size="sm" variant="destructive" onClick={() => handleEndSession(booking.id)}>
                          End Session
                        </Button>
                      )}
                      {booking.status === 'confirmed' && !booking.isActive && (
                        <Button size="sm" variant="outline" onClick={() => handleBookingAction(booking.id, 'complete')}>
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Availability Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {availability.slice(0, 10).map(slot => (
                  <div key={slot.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${slot.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="text-sm font-medium">{formatDate(slot.date)}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{slot.startTime} - {slot.endTime}</p>
                        <p className="text-sm text-gray-600">
                          {slot.isRecurring ? 'Recurring' : 'One-time'} slot
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

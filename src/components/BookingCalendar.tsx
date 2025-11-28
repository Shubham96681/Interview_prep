import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, CreditCard, X, CheckCircle } from 'lucide-react';
import PaymentModal from './PaymentModal';
import { apiService } from '@/lib/apiService';
import realtimeService from '@/lib/realtimeService';

interface BookingCalendarProps {
  expertId: string;
  expertName: string;
  hourlyRate: number;
  onBookSession: (date: string, time: string) => void;
}

interface AvailabilitySlot {
  date: string;
  dayName: string;
  availableTimes: string[];
  bookedTimes: string[];
  isAvailable: boolean;
}

interface AvailabilityData {
  expertId: string;
  workingHours: {
    start: string;
    end: string;
  };
  daysAvailable: string[];
  slots: AvailabilitySlot[];
}

export default function BookingCalendar({ expertId, expertName, hourlyRate, onBookSession }: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availabilityData, setAvailabilityData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch real availability data from backend
  useEffect(() => {
    const fetchAvailability = async () => {
      setLoading(true);
      try {
        // Calculate date range (today and next 6 days - 7 days total, excluding past dates)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 6); // Next 6 days + today = 7 days
        const startDateStr = today.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        console.log('📅 Fetching booked slots from:', startDateStr, 'to', endDateStr);
        
        // Fetch booked slots from backend (real-time)
        const bookedResponse = await apiService.getExpertBookedSlots(expertId, startDateStr, endDateStr);
        const bookedSlots = bookedResponse.success && bookedResponse.data?.bookedSlots 
          ? bookedResponse.data.bookedSlots 
          : [];
        
        console.log('📅 Fetched booked slots:', bookedSlots);
        
        // Generate time slots (9am to 9pm, hourly)
        const allTimes = [];
        for (let hour = 9; hour <= 21; hour++) {
          allTimes.push(`${hour.toString().padStart(2, '0')}:00`);
        }
        
        // Group booked slots by date
        const bookedByDate: Record<string, string[]> = {};
        bookedSlots.forEach((slot: any) => {
          if (slot.date && slot.time && slot.status !== 'cancelled') {
            if (!bookedByDate[slot.date]) {
              bookedByDate[slot.date] = [];
            }
            bookedByDate[slot.date].push(slot.time);
          }
        });
        
        // Generate availability slots for next 7 days (starting from today, excluding past dates)
        const slots = [];
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(today);
          currentDate.setDate(today.getDate() + i);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Skip if this date is in the past (shouldn't happen with our loop, but safety check)
          const dateObj = new Date(dateStr);
          dateObj.setHours(0, 0, 0, 0);
          if (dateObj < today) {
            continue; // Skip past dates
          }
          
          const bookedTimes = bookedByDate[dateStr] || [];
          const availableTimes = allTimes.filter(time => {
            // Check if time is booked
            if (bookedTimes.includes(time)) {
              return false;
            }
            
            // For today's date, also check if the time slot is in the past
            if (i === 0) { // Today
              const [hours, minutes] = time.split(':').map(Number);
              const slotDateTime = new Date(today);
              slotDateTime.setHours(hours, minutes, 0, 0);
              const now = new Date();
              if (slotDateTime < now) {
                return false; // Past time slot
              }
            }
            
            return true;
          });
          
          slots.push({
            date: dateStr,
            dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
            availableTimes,
            bookedTimes,
            isAvailable: availableTimes.length > 0
          });
        }
        
        setAvailabilityData({
          expertId,
          workingHours: { start: '09:00', end: '21:00' },
          daysAvailable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          slots
        });
      } catch (error) {
        console.error('Error fetching availability:', error);
        // Fallback to empty availability on error
        setAvailabilityData({
          expertId,
          workingHours: { start: '09:00', end: '21:00' },
          daysAvailable: [],
          slots: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
    
    // Listen for real-time availability updates from backend
    const handleAvailabilityUpdate = (data: any) => {
      console.log('📅 Availability update received from backend:', data);
      if (data.expertId === expertId) {
        fetchAvailability();
      }
    };
    
    const handleSessionCreated = (session: any) => {
      console.log('📅 Session created, refreshing availability:', session);
      if (session.expertId === expertId || session.expert?.id === expertId) {
        fetchAvailability();
      }
    };
    
    realtimeService.on('availability_updated', handleAvailabilityUpdate);
    realtimeService.on('session_created', handleSessionCreated);
    
    return () => {
      realtimeService.off('availability_updated', handleAvailabilityUpdate);
      realtimeService.off('session_created', handleSessionCreated);
    };
  }, [expertId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleBooking = () => {
    if (selectedDate && selectedTime) {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    console.log('Payment successful:', paymentData);
    // Call the original booking function after successful payment
    await onBookSession(selectedDate, selectedTime);
    setShowPaymentModal(false);
    
    // Backend will broadcast availability update via real-time service
    // The useEffect listener will automatically refresh availability
  };

  const isSlotAvailable = (date: string, time: string) => {
    if (!availabilityData) return false;
    const slot = availabilityData.slots.find(s => s.date === date);
    if (!slot || !slot.availableTimes.includes(time)) return false;
    
    // Check if the time slot is in the past (for today's date)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (date === todayStr) {
      // Parse the time (e.g., "12:00" -> hours: 12, minutes: 0)
      const [hours, minutes] = time.split(':').map(Number);
      const slotDateTime = new Date(today);
      slotDateTime.setHours(hours, minutes, 0, 0);
      
      // If the slot time is in the past, it's not available
      if (slotDateTime < today) {
        return false;
      }
    }
    
    return true;
  };

  const isSlotBooked = (date: string, time: string) => {
    if (!availabilityData) return false;
    const slot = availabilityData.slots.find(s => s.date === date);
    return slot ? slot.bookedTimes.includes(time) : false;
  };

  const getSelectedSlotTimes = () => {
    if (!selectedDate || !availabilityData) return [];
    const slot = availabilityData.slots.find(s => s.date === selectedDate);
    return slot ? slot.availableTimes : [];
  };

  const getAllTimesForDate = (date: string) => {
    if (!availabilityData) return [];
    const slot = availabilityData.slots.find(s => s.date === date);
    if (!slot) return [];
    
    // Combine available and booked times and sort them
    const allTimes = [...slot.availableTimes, ...slot.bookedTimes];
    return allTimes.sort();
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading availability...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <X className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load availability: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Book a Session with {expertName}
        </CardTitle>
        {availabilityData && (
          <div className="text-sm text-gray-600">
            Available {availabilityData.workingHours.start} - {availabilityData.workingHours.end}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date & Time</h3>
        
        {/* Date Selection */}
        <div>
          <h4 className="font-medium mb-3 text-gray-700">Select Date</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availabilityData?.slots.map(slot => (
              <Button
                key={slot.date}
                variant={selectedDate === slot.date ? "default" : "outline"}
                className={`h-auto p-3 text-left relative transition-all duration-200 ${
                  !slot.isAvailable 
                    ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-400' 
                    : 'hover:bg-blue-50 hover:border-blue-300'
                }`}
                onClick={() => slot.isAvailable && setSelectedDate(slot.date)}
                disabled={!slot.isAvailable}
              >
                <div>
                  <div className="font-medium">{formatDate(slot.date)}</div>
                  <div className={`text-xs flex items-center gap-1 ${
                    slot.isAvailable ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {slot.isAvailable ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="font-medium">{slot.availableTimes.length} slots</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3 text-red-500" />
                        <span className="font-medium">Fully booked</span>
                      </>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Availability Legend</h5>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-green-700">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded opacity-40"></div>
              <span className="text-gray-500">Not Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-100 border border-red-300 rounded opacity-40"></div>
              <span className="text-red-500">Booked</span>
            </div>
          </div>
        </div>

        {/* Time Selection */}
        {selectedDate && (
          <div>
            <h4 className="font-medium mb-3 text-gray-700">Select Time</h4>
            <div className="grid grid-cols-3 gap-2">
              {getAllTimesForDate(selectedDate).map(time => {
                const isAvailable = isSlotAvailable(selectedDate, time);
                const isBooked = isSlotBooked(selectedDate, time);
                
                // Check if this is a past time slot for today
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                const isPastTime = selectedDate === todayStr && (() => {
                  const [hours, minutes] = time.split(':').map(Number);
                  const slotDateTime = new Date(today);
                  slotDateTime.setHours(hours, minutes, 0, 0);
                  return slotDateTime < today;
                })();
                
                return (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    className={`flex items-center gap-2 relative transition-all duration-200 ${
                      isBooked 
                        ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-400' 
                        : isPastTime
                        ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-400'
                        : isAvailable
                        ? 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                        : 'opacity-60 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-500'
                    }`}
                    onClick={() => isAvailable && !isPastTime && setSelectedTime(time)}
                    disabled={isBooked || !isAvailable || isPastTime}
                  >
                    <Clock className={`h-4 w-4 ${
                      isBooked || isPastTime ? 'text-gray-400' : isAvailable ? 'text-blue-600' : 'text-gray-500'
                    }`} />
                    {time}
                    {isBooked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-400 transform rotate-45"></div>
                      </div>
                    )}
                    {isPastTime && !isBooked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-gray-400 transform rotate-45 opacity-60"></div>
                      </div>
                    )}
                    {!isAvailable && !isBooked && !isPastTime && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-gray-400 transform rotate-45 opacity-60"></div>
                      </div>
                    )}
                  </Button>
                );
              })}
            </div>
            {getSelectedSlotTimes().length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <X className="h-6 w-6 mx-auto mb-2" />
                <p>No available slots for this date</p>
              </div>
            )}
          </div>
        )}

        {/* Session Details */}
        {selectedDate && selectedTime && (
          <div className="bg-blue-50 p-4 rounded-lg space-y-3">
            <h4 className="font-medium text-blue-900">Session Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Date & Time:</span>
                <span className="font-medium">{formatDate(selectedDate)} at {selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">60 minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rate:</span>
                <span className="font-medium">${hourlyRate}/hour</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-blue-600">${hourlyRate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Booking Button */}
        <Button 
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 h-12"
          disabled={!selectedDate || !selectedTime}
          onClick={handleBooking}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Book Session & Pay ${hourlyRate}
        </Button>

        <div className="text-xs text-gray-500 text-center">
          <Badge variant="secondary" className="mb-2">
            💡 Pro Tip
          </Badge>
          <p>Sessions include live video, recording, and detailed feedback</p>
        </div>
      </CardContent>
    </Card>

    {/* Payment Modal */}
    <PaymentModal
      isOpen={showPaymentModal}
      onClose={() => setShowPaymentModal(false)}
      onPaymentSuccess={handlePaymentSuccess}
      sessionData={{
        expertName,
        date: selectedDate,
        time: selectedTime,
        duration: 60,
        amount: hourlyRate,
        sessionType: 'technical'
      }}
    />
    </>
  );
}





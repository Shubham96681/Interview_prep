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
  notAvailableTimes?: string[];
  availableCount?: number; // Calculated count using formula: Total - (Booked + NotAvailable)
  isAvailable: boolean;
}

// Production-level slot utilities
const SLOT_DURATION_MIN = 60; // 1-hour slot
const START_TIME = "09:00";
const END_TIME = "21:00"; // 9 PM (21:00)

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTimeString(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function generateDailySlots(): string[] {
  const slots: string[] = [];
  let current = toMinutes(START_TIME);
  const end = toMinutes(END_TIME);

  while (current < end) {
    slots.push(toTimeString(current));
    current += SLOT_DURATION_MIN;
  }
  return slots;
}

function normalizeTime(time: string): string {
  const timeParts = time.split(':');
  return timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
}

function calculateAvailableSlots(
  allSlots: string[],
  bookedSlots: string[],
  notAvailableSlots: string[]
): { availableSlots: string[]; availableCount: number } {
  // Normalize all times to HH:MM format
  const normalizedBooked = bookedSlots.map(normalizeTime);
  const normalizedNotAvailable = notAvailableSlots.map(normalizeTime);
  
  // Create Sets for reliable comparison
  const bookedSet = new Set(normalizedBooked);
  const notAvailableSet = new Set(normalizedNotAvailable);
  
  // Filter available slots
  const availableSlots = allSlots.filter(slot => {
    const normalizedSlot = normalizeTime(slot);
    return !bookedSet.has(normalizedSlot) && !notAvailableSet.has(normalizedSlot);
  });
  
  // Calculate count using formula: Total - (Booked + NotAvailable)
  const totalSlots = allSlots.length;
  const bookedCount = bookedSet.size;
  const notAvailableCount = notAvailableSet.size;
  const availableCount = totalSlots - bookedCount - notAvailableCount;
  
  return { availableSlots, availableCount };
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
        
        // Ensure we're using the correct year (handle any timezone issues)
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const startDateStr = `${year}-${month}-${day}`;
        
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 6); // Next 6 days + today = 7 days
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDate.getDate()).padStart(2, '0');
        const endDateStr = `${endYear}-${endMonth}-${endDay}`;
        
        console.log('📅 Fetching booked slots from:', startDateStr, 'to', endDateStr);
        
        // Fetch booked slots from backend (real-time)
        const bookedResponse = await apiService.getExpertBookedSlots(expertId, startDateStr, endDateStr);
        
        // Handle nested response structure (API service wraps backend response)
        // Backend returns: { success: true, data: { bookedSlots: [...] } }
        // API service wraps it: { success: true, data: { success: true, data: { bookedSlots: [...] } } }
        let bookedSlots = [];
        if (bookedResponse.success && bookedResponse.data) {
          // Check nested structure first (API service wraps the response)
          if (bookedResponse.data.data && bookedResponse.data.data.bookedSlots) {
            bookedSlots = bookedResponse.data.data.bookedSlots;
          } else if (bookedResponse.data.bookedSlots) {
            bookedSlots = bookedResponse.data.bookedSlots;
          } else if (Array.isArray(bookedResponse.data)) {
            bookedSlots = bookedResponse.data;
          }
        }
        
        console.log('📅 Fetched booked slots (raw):', JSON.stringify(bookedSlots, null, 2));
        console.log('📅 Full booked response structure:', {
          success: bookedResponse.success,
          hasData: !!bookedResponse.data,
          dataKeys: bookedResponse.data ? Object.keys(bookedResponse.data) : [],
          hasNestedData: !!(bookedResponse.data && bookedResponse.data.data),
          nestedDataKeys: (bookedResponse.data && bookedResponse.data.data) ? Object.keys(bookedResponse.data.data) : [],
          bookedSlotsCount: bookedSlots.length
        });
        
        // Generate time slots using production utility (9am to 9pm, hourly)
        const allTimes = generateDailySlots();
        
        // Group booked slots by date
        const bookedByDate: Record<string, string[]> = {};
        bookedSlots.forEach((slot: any) => {
          if (slot.date && slot.time && slot.status !== 'cancelled') {
            // Normalize date format to YYYY-MM-DD
            let normalizedDate = slot.date;
            if (slot.scheduledDate) {
              // If we have scheduledDate, extract date from it to ensure consistency
              const dateFromScheduled = new Date(slot.scheduledDate);
              const year = dateFromScheduled.getFullYear();
              const month = String(dateFromScheduled.getMonth() + 1).padStart(2, '0');
              const day = String(dateFromScheduled.getDate()).padStart(2, '0');
              normalizedDate = `${year}-${month}-${day}`;
            } else if (normalizedDate && !normalizedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // If date is not in YYYY-MM-DD format, try to parse it
              const parsedDate = new Date(normalizedDate);
              if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                normalizedDate = `${year}-${month}-${day}`;
              }
            }
            
            // ALWAYS convert booked time to HH:MM format (handle "09:00:00" -> "09:00")
            // Split by ':' and take first two parts (hours and minutes)
            const timeParts = slot.time.split(':');
            const normalizedTime = timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
            
            if (!bookedByDate[normalizedDate]) {
              bookedByDate[normalizedDate] = [];
            }
            bookedByDate[normalizedDate].push(normalizedTime);
            console.log(`📅 Marking slot as booked: ${normalizedDate} at ${normalizedTime}`, {
              originalDate: slot.date,
              normalizedDate: normalizedDate,
              originalTime: slot.time,
              normalizedTime: normalizedTime,
              scheduledDate: slot.scheduledDate,
              status: slot.status
            });
          } else {
            console.log(`⚠️ Skipping slot (missing data or cancelled):`, slot);
          }
        });
        
        console.log('📅 Booked slots by date (grouped):', JSON.stringify(bookedByDate, null, 2));
        
        // Generate availability slots for next 7 days (starting from today, excluding past dates)
      const slots = [];
      const currentTime = new Date(); // Get current time once for all comparisons
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
          
          // Normalize booked times for comparison (ensure HH:MM format)
          // ALWAYS convert to HH:MM format (handle "09:00:00" -> "09:00")
          const normalizedBookedTimes = bookedTimes.map(bt => {
            const timeParts = bt.split(':');
            return timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
          });
          
          // Determine if this is today's date
          const isTodayDate = i === 0;
          
          // Get current time components for comparison (only for today)
          const currentHour = currentTime.getHours();
          const currentMinute = currentTime.getMinutes();
          
          // Calculate not available slots (past times for today)
          const notAvailableTimes: string[] = [];
          if (isTodayDate) {
            allTimes.forEach(time => {
              const [hours, minutes] = time.split(':').map(Number);
              if (hours < currentHour || (hours === currentHour && minutes <= currentMinute)) {
                // Normalize time format (allTimes are already HH:MM, but ensure consistency)
                const timeParts = time.split(':');
                const normalizedTime = timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
                notAvailableTimes.push(normalizedTime);
              }
            });
          }
          
          // Calculate available slots using production utility
          // This ensures consistent normalization and accurate counting
          const { availableSlots: availableTimes, availableCount } = calculateAvailableSlots(
            allTimes,
            normalizedBookedTimes,
            notAvailableTimes
          );
          
          // Get counts for logging
          const bookedSet = new Set(normalizedBookedTimes.map(normalizeTime));
          const notAvailableSet = new Set(notAvailableTimes.map(normalizeTime));
          const bookedCount = bookedSet.size;
          const notAvailableCount = notAvailableSet.size;
          const totalSlots = allTimes.length;
          
          // Verification: availableCount should match availableTimes.length
          if (isTodayDate) {
            console.log(`📊 Date ${dateStr} (TODAY): ${availableCount} available slots`, {
              formula: `${totalSlots} - (${bookedCount} booked + ${notAvailableCount} not available) = ${availableCount}`,
              breakdown: {
                totalSlots: totalSlots,
                bookedSlots: bookedCount,
                notAvailableSlots: notAvailableCount,
                calculatedAvailable: availableCount,
                filteredAvailableCount: availableTimes.length
              },
              currentTime: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
              bookedTimes: normalizedBookedTimes,
              notAvailableTimes: notAvailableTimes,
              availableTimes: availableTimes
            });
          }
        
        slots.push({
          date: dateStr,
          dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
          availableTimes,
          bookedTimes: normalizedBookedTimes,
          notAvailableTimes: notAvailableTimes,
          availableCount: availableCount, // Calculated using formula: Total - (Booked + NotAvailable)
          isAvailable: availableCount > 0
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
        console.log('🔄 Refreshing availability due to real-time update');
        fetchAvailability();
      }
    };
    
    const handleSessionCreated = (session: any) => {
      console.log('📅 Session created, refreshing availability:', session);
      if (session.expertId === expertId || session.expert?.id === expertId) {
        console.log('🔄 Refreshing availability due to session creation');
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
    setShowPaymentModal(false);
    
    // Call the original booking function after successful payment
    try {
      await onBookSession(selectedDate, selectedTime);
      
      // Wait a moment for backend to process, then refresh
      setTimeout(() => {
        refreshAvailability();
      }, 1500);
    } catch (error: any) {
      console.error('❌ Booking error:', error);
      // Even if booking fails (e.g., conflict), refresh availability to show current state
      setTimeout(() => {
        refreshAvailability();
      }, 1000);
    }
  };
  
  // Manual refresh function (exposed for external use)
  const refreshAvailability = async () => {
    console.log('🔄 Manual availability refresh triggered');
    // Re-fetch availability
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const startDateStr = `${year}-${month}-${day}`;
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 6);
    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDate.getDate()).padStart(2, '0');
    const endDateStr = `${endYear}-${endMonth}-${endDay}`;
    
    try {
      const bookedResponse = await apiService.getExpertBookedSlots(expertId, startDateStr, endDateStr);
      
      // Handle nested response structure (API service wraps backend response)
      // Backend: { success: true, data: { bookedSlots: [...] } }
      // API service wraps: { success: true, data: { success: true, data: { bookedSlots: [...] } } }
      let bookedSlots = [];
      if (bookedResponse.success && bookedResponse.data) {
        if (bookedResponse.data.data && bookedResponse.data.data.bookedSlots) {
          bookedSlots = bookedResponse.data.data.bookedSlots;
        } else if (bookedResponse.data.bookedSlots) {
          bookedSlots = bookedResponse.data.bookedSlots;
        } else if (Array.isArray(bookedResponse.data)) {
          bookedSlots = bookedResponse.data;
        }
      }
      
      console.log('🔄 Refreshed booked slots:', bookedSlots);
      
      // Regenerate availability data (same logic as in useEffect)
      const allTimes = generateDailySlots();
      
      const bookedByDate: Record<string, string[]> = {};
      bookedSlots.forEach((slot: any) => {
        if (slot.date && slot.time && slot.status !== 'cancelled') {
          let normalizedDate = slot.date;
          if (slot.scheduledDate) {
            const dateFromScheduled = new Date(slot.scheduledDate);
            const year = dateFromScheduled.getFullYear();
            const month = String(dateFromScheduled.getMonth() + 1).padStart(2, '0');
            const day = String(dateFromScheduled.getDate()).padStart(2, '0');
            normalizedDate = `${year}-${month}-${day}`;
          }
          
          // ALWAYS convert booked time to HH:MM format (handle "09:00:00" -> "09:00")
          const timeParts = slot.time.split(':');
          const normalizedTime = timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
          
          if (!bookedByDate[normalizedDate]) {
            bookedByDate[normalizedDate] = [];
          }
          bookedByDate[normalizedDate].push(normalizedTime);
        }
      });
      
      const slots = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const dateObj = new Date(dateStr);
        dateObj.setHours(0, 0, 0, 0);
        if (dateObj < today) {
          continue;
        }
        
        const bookedTimes = bookedByDate[dateStr] || [];
        // Normalize booked times for comparison
        const normalizedBookedTimes = bookedTimes.map(bt => {
          const timeParts = bt.split(':');
          return timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
        });
        
        // Calculate not available slots (past times for today)
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        const notAvailableTimes: string[] = [];
        if (i === 0) { // Today
          allTimes.forEach(time => {
            const [hours, minutes] = time.split(':').map(Number);
            if (hours < currentHour || (hours === currentHour && minutes <= currentMinute)) {
              const timeParts = time.split(':');
              const normalizedTime = timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
              notAvailableTimes.push(normalizedTime);
            }
          });
        }
        
        // Calculate available slots using production utility
        const { availableSlots: availableTimes, availableCount } = calculateAvailableSlots(
          allTimes,
          normalizedBookedTimes,
          notAvailableTimes
        );
        
        slots.push({
          date: dateStr,
          dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
          availableTimes,
          bookedTimes: normalizedBookedTimes,
          notAvailableTimes: notAvailableTimes,
          availableCount: availableCount,
          isAvailable: availableCount > 0
        });
      }
      
      setAvailabilityData({
        expertId,
        workingHours: { start: '09:00', end: '21:00' },
        daysAvailable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        slots
      });
    } catch (error) {
      console.error('Error refreshing availability:', error);
    }
  };
  
  // Refresh availability when booking fails (conflict detected)
  useEffect(() => {
    const handleBookingError = () => {
      console.log('🔄 Booking error detected, refreshing availability...');
      // Re-trigger the main fetchAvailability from useEffect
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const startDateStr = `${year}-${month}-${day}`;
      
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 6);
      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDate.getDate()).padStart(2, '0');
      const endDateStr = `${endYear}-${endMonth}-${endDay}`;
      
      setTimeout(async () => {
        try {
          const bookedResponse = await apiService.getExpertBookedSlots(expertId, startDateStr, endDateStr);
          
          // Handle nested response structure (API service wraps backend response)
          let bookedSlots = [];
          if (bookedResponse.success && bookedResponse.data) {
            if (bookedResponse.data.data && bookedResponse.data.data.bookedSlots) {
              bookedSlots = bookedResponse.data.data.bookedSlots;
            } else if (bookedResponse.data.bookedSlots) {
              bookedSlots = bookedResponse.data.bookedSlots;
            } else if (Array.isArray(bookedResponse.data)) {
              bookedSlots = bookedResponse.data;
            }
          }
          
          console.log('🔄 Refreshed booked slots after error:', bookedSlots);
          
          // Regenerate availability (same logic as in main useEffect)
          const allTimes = generateDailySlots();
          
          const bookedByDate: Record<string, string[]> = {};
          bookedSlots.forEach((slot: any) => {
            if (slot.date && slot.time && slot.status !== 'cancelled') {
              let normalizedDate = slot.date;
              if (slot.scheduledDate) {
                const dateFromScheduled = new Date(slot.scheduledDate);
                const year = dateFromScheduled.getFullYear();
                const month = String(dateFromScheduled.getMonth() + 1).padStart(2, '0');
                const day = String(dateFromScheduled.getDate()).padStart(2, '0');
                normalizedDate = `${year}-${month}-${day}`;
              }
              
              // ALWAYS convert booked time to HH:MM format (handle "09:00:00" -> "09:00")
              const timeParts = slot.time.split(':');
              const normalizedTime = timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
              
              if (!bookedByDate[normalizedDate]) {
                bookedByDate[normalizedDate] = [];
              }
              bookedByDate[normalizedDate].push(normalizedTime);
            }
          });
          
          const slots = [];
          for (let i = 0; i < 7; i++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            const dateObj = new Date(dateStr);
            dateObj.setHours(0, 0, 0, 0);
            if (dateObj < today) {
              continue;
            }
            
            const bookedTimes = bookedByDate[dateStr] || [];
            // Normalize booked times for comparison
            const normalizedBookedTimes = bookedTimes.map(bt => {
              const timeParts = bt.split(':');
              return timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
            });
            
            // Calculate not available slots (past times for today)
            const currentTime = new Date();
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const notAvailableTimes: string[] = [];
            if (i === 0) { // Today
              allTimes.forEach(time => {
                const [hours, minutes] = time.split(':').map(Number);
                if (hours < currentHour || (hours === currentHour && minutes <= currentMinute)) {
                  const timeParts = time.split(':');
                  const normalizedTime = timeParts[0].padStart(2, '0') + ":" + (timeParts[1] || '00').padStart(2, '0');
                  notAvailableTimes.push(normalizedTime);
                }
              });
            }
            
            // Calculate available slots using production utility
            const { availableSlots: availableTimes, availableCount } = calculateAvailableSlots(
              allTimes,
              normalizedBookedTimes,
              notAvailableTimes
            );
            
            slots.push({
              date: dateStr,
              dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
              availableTimes,
              bookedTimes: normalizedBookedTimes,
              notAvailableTimes: notAvailableTimes,
              availableCount: availableCount,
              isAvailable: availableCount > 0
            });
          }
          
          setAvailabilityData({
            expertId,
            workingHours: { start: '09:00', end: '21:00' },
            daysAvailable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            slots
          });
        } catch (error) {
          console.error('Error refreshing availability after booking error:', error);
        }
      }, 1000);
    };
    
    // Listen for booking errors via custom event
    window.addEventListener('booking-error', handleBookingError);
    return () => {
      window.removeEventListener('booking-error', handleBookingError);
    };
  }, [expertId]);
  
  

  // Get slot status: "booked", "not_available", or "available"
  const getSlotStatus = (date: string, time: string): "booked" | "not_available" | "available" => {
    if (!availabilityData) return "not_available";
    
    const slot = availabilityData.slots.find(s => s.date === date);
    if (!slot) {
      console.log(`⚠️ No slot found for date: ${date}`);
      return "not_available";
    }
    
    // Normalize time format for comparison (ensure HH:MM format)
    let normalizedTime = time.length === 5 ? time : time.substring(0, 5);
    if (normalizedTime.includes(':')) {
      const parts = normalizedTime.split(':');
      normalizedTime = `${parts[0].padStart(2, '0')}:${parts[1]?.padStart(2, '0') || '00'}`;
    }
    
    // Check if this time is in the booked times array
    const isBooked = slot.bookedTimes.some(bookedTime => {
      let normalizedBookedTime = bookedTime.length === 5 ? bookedTime : bookedTime.substring(0, 5);
      if (normalizedBookedTime.includes(':')) {
        const parts = normalizedBookedTime.split(':');
        normalizedBookedTime = `${parts[0].padStart(2, '0')}:${parts[1]?.padStart(2, '0') || '00'}`;
      }
      return normalizedBookedTime === normalizedTime;
    });
    
    if (isBooked) {
      console.log(`🔴 Slot is BOOKED: ${date} at ${normalizedTime}`, {
        bookedTimes: slot.bookedTimes,
        checkingTime: normalizedTime
      });
      return "booked";
    }
    
    // Check if time is available (in availableTimes array)
    const isAvailable = slot.availableTimes.some(availableTime => {
      let normalizedAvailableTime = availableTime.length === 5 ? availableTime : availableTime.substring(0, 5);
      if (normalizedAvailableTime.includes(':')) {
        const parts = normalizedAvailableTime.split(':');
        normalizedAvailableTime = `${parts[0].padStart(2, '0')}:${parts[1]?.padStart(2, '0') || '00'}`;
      }
      return normalizedAvailableTime === normalizedTime;
    });
    
    if (isAvailable) {
      return "available";
    }
    
    // If not booked and not in availableTimes, it's not available (past time, etc.)
    return "not_available";
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
                        <span className="font-medium">{slot.availableCount ?? slot.availableTimes.length} slots</span>
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
                const slotStatus = getSlotStatus(selectedDate, time);
                
                // Check if this is a past time slot for today
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                const isPastTime = selectedDate === todayStr && (() => {
                  const [hours, minutes] = time.split(':').map(Number);
                  const slotDateTime = new Date(today);
                  slotDateTime.setHours(hours, minutes, 0, 0);
                  return slotDateTime < today;
                })();
                
                // Determine final status (past times override other statuses)
                const finalStatus = isPastTime ? "not_available" : slotStatus;
                const isBooked = finalStatus === "booked";
                const isAvailable = finalStatus === "available";
                const isUnavailable = finalStatus === "not_available";
                
                // Slot class mapping
                const slotClasses = {
                  booked: "opacity-40 cursor-not-allowed border-gray-300 bg-red-50",
                  not_available: "opacity-40 cursor-not-allowed border-gray-300",
                  available: "border-blue-500 text-blue-600 hover:bg-blue-50"
                };
                
                return (
                  <button
                    key={time}
                    className={`
                      flex items-center gap-2 w-24 justify-center py-2 rounded-lg border transition-all duration-200 relative
                      ${slotClasses[finalStatus]}
                      ${selectedTime === time && isAvailable ? "bg-blue-100 border-blue-600" : ""}
                    `}
                    disabled={!isAvailable}
                    onClick={() => {
                      if (isAvailable) {
                        setSelectedTime(time);
                      }
                    }}
                  >
                    {/* Diagonal cut line for booked and unavailable slots */}
                    {(isBooked || isUnavailable) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className={`w-full h-0.5 transform rotate-45 opacity-80 ${
                          isBooked ? 'bg-red-500' : 'bg-gray-400'
                        }`}></div>
                      </div>
                    )}
                    <Clock className="h-4 w-4" />
                    <span>{time}</span>
                  </button>
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






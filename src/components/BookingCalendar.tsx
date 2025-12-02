import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CreditCard, X, CheckCircle } from "lucide-react";
import { generateSlots, computeAvailable, normalize } from "@/utils/slots";
import { formatDate, normalizeDate } from "@/utils/dateUtils";
import PaymentModal from "./PaymentModal";
import realtimeService from "@/lib/realtimeService";
import { apiService } from "@/lib/apiService";

interface BookingCalendarProps {
  expertId: string;
  expertName: string;
  hourlyRate: number;
  onBookSession: (date: string, time: string) => void;
}

interface Slot {
  date: string;
  booked: string[];
  disabled: string[];
  available: string[];
  count: number;
  isAvailable: boolean;
}

export default function BookingCalendar({ expertId, expertName, hourlyRate, onBookSession }: BookingCalendarProps) {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  const allSlots = generateSlots();

  // ------------------------------
  // Fetch Availability
  // ------------------------------
  const load = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const start = normalizeDate(today);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 6);
      const end = normalizeDate(endDate);

      const response = await apiService.getExpertBookedSlots(expertId, start, end);
      let booked: any[] = [];

      if (response.success) {
        booked =
          response.data?.data?.bookedSlots ||
          response.data?.bookedSlots ||
          response.data ||
          [];
        
        console.log('📋 API Response - Booked slots received:', booked.length, booked);
      } else {
        console.warn('⚠️ Failed to fetch booked slots:', response);
      }

      const grouped: Record<string, string[]> = {};

      booked.forEach((b) => {
        // Skip cancelled sessions only
        if (b.status === "cancelled") {
          console.log('⏭️ Skipping cancelled session:', b);
          return;
        }
        
        // Extract date and time
        const date = normalizeDate(b.scheduledDate || b.date);
        const time = normalize(b.time);

        // Validate we have both date and time
        if (!date || !time) {
          console.warn('⚠️ Invalid booked slot data (missing date or time):', b);
          return;
        }

        grouped[date] = grouped[date] || [];
        if (!grouped[date].includes(time)) {
          grouped[date].push(time);
          console.log(`✅ Added booked slot: ${date} at ${time} (status: ${b.status})`);
        } else {
          console.log(`ℹ️ Duplicate booked slot skipped: ${date} at ${time}`);
        }
      });

      console.log('📅 Grouped booked slots:', grouped);
      console.log('📊 Total booked slots by date:', Object.keys(grouped).map(date => ({
        date,
        count: grouped[date].length,
        times: grouped[date]
      })));

      const list: Slot[] = [];
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = normalizeDate(d);

        const bookedTimes = grouped[dateStr] || [];
        console.log(`📅 Date ${dateStr}: ${bookedTimes.length} booked slots:`, bookedTimes);
        const disabled: string[] = [];

        if (i === 0) {
          const now = new Date();
          allSlots.forEach((t) => {
            const [h, m] = t.split(":").map(Number);
            if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
              disabled.push(t);
            }
          });
        }

        const { available, count } = computeAvailable(allSlots, bookedTimes, disabled);

        list.push({
          date: dateStr,
          booked: bookedTimes,
          disabled,
          available,
          count,
          isAvailable: count > 0,
        });
      }

      setSlots(list);
    } catch (error) {
      console.error("Error loading availability:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handleAvailabilityUpdate = () => load();
    const handleSessionCreated = () => load();

    realtimeService.on("availability_updated", handleAvailabilityUpdate);
    realtimeService.on("session_created", handleSessionCreated);

    return () => {
      realtimeService.off("availability_updated", handleAvailabilityUpdate);
      realtimeService.off("session_created", handleSessionCreated);
    };
  }, [expertId]);

  // ------------------------------
  // Booking Flow
  // ------------------------------
  const handlePaySuccess = async () => {
    await onBookSession(selectedDate, selectedTime);
    setShowPayment(false);
    setTimeout(load, 1000);
  };

  const getSlotStatus = (date: string, time: string): "booked" | "not_available" | "available" => {
    const slot = slots.find((s) => s.date === date);
    if (!slot) {
      console.warn(`⚠️ No slot found for date: ${date}`);
      return "not_available";
    }

    const normalizedTime = normalize(time);

    // Check booked first (highest priority)
    if (slot.booked.includes(normalizedTime)) {
      console.log(`🔴 Slot ${date} ${time} is BOOKED`);
      return "booked";
    }
    
    // Then check disabled
    if (slot.disabled.includes(normalizedTime)) {
      return "not_available";
    }
    
    // Finally check available
    if (slot.available.includes(normalizedTime)) {
      return "available";
    }

    console.warn(`⚠️ Slot ${date} ${time} not found in any category. Booked: ${slot.booked.join(', ')}, Disabled: ${slot.disabled.join(', ')}, Available: ${slot.available.join(', ')}`);
    return "not_available";
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-xl bg-white">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 pb-6">
          <CardTitle className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <span>Book Session with {expertName}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
              </div>
            </div>
            <p className="mt-4 text-gray-600 font-medium">Loading availability...</p>
            <p className="mt-1 text-sm text-gray-500">Please wait a moment</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedSlot = slots.find((s) => s.date === selectedDate);

  return (
    <Card className="border-0 shadow-xl bg-white">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 pb-6">
        <CardTitle className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <span>Book Session with {expertName}</span>
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2 ml-11">
          Choose your preferred date and time slot for your interview session
        </p>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {/* Date Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Select Date</h4>
            <span className="text-xs text-gray-500 font-medium">Next 7 days</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {slots.map((slot) => (
              <button
                key={slot.date}
                onClick={() => {
                  if (slot.isAvailable) {
                    setSelectedDate(slot.date);
                    setSelectedTime("");
                  }
                }}
                disabled={!slot.isAvailable}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-300 text-left
                  ${selectedDate === slot.date 
                    ? "border-blue-600 bg-blue-50 shadow-md scale-105" 
                    : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                  }
                  ${!slot.isAvailable 
                    ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 hover:border-gray-200 hover:shadow-none" 
                    : "cursor-pointer"
                  }
                `}
              >
                <div className="font-semibold text-gray-900 text-base mb-2">
                  {formatDate(slot.date)}
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${
                  slot.isAvailable ? "text-green-700" : "text-red-600"
                }`}>
                  {slot.isAvailable ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{slot.count} {slot.count === 1 ? 'slot' : 'slots'} available</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5" />
                      <span>Fully booked</span>
                    </>
                  )}
                </div>
                {selectedDate === slot.date && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Time Selection */}
        {selectedDate && selectedSlot && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Select Time</h4>
              {selectedTime && (
                <span className="text-sm text-blue-600 font-medium">
                  Selected: {selectedTime}
                </span>
              )}
            </div>
            
            {/* Availability Legend */}
            <div className="flex items-center gap-6 mb-4 pb-4 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Legend:</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 bg-blue-50 rounded-md shadow-sm"></div>
                <span className="text-xs text-gray-700 font-medium">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-gray-300 bg-gray-100 rounded-md opacity-50 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-gray-400 transform rotate-45"></div>
                  </div>
                </div>
                <span className="text-xs text-gray-700 font-medium">Past/Unavailable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-red-300 bg-red-50 rounded-md relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-red-500 to-transparent" 
                       style={{ transform: 'rotate(45deg)', width: '200%', height: '2px', top: '50%', left: '-50%' }}></div>
                </div>
                <span className="text-xs text-gray-700 font-medium">Booked</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-start">
              {allSlots.map((time) => {
                const slotStatus = getSlotStatus(selectedDate, time);
                
                // Check if this is a past time slot for today
                const today = new Date();
                const todayStr = normalizeDate(today);
                const isPastTime =
                  selectedDate === todayStr &&
                  (() => {
                    const [hours, minutes] = time.split(":").map(Number);
                    const slotDateTime = new Date(today);
                    slotDateTime.setHours(hours, minutes, 0, 0);
                    return slotDateTime < today;
                  })();
                
                // Determine final status (past times override other statuses)
                const finalStatus = isPastTime ? "not_available" : slotStatus;
                const isBooked = finalStatus === "booked";
                const isAvailable = finalStatus === "available";
                const isUnavailable = finalStatus === "not_available";
                const isSelected = selectedTime === time && isAvailable;

                return (
                  <button
                    key={time}
                    disabled={isBooked || isUnavailable}
                    onClick={() => {
                      if (isAvailable) {
                        setSelectedTime(time);
                      }
                    }}
                    className={`
                      relative group flex flex-row items-center justify-center gap-2
                      min-w-[90px] px-4 py-3 rounded-xl border-2 transition-all duration-200
                      ${isSelected 
                        ? "border-blue-600 bg-blue-100 shadow-lg scale-105 ring-2 ring-blue-200" 
                        : ""
                      }
                      ${isAvailable && !isSelected
                        ? "border-blue-400 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 hover:shadow-md cursor-pointer"
                        : ""
                      }
                      ${isBooked
                        ? "border-red-300 bg-red-50 cursor-not-allowed opacity-70"
                        : ""
                      }
                      ${isUnavailable && !isBooked
                        ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                        : ""
                      }
                    `}
                  >
                    <Clock className={`h-4 w-4 ${
                      isSelected ? "text-blue-700" :
                      isAvailable ? "text-blue-600" :
                      isBooked ? "text-red-600" :
                      "text-gray-400"
                    }`} />
                    <span className={`text-sm font-semibold ${
                      isSelected ? "text-blue-900" :
                      isAvailable ? "text-blue-700" :
                      isBooked ? "text-red-700" :
                      "text-gray-500"
                    }`}>
                      {time}
                    </span>
                    
                    {/* Booked slot diagonal red line */}
                    {isBooked && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-full h-0.5 bg-red-500 transform rotate-45 opacity-80"></div>
                      </div>
                    )}
                    
                    {/* Unavailable slot diagonal gray line */}
                    {isUnavailable && !isBooked && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-full h-0.5 bg-gray-400 transform rotate-45 opacity-60"></div>
                      </div>
                    )}
                    
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedDate && selectedSlot && selectedSlot.available.length === 0 && (
          <div className="text-center py-8 border border-gray-200 rounded-xl bg-gray-50">
            <X className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-medium">No available slots for this date</p>
            <p className="text-xs text-gray-500 mt-1">Please select another date</p>
          </div>
        )}

        {/* Booking Button */}
        {selectedDate && selectedTime && (
          <div className="pt-6 border-t border-gray-200">
            <Button 
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              onClick={() => setShowPayment(true)}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Book Session & Pay ${hourlyRate}
            </Button>
            <p className="text-xs text-center text-gray-500 mt-3">
              Secure payment • 60-minute session • Cancel anytime
            </p>
          </div>
        )}

        {showPayment && (
          <PaymentModal
            isOpen={showPayment}
            onClose={() => setShowPayment(false)}
            onPaymentSuccess={() => handlePaySuccess()}
            sessionData={{
              expertName,
              date: selectedDate,
              time: selectedTime,
              duration: 60,
              amount: hourlyRate,
              sessionType: 'mock',
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
